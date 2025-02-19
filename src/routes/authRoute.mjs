// --- Imports ---
import { Router } from "express";
import jwt from "jsonwebtoken";
import { fetchUserData, fetchChannelFollowers } from "../utils/twitchApi.mjs";
import { saveCombinedUserData } from "../utils/saveUserData.mjs";
import { getAuthorizationUrl, getTokens, refreshTokenAccess } from "../utils/twitchAuth.mjs";
import { encrypt, decrypt } from "../utils/encryption.mjs"; 
import logger from "../middlewares/logger.mjs"; 
import verifyToken from "../middlewares/jwtToken.mjs"; 

// --- Router Setup ---
const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET; 

// --- Routes ---

// Regular login endpoint
router.get("/auth/login", (req, res) => {
  const state = `login_${Date.now()}`; // Using timestamp instead of sessionID
  const authorizationUrl = getAuthorizationUrl(state);
  res.redirect(authorizationUrl);
});

// Unified callback handler
router.get("/auth/twitch/callback", async (req, res) => {
  try {
    const authorizationCode = req.query.code;
    const state = req.query.state;

    if (!authorizationCode) {
      logger.error("No authorization code received from Twitch");
      return res.redirect(`${process.env.FRONTEND_URL}/login/error`);
    }

    // Get tokens from Twitch
    const tokens = await getTokens(authorizationCode);

    // Get user data
    const userData = await fetchUserData(tokens.access_token);
    const followerCount = await fetchChannelFollowers(tokens.access_token, userData.id);
    userData.followers_count = followerCount;

    // Create JWT tokens
    const accessToken = jwt.sign(
      { user: userData, type: 'access' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { 
        userId: userData.id, 
        type: 'refresh', 
        twitchRefreshToken: encrypt(tokens.refresh_token) 
      },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'None',
      domain: '.squadw.online',
      maxAge: 3600000 // 1 hour
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'None',
      domain: '.squadw.online',
      maxAge: 604800000 // 7 days
    });

    // Determine redirect based on state
    const isVerification = state?.startsWith('verify_');
    const redirectPath = isVerification ? 'connect/callback' : 'login/callback';
    
    // Log new account creation (or login)
    logger.info(`User ${userData.login} authenticated via Twitch.  Is Verification Flow: ${isVerification}`);

    // Redirect to appropriate frontend route
    res.redirect(`${process.env.FRONTEND_URL}/${redirectPath}`);
  } catch (error) {
    logger.error("Error in callback:", error);
    res.redirect(`${process.env.FRONTEND_URL}/login/error`);
  }
});

// Refresh token endpoint
router.post("/auth/refresh-token", async (req, res) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ success: false, message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: "Invalid token type" });
    }

    // Refresh the Twitch token
    const twitchRefreshToken = decrypt(decoded.twitchRefreshToken);
    const newTwitchTokens = await refreshTokenAccess(twitchRefreshToken);
    
    // Get latest user data
    const userData = await fetchUserData(newTwitchTokens.access_token);
    
    // Generate new JWT access token
    const newAccessToken = jwt.sign(
      { user: userData, type: 'access' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Set new access token in cookie
    res.cookie('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'None',
      domain: '.squadw.online',
      maxAge: 3600000 // 1 hour
    });

    res.json({ success: true, message: "Token refreshed successfully" });
  } catch (error) {
    logger.error("Error refreshing token:", error);
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
});

// Session data endpoint
router.get("/auth/twitch/session-data", (req, res) => {

  if (!req.session?.twitchData) {
    logger.warn("=== NO SESSION DATA FOUND ===\n");
    return res.status(404).json({
      success: false,
      message: "No session data found"
    });
  }

  // Decrypt tokens before sending
  const twitchData = {
    ...req.session.twitchData,
    accessToken: decrypt(req.session.twitchData.accessToken),
    refreshToken: decrypt(req.session.twitchData.refreshToken)
  };

  return res.json({
    success: true,
    ...twitchData
  });
});

