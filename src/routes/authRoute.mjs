// src/routes/authRoute.mjs

// --- Imports ---
import { Router } from "express"; // Express Router for handling routes
import jwt from "jsonwebtoken"; // JSON Web Token for generating and verifying tokens
import { fetchUserData, fetchChannelFollowers } from "../utils/twitchApi.mjs"; // Twitch API utilities
import { saveCombinedUserData } from "../utils/saveUserData.mjs"; // Utility for saving combined user data
import { getAuthorizationUrl, getTokens, refreshTokenAccess } from "../utils/twitchAuth.mjs"; // Twitch authentication utilities
import { encrypt, decrypt } from "../utils/encryption.mjs"; // Encryption utilities
import logger from "../middlewares/logger.mjs"; // Logger middleware
import verifyToken from "../middlewares/jwtToken.mjs"; // JWT verification middleware

// --- Router Setup ---
const router = Router();

// JWT Secret - Make sure this is in your .env file
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
    console.log("Starting callback process with code:", authorizationCode);

    if (!authorizationCode) {
      console.error("No authorization code received from Twitch");
      return res.redirect(`${process.env.FRONTEND_URL}/login/error`);
    }

    // Get tokens from Twitch
    const tokens = await getTokens(authorizationCode);
    console.log("Successfully received tokens from Twitch");

    // Get user data
    const userData = await fetchUserData(tokens.access_token);
    const followerCount = await fetchChannelFollowers(tokens.access_token, userData.id);
    userData.followers_count = followerCount;
    console.log("Successfully fetched user data");

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

    console.log("JWT tokens created successfully");

    // Set cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600000 // 1 hour
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 604800000 // 7 days
    });

    console.log("Cookies set successfully");

    // Redirect to frontend
    res.redirect(`${process.env.FRONTEND_URL}/login/callback`);
  } catch (error) {
    console.error("Error in callback:", error);
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
      sameSite: 'strict',
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
  logger.info("\n=== SESSION DATA REQUEST ===");
  logger.info("Session ID:", req.sessionID);
  logger.info("Full Session:", req.session);
  logger.info("Session twitchData:", req.session?.twitchData);

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

  logger.info("=== SENDING SESSION DATA ===\n");
  return res.json({
    success: true,
    ...twitchData
  });
});

// Save user data
router.post("/auth/save", async (req, res) => {
  const { twitchData, kickData } = req.body;

  try {
    const result = await saveCombinedUserData(twitchData, kickData);
    res.json({ success: true, message: "User data saved", user: result });
  } catch (error) {
    logger.error("Error saving user data:", error);
    res.status(500).json({
      success: false,
      message: "Error saving user data",
      error: error.message
    });
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
        message: "No access token"
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

      res.json({
        success: true,
        user: decoded.user
      });
    } catch (error) {
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
    res.status(500).json({
      success: false,
      message: "Error getting user data",
      error: error.message
    });
  }
});

router.get("/auth/twitch", (req, res) => {
  const state = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const authorizationUrl = getAuthorizationUrl(state);
  res.redirect(authorizationUrl);
});

// Logout endpoint
router.post("/auth/logout", (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ success: true, message: "Logged out successfully" });
});

// --- Export Router ---
export default router;
