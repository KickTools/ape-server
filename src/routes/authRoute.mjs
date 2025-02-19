// src/routes/authRoute.mjs
import { Router } from "express";
import jwt from "jsonwebtoken";
import { fetchUserData, fetchChannelFollowers } from "../utils/twitchApi.mjs";
import { saveCombinedUserData } from "../utils/saveUserData.mjs";
import { getAuthorizationUrl, getTokens, refreshTokenAccess } from "../utils/twitchAuth.mjs";
import { getAccessTokenCookieConfig, getRefreshTokenCookieConfig } from '../utils/cookieConfig.mjs';
import { encrypt, decrypt } from "../utils/encryption.mjs"; 
import { generateTokens, verifyAccessToken, verifyRefreshToken, verifyTwitchTokens } from '../middlewares/tokenAuth.mjs';
import logger from "../middlewares/logger.mjs"; 

// --- Router Setup ---
const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET; 

const isProduction = process.env.NODE_ENV === "production";
const redirectBase = isProduction ? process.env.FRONTEND_URL : process.env.BACKEND_URL;

// --- Routes ---

// Regular login endpoint
router.get("/twitch/login", (req, res) => {
  const state = `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const authorizationUrl = getAuthorizationUrl(state);
  res.redirect(authorizationUrl);
});

// For initial verification/signup
router.get("/twitch/verify", (req, res) => {
  const state = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const authorizationUrl = getAuthorizationUrl(state);
  res.redirect(authorizationUrl);
});

// Unified callback handler
router.get("/twitch/callback", async (req, res) => {
  try {
    const authorizationCode = req.query.code;
    const state = req.query.state;

    if (!authorizationCode) {
      logger.error("No authorization code received from Twitch");
      return res.redirect(`${redirectBase}/login/error`);
    }

    // Get tokens from Twitch
    const tokens = await getTokens(authorizationCode);

    // Get user data
    const userData = await fetchUserData(tokens.access_token);
    const followerCount = await fetchChannelFollowers(tokens.access_token, userData.id);
    userData.followers_count = followerCount;

    // Create JWT access and refresh tokens
    const { accessToken, refreshToken } = generateTokens(userData, tokens.refresh_token);

    // Set cookies
    res.cookie('access_token', accessToken, getAccessTokenCookieConfig());
    res.cookie('refresh_token', refreshToken, getRefreshTokenCookieConfig());

    // Determine redirect based on state
    const isVerification = state?.startsWith('verify_');
    const redirectPath = isVerification ? 'connect/callback' : 'login/callback';
    
    // Log new account creation (or login)
    logger.info(`User ${userData.login} authenticated via Twitch.  Is Verification Flow: ${isVerification}`);

    // Redirect to appropriate frontend route
    res.redirect(`${redirectBase}/${redirectPath}`);
  } catch (error) {
    logger.error("Error in callback:", error);
    res.redirect(`${redirectBase}/login/error`);
  }
});

// Refresh token endpoint
router.post("/refresh-token", verifyRefreshToken, async (req, res) => {
  try {
    // Refresh Twitch tokens
    const newTwitchTokens = await refreshTokenAccess(req.twitchRefreshToken);
    
    // Get latest user data
    const userData = await fetchUserData(newTwitchTokens.access_token);
    
    // Generate new tokens using the middleware helper
    const { accessToken } = generateTokens(userData, newTwitchTokens.refresh_token);

    // Set new access token in cookie
    res.cookie('access_token', accessToken, getAccessTokenCookieConfig());

    res.json({ success: true, message: "Token refreshed successfully" });
  } catch (error) {
    logger.error("Error refreshing token:", error);
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
});

// Session data endpoint
router.get("/twitch/session-data", verifyAccessToken, (req, res) => {
  if (!req.session?.twitchData) {
    logger.warn("=== NO SESSION DATA FOUND ===\n");
    return res.status(404).json({
      success: false,
      message: "No session data found"
    });
  }

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
router.post("/save", verifyAccessToken, verifyRefreshToken, async (req, res) => {
  try {
    const { twitchData, kickData } = req.body;

    const fullTwitchData = {
      ...twitchData,
      accessToken: req.cookies.access_token,
      refreshToken: req.twitchRefreshToken, // From middleware
      expiresAt: req.user.exp * 1000, // From middleware
    };

    const result = await saveCombinedUserData(fullTwitchData, kickData);
    logger.info(`User data saved/updated for user ID: ${fullTwitchData.id}`);

    res.json({ success: true, user: result, isAuthenticated: true });
  } catch (error) {
    logger.error("Error saving user data:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error saving user data", 
      isAuthenticated: false, 
      error: error.message 
    });
  }
});

// Refresh access token for session
router.get("/twitch/refresh-token", async (req, res) => {
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
router.get("/failure", (req, res) => {
  res.status(401).json({ success: false, message: "Authentication failed" });
});

router.get("/user", async (req, res) => {
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

// Logout endpoint
router.post("/logout", (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ success: true, message: "Logged out successfully" });
});

// --- Export Router ---
export default router;