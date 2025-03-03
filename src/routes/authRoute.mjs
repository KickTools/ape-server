// src/routes/authRoute.mjs
import { Router } from "express";
import { fetchKickUserData } from "../services/kickService.mjs";
import TwitchAPIClient from '../utils/twitchApi.mjs';
import KickAPIClient from '../utils/kickApi.mjs';
import { TwitchAuth } from '../utils/twitchAuth.mjs';
import { KickAuth } from '../utils/kickAuth.mjs';
import { XAuth } from '../utils/xAuth.mjs';
import { verifySessionToken } from "../middlewares/sessionAuth.mjs";
import {
  generateSessionToken,
  getSessionCookieConfig,
  saveTwitchSession,
  saveKickSession,
  saveXSession,
  getTwitchSessionTokens,
  getKickSessionTokens,
  getXSessionTokens
} from "../utils/auth.mjs";
import { saveCombinedUserData, saveKickUserData, saveTwitchUserData } from "../utils/saveUserData.mjs";
import { getAccessTokenCookieConfig, getRefreshTokenCookieConfig } from '../utils/cookieConfig.mjs';
import logger from "../middlewares/logger.mjs";
import jwt from 'jsonwebtoken';
import { verificationCache, VERIFY_FLOW_TTL } from '../utils/cache.mjs';
import { Viewer } from "../models/Viewer.mjs";

class StreamingAuthRouter {
  constructor() {
    this.router = Router();
    this.twitchAuth = TwitchAuth;
    this.kickAuth = KickAuth;
    this.xAuth = new XAuth();
    this.twitchClient = null;
    this.kickClient = null;
    this.pendingAuth = new Map();

    // Initialize the Kick client with basic config
    this.initializeKickClient();
    this.setupRoutes();
  }

  initializeKickClient() {
    this.kickClient = new KickAPIClient({
      clientId: this.kickAuth.KICK_CLIENT_ID,
      clientSecret: this.kickAuth.KICK_CLIENT_SECRET
    });
  }

  initializeTwitchClient() {
    this.twitchClient = new TwitchAPIClient({
      clientId: this.twitchAuth.TWITCH_CLIENT_ID,
      accessToken: tokens.access_token
    });
  }

  setupRoutes() {
    // Public Twitch Routes (no auth required)
    this.router.get("/twitch/login", this.handleTwitchLogin.bind(this));
    this.router.get("/twitch/verify", this.handleTwitchVerify.bind(this));
    this.router.get("/twitch/callback", this.handleTwitchCallback.bind(this));

    // Protected Twitch Routes
    this.router.get("/twitch/session-data", verifySessionToken, this.handleTwitchSessionData.bind(this));
    this.router.post("/twitch/refresh", verifySessionToken, this.handleTwitchRefresh.bind(this));
    this.router.get("/twitch/logout", verifySessionToken, this.handleTwitchLogout.bind(this));
    this.router.get("/verify-twitch-token", verifySessionToken, this.handleVerifyTwitchToken.bind(this));

    // Public Kick Routes
    this.router.get("/kick/login", this.handleKickLogin.bind(this));
    this.router.get("/kick/verify", this.handleKickVerify.bind(this));
    this.router.get("/kick/callback", this.handleKickCallback.bind(this));

    // X Routes
    this.router.get("/x/login", this.handleXLogin.bind(this));
    this.router.get("/x/callback", this.handleXCallback.bind(this));
    this.router.get("/x/user", verifySessionToken, this.handleXUserData.bind(this));
    this.router.post("/x/refresh", verifySessionToken, this.handleXRefresh.bind(this));
    this.router.post("/x/logout", verifySessionToken, this.handleXLogout.bind(this));

    // Protected Kick Routes
    this.router.get("/kick/user", verifySessionToken, this.handleKickUserData.bind(this));
    this.router.post("/kick/refresh", verifySessionToken, this.handleKickRefresh.bind(this));
    this.router.post("/kick/logout", verifySessionToken, this.handleKickLogout.bind(this));
    this.router.get("/verify-kick-token", verifySessionToken, this.handleVerifyKickToken.bind(this));

    // Shared Routes
    this.router.get("/user", verifySessionToken, this.handleUserData.bind(this));
    this.router.post("/save", verifySessionToken, this.handleSaveData.bind(this));
    this.router.post("/logout", verifySessionToken, this.handleLogout.bind(this));
    this.router.get("/me", verifySessionToken, (req, res) => {
      res.json({
        success: true,
        user: {
          user_id: req.user.user_id,
          platform: req.user.platform,
          role: req.user.role
        }
      });
    });
    this.router.get("/check-session", verifySessionToken, async (req, res) => {
      try {
        const viewer = await Viewer.findOne({
          $or: [
            { "twitch.user_id": req.user.user_id },
            { "kick.user_id": req.user.user_id }
          ]
        });
        res.json({
          success: true,
          user: {
            user_id: req.user.user_id,
            platform: req.user.platform,
            role: viewer?.role || req.user.role // Prefer Viewer role, fallback to token
          }
        });
      } catch (error) {
        res.status(401).json({ success: false, message: "Session invalid" });
      }
    });
  }

