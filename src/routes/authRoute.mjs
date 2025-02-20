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
  const startTime = Date.now();
  try {
    const authorizationCode = req.query.code;
    const state = req.query.state;

    if (!authorizationCode) {
      logger.error("Missing authorization code from Twitch");
      return res.redirect(`${redirectBase}/login/error`);
    }

    const tokens = await getTokens(authorizationCode);
    const userData = await fetchUserData(tokens.access_token);
    const followerCount = await fetchChannelFollowers(tokens.access_token, userData.id);
    userData.followers_count = followerCount;

    const { accessToken, refreshToken } = generateTokens(userData, tokens.refresh_token);
    res.cookie('access_token', accessToken, getAccessTokenCookieConfig());
    res.cookie('refresh_token', refreshToken, getRefreshTokenCookieConfig());

    const isVerification = state?.startsWith('verify_');
    const redirectPath = isVerification ? 'connect/callback' : 'login/callback';
    
    logger.info(`Authentication successful`, {
      userId: userData.id,
      isVerification,
      duration: Date.now() - startTime
    });

    res.redirect(`${redirectBase}/${redirectPath}`);
  } catch (error) {
    logger.error("Callback error", {
      error: error.message,
      duration: Date.now() - startTime
    });
    res.redirect(`${redirectBase}/login/error`);
  }
});

// Refresh token endpoint
router.post("/refresh-token", verifyRefreshToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const newTwitchTokens = await refreshTokenAccess(req.twitchRefreshToken);
    const userData = await fetchUserData(newTwitchTokens.access_token);
    const { accessToken } = generateTokens(userData, newTwitchTokens.refresh_token);

    res.cookie('access_token', accessToken, getAccessTokenCookieConfig());

    logger.info("Token refresh successful", {
      userId: userData.id,
      duration: Date.now() - startTime
    });

    res.json({ success: true, message: "Token refreshed successfully" });
  } catch (error) {
    logger.error("Token refresh error", {
      error: error.message,
      duration: Date.now() - startTime
    });
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
});

// Session data endpoint
router.get("/twitch/session-data", verifyAccessToken, (req, res) => {
  if (!req.session?.twitchData) {
    logger.warn("Missing session data");
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
  const startTime = Date.now();
  
  try {
    const { twitchData, kickData } = req.body;
    const accessToken = req.cookies.access_token;
    const decodedAccessToken = jwt.decode(accessToken);
    
    const fullTwitchData = {
      user: {
        ...twitchData.user,
        ...decodedAccessToken.user
      },
      accessToken: accessToken,
      refreshToken: req.twitchRefreshToken,
      expiresAt: decodedAccessToken.exp * 1000
    };

    logger.info('Starting save operation', {
      userId: fullTwitchData.user.id,
      hasTwitchData: Boolean(twitchData),
      hasKickData: Boolean(kickData)
    });

    const result = await saveCombinedUserData(fullTwitchData, kickData);
    
    logger.info(`Save operation complete`, {
      userId: fullTwitchData.user.id,
      duration: Date.now() - startTime
    });

    res.json({ 
      success: true, 
      user: result, 
      isAuthenticated: true 
    });
  } catch (error) {
    logger.error('Save operation failed', {
      error: error.message,
      userId: req?.user?.id,
      duration: Date.now() - startTime
    });

    res.status(500).json({ 
      success: false, 
      message: "Error saving user data", 
      isAuthenticated: false
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
  const accessTokenConfig = getAccessTokenCookieConfig();
  const refreshTokenConfig = getRefreshTokenCookieConfig();

  res.clearCookie('access_token', { 
    path: '/',
    domain: accessTokenConfig.domain 
  });

  res.clearCookie('refresh_token', { 
    path: '/', 
    domain: refreshTokenConfig.domain 
  });
  logger.info("User logged out");
  res.json({ success: true, message: "Logged out successfully" });
});

// --- Export Router ---
export default router;