// Save user data
router.post("/auth/save", async (req, res) => {
  try {
    const { twitchData, kickData } = req.body;
    const accessToken = req.cookies.access_token;
    const refreshToken = req.cookies.refresh_token;

    if (!accessToken || !refreshToken) {
      return res.status(401).json({ success: false, message: "Missing authentication tokens", isAuthenticated: false });
    }

    // Decode JWT to verify authentication
    const decodedAccess = jwt.verify(accessToken, JWT_SECRET);
    const decodedRefresh = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    const fullTwitchData = {
      ...twitchData,
      accessToken,
      refreshToken: decodedRefresh.twitchRefreshToken,
      expiresAt: decodedAccess.exp * 1000, // Convert JWT expiry to ms
    };

    const result = await saveCombinedUserData(fullTwitchData, kickData);

    logger.info(`User data saved/updated for user ID: ${fullTwitchData.id}`); // Log user data save

    res.json({ success: true, user: result, isAuthenticated: true });
  } catch (error) {
    logger.error("Error saving user data:", error);
    res.status(500).json({ success: false, message: "Error saving user data", isAuthenticated: false, error: error.message });
  }
});

// Refresh access token for session
router.get("/auth/twitch/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.session.twitchData;
    const newTokenData = await refreshTokenAccess(decrypt(refreshToken));

    req.session.twitchData.accessToken = encrypt(newTokenData.accessToken);
    req.session.twitchData.refreshToken = encrypt(newTokenData.refreshToken);
    req.session.twitchData.expiresAt = new Date(
      Date.now() + newTokenData.expires_in * 1000
    ).toISOString();

    res.json({ success: true, message: "Token refreshed" });
  } catch (error) {
    logger.error("Error refreshing token:", error);
    res.status(500).json({
      success: false,
      message: "Error refreshing token",
      error: error.message
    });
  }
});

// Failure route
router.get("/auth/failure", (req, res) => {
  res.status(401).json({ success: false, message: "Authentication failed" });
});

router.get("/auth/user", async (req, res) => {
  try {
   
    const accessToken = req.cookies.access_token;
    
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "No access token found"
      });
    }

    try {
      const decoded = jwt.verify(accessToken, JWT_SECRET);
      
      if (decoded.type !== 'access') {
        return res.status(401).json({
          success: false,
          message: "Invalid token type"
        });
      }

      return res.json({
        success: true,
        user: decoded.user
      });
    } catch (error) {
      console.error('JWT verification error:', error);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: "Token expired"
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error in /auth/user:", error);
    return res.status(500).json({
      success: false,
      message: "Error getting user data",
      error: error.message
    });
  }
});

// For initial verification/signup
router.get("/auth/twitch/verify", (req, res) => {
  const state = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const authorizationUrl = getAuthorizationUrl(state);
  res.redirect(authorizationUrl);
});

// For regular login
router.get("/auth/twitch/login", (req, res) => {
  const state = `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const authorizationUrl = getAuthorizationUrl(state);
  res.redirect(authorizationUrl);
});

router.post("/auth/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided"
      });
    }

    try {
      // Verify the refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          message: "Invalid token type"
        });
      }

      // Decrypt the stored Twitch refresh token
      const twitchRefreshToken = decrypt(decoded.twitchRefreshToken);
      
      // Get new Twitch tokens using the refresh token
      const newTwitchTokens = await refreshTwitchToken(twitchRefreshToken);
      
      // Get updated user data
      const userData = await fetchUserData(newTwitchTokens.access_token);
      const followerCount = await fetchChannelFollowers(newTwitchTokens.access_token, userData.id);
      userData.followers_count = followerCount;

      // Create new JWT tokens
      const newAccessToken = jwt.sign(
        { user: userData, type: 'access' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const newRefreshToken = jwt.sign(
        { 
          userId: userData.id, 
          type: 'refresh', 
          twitchRefreshToken: encrypt(newTwitchTokens.refresh_token) 
        },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Set new cookies
      res.cookie('access_token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600000 // 1 hour
      });

      res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 604800000 // 7 days
      });

      return res.json({
        success: true,
        user: userData
      });

    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token"
      });
    }
  } catch (error) {
    console.error("Error in refresh:", error);
    return res.status(500).json({
      success: false,
      message: "Error refreshing tokens"
    });
  }
});

// Logout endpoint
router.post("/auth/logout", (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ success: true, message: "Logged out successfully" });
});

// --- Export Router ---
export default router;