  // Twitch Authentication Handlers
  handleTwitchLogin(req, res) {
    const state = `twitchlogin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { url } = this.twitchAuth.getAuthorizationUrl(state);
    res.redirect(url);
  }

  handleTwitchVerify(req, res) {
    const state = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { url } = this.twitchAuth.getAuthorizationUrl(state);
    res.redirect(url);
  }

  async handleTwitchCallback(req, res) {
    const startTime = Date.now();
    try {
      const { code: authorizationCode, state } = req.query;
      const isVerification = state?.startsWith('verify_');

      if (!authorizationCode) {
        console.error('[Twitch Callback] Error: Missing authorization code from Twitch');
        logger.error("Missing authorization code from Twitch");
        return this.redirectToError(res);
      }

      const tokens = await this.twitchAuth.getTokens(authorizationCode);

      this.twitchClient = new TwitchAPIClient({
        clientId: this.twitchAuth.TWITCH_CLIENT_ID,
        accessToken: tokens.access_token
      });

      const userData = await this.twitchClient.getCurrentUser();
      if (!userData) {
        console.error('[Twitch Callback] Error: Failed to fetch user data');
        throw new Error('Failed to fetch Twitch user data');
      }

      // Handle verification flow differently than regular login
      if (isVerification) {
        const verificationId = state.split('_')[1];
        await verificationCache.setTwitchData(verificationId, {
          userData,
          tokens,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000)
        });

        res.cookie('verification_session', verificationId, {
          ...getSessionCookieConfig(),
          maxAge: VERIFY_FLOW_TTL * 1000
        });

      } else {
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        await saveTwitchSession(tokens, userData, expiresAt);
        const viewer = await Viewer.findOne({ "twitch.user_id": userData.id });
        const sessionToken = generateSessionToken(userData.id, viewer?.role);

        res.cookie('twitch_session_token', sessionToken, getSessionCookieConfig());
        res.cookie('access_token', tokens.access_token, getAccessTokenCookieConfig());
        res.cookie('refresh_token', tokens.refresh_token, getRefreshTokenCookieConfig());
      }

      this.redirectToCallback(res, isVerification, "twitch");
      const duration = Date.now() - startTime;

    } catch (error) {
      console.error('[Twitch Callback] Error occurred:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      this.handleError(error, res, startTime, 'Twitch');
    }
  }

  async handleTwitchSessionData(req, res) {
    try {
      const userId = this.getUserIdFromToken(req.cookies.session_token);
      const sessionData = await getTwitchSessionTokens(userId);

      if (!sessionData) {
        logger.warn("Missing Twitch session data");
        return res.status(404).json({
          success: false,
          message: "No session data found"
        });
      }

      // Return session data without exposing encrypted tokens
      res.json({
        success: true,
        userId,
        expiresAt: sessionData.expires_at,
        platform: 'twitch'
      });
    } catch (error) {
      logger.error("Error fetching Twitch session data", {
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: "Error retrieving session data"
      });
    }
  }

  async handleUserData(req, res) {
    try {
      const verificationId = req.cookies.verification_session;

      if (!verificationId) {
        return res.status(401).json({
          success: false,
          message: "No verification session found"
        });
      }

      // Retrieve Twitch data from cache
      const cachedData = verificationCache.getTwitchData(verificationId);

      if (!cachedData || !cachedData.tokens || !cachedData.tokens.access_token) {
        return res.status(401).json({
          success: false,
          message: "No valid access token found in cache"
        });
      }

      const accessToken = cachedData.tokens.access_token;

      try {
        // Verify Twitch token
        const twitchUserData = await this.twitchAuth.validateToken(accessToken);

        // Initialize TwitchAPIClient with the validated access token
        this.twitchClient = new TwitchAPIClient({
          clientId: this.twitchAuth.TWITCH_CLIENT_ID,
          accessToken: accessToken
        });

        // Get detailed user data using the validated user ID
        const userData = await this.twitchClient.getCurrentUser();

        return res.json({
          success: true,
          user: userData // This will contain the full user data from Twitch API
        });
      } catch (error) {
        console.error('[handleUserData] Token verification or user data fetch error:', error);
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token"
        });
      }
    } catch (error) {
      console.error("[handleUserData] Error in /auth/user:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting user data",
        error: error.message
      });
    }
  }

  async handleTwitchRefresh(req, res) {
    try {
      const userId = this.getUserIdFromToken(req.cookies.session_token);
      const sessionTokens = await getTwitchSessionTokens(userId);

      const newTokens = await this.twitchAuth.refreshTokenAccess(sessionTokens.refresh_token);
      this.twitchClient = new TwitchAPIClient({
        clientId: this.twitchAuth.TWITCH_CLIENT_ID,
        accessToken: newTokens.access_token
      });

      const userData = await this.twitchClient.getCurrentUser();

      // Save new session data
      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      await saveTwitchSession(newTokens, userData, expiresAt);

      // Update cookies
      res.cookie('access_token', newTokens.access_token, getAccessTokenCookieConfig());
      res.cookie('refresh_token', newTokens.refresh_token, getRefreshTokenCookieConfig());

      res.json({ success: true, message: "Token refreshed successfully" });
    } catch (error) {
      logger.error("Token refresh error", {
        error: error.message
      });
      res.status(401).json({ success: false, message: "Invalid refresh token" });
    }
  }

  async handleVerifyTwitchToken(req, res) {
    try {
      const accessToken = req.cookies.access_token;

      if (!accessToken) {
        return res.status(401).json({
          isValid: false,
          message: "No access token found"
        });
      }

      // Verify with Twitch
      const isValid = await this.twitchAuth.validateToken(accessToken);

      if (!isValid) {
        return res.status(401).json({
          isValid: false,
          message: "Invalid token"
        });
      }

      // Get user data since token is valid
      this.twitchClient = new TwitchAPIClient({
        clientId: this.twitchAuth.TWITCH_CLIENT_ID,
        accessToken: accessToken
      });

      const data = await this.twitchClient.getCurrentUser();
      const userData = {
        ...data,
        user_id: data.id
      };

      return res.json({
        isValid: true,
        user: userData,
        platform: 'twitch'
      });
    } catch (error) {
      logger.error("Token verification error", {
        error: error.message
      });

      return res.status(401).json({
        isValid: false,
        message: "Token verification failed"
      });
    }
  }

  async handleTwitchLogout(req, res) {
    try {
      const token = req.body.token;

      if (!token) {
        return res.status(400).json({ error: "Token is required for revocation" });
      }

      // Revoke the Twitch token
      await this.twitchAuth.revokeToken(token);

      // Optionally, clear Twitch cookies here (if they are not already cleared in global logout)
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });
      res.clearCookie('session_token', { path: '/' });

      res.json({ success: true, message: "Twitch logged out successfully" });
    } catch (error) {
      logger.error("Twitch token revocation error", { error: error.message });
      res.status(500).json({ error: "Failed to revoke Twitch token" });
    }
  }

  // Kick Authentication Handlers
  handleKickLogin(req, res) {
    const state = `kicklogin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const authData = this.kickAuth.getAuthorizationUrl(state);

    this.pendingAuth.set(state, {
      code_verifier: authData.code_verifier,
      timestamp: Date.now()
    });

    // Clean up old pending auth data
    this.cleanupPendingAuth();

    res.redirect(authData.url);
  }

  handleKickVerify(req, res) {
    const state = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const authData = this.kickAuth.getAuthorizationUrl(state);

    this.pendingAuth.set(state, {
      code_verifier: authData.code_verifier,
      timestamp: Date.now()
    });

    // Clean up old pending auth data
    this.cleanupPendingAuth();

    res.redirect(authData.url);
  }

  async handleKickCallback(req, res) {
    const startTime = Date.now();
    try {
      const { code: authorizationCode, state } = req.query;
      const isVerification = state?.startsWith('verify_');
      const verificationId = req.cookies.verification_session;

      if (!authorizationCode) {
        logger.error("Missing authorization code from Kick");
        return this.redirectToError(res);
      }

      // For verification flow, check if we have Twitch data
      if (isVerification && verificationId) {
        const twitchData = await verificationCache.getTwitchData(verificationId);
        if (!twitchData) {
          logger.error("Missing Twitch verification data");
          return this.redirectToError(res);
        } else {
          console.log("Twitch verification data found", {
            verificationId
          });
        }
      }

      const storedAuth = this.pendingAuth.get(state);
      if (!storedAuth) {
        logger.error("Invalid or expired state parameter");
        return this.redirectToError(res);
      }

      this.pendingAuth.delete(state);

      const tokens = await this.kickAuth.getTokens(authorizationCode, storedAuth.code_verifier);
      this.kickClient.setAccessToken(tokens.access_token);

      const response = await this.kickClient.getUsers();
      const userData = response.data[0];

      if (isVerification && verificationId) {
        // Get the stored Twitch data
        const twitchData = await verificationCache.getTwitchData(verificationId);

        // Save both sessions
        const kickExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        await Promise.all([
          saveTwitchSession(twitchData.tokens, twitchData.userData, twitchData.expiresAt),
          saveKickSession(tokens, userData, kickExpiresAt)
        ]);

        // Generate session tokens for both services
        const twitchSessionToken = generateSessionToken(twitchData.userData.id);
        const kickSessionToken = generateSessionToken(userData.user_id);

        // Set both cookies
        res.cookie('twitch_session_token', twitchSessionToken, getSessionCookieConfig());
        res.cookie('kick_session_token', kickSessionToken, getSessionCookieConfig());

        // Clear verification data
        verificationCache.clearVerificationData(verificationId);
        res.clearCookie('verification_session');

      } else {
        // Regular login flow - existing code
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        await saveKickSession(tokens, userData, expiresAt);
        const viewer = await Viewer.findOne({ "kick.user_id": userData.user_id });
        const sessionToken = generateSessionToken(userData.user_id, viewer?.role);
        res.cookie('kick_session_token', sessionToken, getSessionCookieConfig());
        res.cookie('kick_access_token', tokens.access_token, getAccessTokenCookieConfig());
        res.cookie('kick_refresh_token', tokens.refresh_token, getRefreshTokenCookieConfig());
      }

      this.redirectToCallback(res, isVerification, "kick");

    } catch (error) {
      // If verification fails, clean up any temporary data
      if (req.cookies.verification_session) {
        verificationCache.clearVerificationData(req.cookies.verification_session);
        res.clearCookie('verification_session');
      }
      this.handleError(error, res, startTime, 'Kick');
    }
  }

  async handleKickUserData(req, res) {
    try {
      const kickSessionToken = req.cookies.kick_session_token;
      const accessToken = req.cookies.kick_access_token;

      if (!kickSessionToken || !accessToken) {
        return res.status(401).json({
          success: false,
          message: "No Kick session found"
        });
      }

      // First get basic user data from Kick API
      this.kickClient.setAccessToken(accessToken);
      const response = await this.kickClient.getUsers();

      if (!response || !response.data || !response.data[0]) {
        return res.status(404).json({
          success: false,
          message: "No Kick user data found"
        });
      }

      const basicUserData = response.data[0];

      // Then fetch detailed user data using kickService
      try {
        const detailedUserData = await fetchKickUserData(basicUserData.name);
        console.log("Detailed Kick user data:", detailedUserData);

        return res.json({
          success: true,
          user: detailedUserData
        });
      } catch (kickServiceError) {
        logger.error("Error fetching detailed Kick user data", {
          error: kickServiceError.message,
          userId: basicUserData.user_id,
          username: basicUserData.name
        });

        // If the detailed fetch fails, return the basic user data as fallback
        return res.json({
          success: true,
          user: basicUserData
        });
      }

    } catch (error) {
      logger.error("Error getting Kick user data", {
        error: error.message
      });
      return res.status(500).json({
        success: false,
        message: "Error getting user data"
      });
    }
  }

  async handleKickRefresh(req, res) {
    try {
      const userId = this.getUserIdFromToken(req.cookies.kick_session_token);
      const sessionTokens = await getKickSessionTokens(userId);

      const response = await this.kickClient.getAccessToken({
        grantType: 'refresh_token',
        refreshToken: sessionTokens.refresh_token
      });

      // Save new session data
      const expiresAt = new Date(Date.now() + response.expires_in * 1000);
      await saveKickSession(response, { id: userId }, expiresAt);

      // Update cookies
      res.cookie('kick_access_token', response.access_token, getAccessTokenCookieConfig());
      res.cookie('kick_refresh_token', response.refresh_token, getRefreshTokenCookieConfig());

      res.json(response);
    } catch (error) {
      logger.error("Kick token refresh error", {
        error: error.message
      });
      res.status(500).json({ error: "Failed to refresh token" });
    }
  }

  async handleKickLogout(req, res) {
    try {
      const token = req.body.token;

      if (!token) {
        return res.status(400).json({ error: "Token is required for revocation" });
      }

      // Revoke the Kick token
      await this.kickClient.revokeToken(token);

      // Optionally, clear Kick cookies here (if not already done in global logout)
      res.clearCookie('kick_access_token', { path: '/' });
      res.clearCookie('kick_refresh_token', { path: '/' });
      res.clearCookie('kick_session_token', { path: '/' });

      res.json({ success: true, message: "Kick logged out successfully" });
    } catch (error) {
      logger.error("Kick token revocation error", { error: error.message });
      res.status(500).json({ error: "Failed to revoke Kick token" });
    }
  }

  async handleVerifyKickToken(req, res) {
    try {
      const accessToken = req.cookies.kick_access_token;

      if (!accessToken) {
        return res.status(401).json({
          isValid: false,
          message: "No Kick access token found"
        });
      }

      // Set token and verify by making a request
      this.kickClient.setAccessToken(accessToken);
      const response = await this.kickClient.getUsers();

      return res.json({
        isValid: true,
        user: response.data[0],
        platform: 'kick'
      });
    } catch (error) {
      logger.error("Kick token verification error", {
        error: error.message
      });

      return res.status(401).json({
        isValid: false,
        message: "Token verification failed"
      });
    }
  }

  // X Authentication Handlers
  handleXLogin(req, res) {
    const state = `xlogin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { url, codeVerifier } = this.xAuth.getAuthorizationUrl(state);
    this.pendingAuth.set(state, { codeVerifier });
    res.redirect(url);
  }

  async handleXCallback(req, res) {
    const { code, state } = req.query;
    const pending = this.pendingAuth.get(state);
    if (!pending) {
      return res.status(400).send("Invalid state");
    }
    this.pendingAuth.delete(state);

    try {
      const tokens = await this.xAuth.getToken(code, pending.codeVerifier);
      const userData = await this.xAuth.getUserData(tokens.access_token);
      const sessionToken = generateSessionToken(userData.id);
      await saveXSession(userData.id, tokens);
      res.cookie('session_token', sessionToken, getSessionCookieConfig());
      res.redirect('/dashboard'); // Adjust redirect as needed
    } catch (error) {
      logger.error('X Callback Error:', error);
      res.status(500).send("Authentication failed");
    }
  }

  async handleXUserData(req, res) {
    const sessionToken = req.cookies.session_token;
    const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
    const tokens = await getXSessionTokens(decoded.user_id);
    if (!tokens) {
      return res.status(401).send("Unauthorized");
    }
    try {
      const userData = await this.xAuth.getUserData(tokens.access_token);
      res.json(userData);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        try {
          const newTokens = await this.xAuth.refreshToken(tokens.refresh_token);
          await saveXSession(decoded.user_id, newTokens);
          const userData = await this.xAuth.getUserData(newTokens.access_token);
          res.json(userData);
        } catch (refreshError) {
          logger.error('X Refresh Error:', refreshError);
          res.status(401).send("Unauthorized");
        }
      } else {
        logger.error('X User Data Error:', error);
        res.status(500).send("Failed to fetch user data");
      }
    }
  }

  async handleXRefresh(req, res) {
    const sessionToken = req.cookies.session_token;
    const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
    const tokens = await getXSessionTokens(decoded.user_id);
    if (!tokens) {
      return res.status(401).send("Unauthorized");
    }
    try {
      const newTokens = await this.xAuth.refreshToken(tokens.refresh_token);
      await saveXSession(decoded.user_id, newTokens);
      res.json({ message: "Token refreshed" });
    } catch (error) {
      logger.error('X Refresh Error:', error);
      res.status(500).send("Failed to refresh token");
    }
  }

  async handleXLogout(req, res) {
    const sessionToken = req.cookies.session_token;
    const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
    await deleteXSession(decoded.user_id);
    res.clearCookie('session_token');
    res.json({ message: "Logged out" });
  }

  // Shared Data Handlers
  // Add a combined verification route for both platforms
  async handleVerifyAllTokens(req, res) {
    try {
      const results = {
        twitch: { isValid: false },
        kick: { isValid: false }
      };

      // Verify Twitch
      if (req.cookies.access_token) {
        try {
          const isValid = await this.twitchAuth.validateToken(req.cookies.access_token);
          if (isValid) {
            this.twitchClient = new TwitchAPIClient({
              accessToken: req.cookies.access_token
            });
            const userData = await this.twitchClient.getCurrentUser();
            results.twitch = { isValid: true, user: userData };
          }
        } catch (error) {
          logger.error("Twitch verification failed", { error: error.message });
        }
      }

      // Verify Kick
      if (req.cookies.kick_access_token) {
        try {
          this.kickClient.setAccessToken(req.cookies.kick_access_token);
          const response = await this.kickClient.getUsers();
          results.kick = { isValid: true, user: response.data[0] };
        } catch (error) {
          logger.error("Kick verification failed", { error: error.message });
        }
      }

      return res.json({
        results,
        isAnyValid: results.twitch.isValid || results.kick.isValid
      });
    } catch (error) {
      logger.error("Token verification error", {
        error: error.message
      });

      return res.status(500).json({
        error: "Token verification failed",
        message: error.message
      });
    }
  }

  async handleSaveData(req, res) {
    const startTime = Date.now();

    try {
      const { twitchData, kickData } = req.body;

      let result;
      if (twitchData && kickData) {
        result = await saveCombinedUserData(twitchData, kickData);
      } else if (twitchData) {
        result = await saveTwitchUserData(twitchData);
      } else if (kickData) {
        result = await saveKickUserData(kickData);
      } else {
        throw new Error('No data provided for saving');
      }

      res.json({
        success: true,
        user: result,
        isAuthenticated: true
      });
    } catch (error) {
      logger.error('Save operation failed', {
        error: error.message,
        duration: Date.now() - startTime
      });

      res.status(500).json({
        success: false,
        message: "Error saving user data",
        isAuthenticated: false
      });
    }
  }

  handleLogout(req, res) {
    const accessTokenConfig = getAccessTokenCookieConfig();
    const refreshTokenConfig = getRefreshTokenCookieConfig();

    // Revoke Twitch tokens
    const twitchAccessToken = req.cookies.access_token;
    const twitchRefreshToken = req.cookies.refresh_token;
    if (twitchAccessToken && twitchRefreshToken) {
      this.twitchAuth.revokeToken(twitchAccessToken)
        .catch(error => {
          logger.error("Failed to revoke Twitch token", { error: error.message });
        });
    }

    // Revoke Kick tokens
    const kickAccessToken = req.cookies.kick_access_token;
    const kickRefreshToken = req.cookies.kick_refresh_token;
    if (kickAccessToken && kickRefreshToken) {
      this.kickClient.revokeToken(kickAccessToken)
        .catch(error => {
          logger.error("Failed to revoke Kick token", { error: error.message });
        });
    }

    // Clear Twitch cookies
    ['access_token', 'refresh_token', 'session_token'].forEach(cookie => {
      res.clearCookie(cookie, {
        path: '/',
        domain: accessTokenConfig.domain
      });
    });

    // Clear Kick cookies
    ['kick_access_token', 'kick_refresh_token', 'kick_session_token'].forEach(cookie => {
      res.clearCookie(cookie, {
        path: '/',
        domain: accessTokenConfig.domain
      });
    });

    res.json({ success: true, message: "Logged out successfully" });
  }

  // Helper Methods
  getUserIdFromToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.user_id;
    } catch (error) {
      throw new Error('Invalid session token');
    }
  }

  // Helper Methods
  cleanupPendingAuth() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, value] of this.pendingAuth.entries()) {
      if (value.timestamp < fiveMinutesAgo) {
        this.pendingAuth.delete(key);
      }
    }
  }

  redirectToCallback(res, isVerification, platform) {
    const redirectBase = process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL
      : process.env.BACKEND_URL;
  
    const redirectPath = isVerification 
      ? `auth/?auth_flow=verified&platform=${platform}` 
      : `auth/redirect?platform=${platform}`;
  
    res.redirect(`${redirectBase}/${redirectPath}`);
  }

  redirectToError(res) {
    const redirectBase = process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL
      : process.env.BACKEND_URL;

    return res.redirect(`${redirectBase}/auth/error`);
  }

  handleError(error, res, startTime, platform) {
    logger.error(`${platform} callback error`, {
      error: error.message,
      duration: Date.now() - startTime
    });
    this.redirectToError(res);
  }

  generateKickSessionToken(userId) {
    // Implement your Kick session token generation logic here
    return generateSessionToken(userId);
  }
}

// Create and export router instance
const streamingAuthRouter = new StreamingAuthRouter();
export default streamingAuthRouter.router;