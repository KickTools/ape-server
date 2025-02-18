// src/routes/authRoute.mjs
import { Router } from "express";
import { fetchUserData, fetchChannelFollowers } from "../utils/twitchApi.mjs";
import { saveCombinedUserData } from "../utils/saveUserData.mjs";
import {
  getAuthorizationUrl,
  getTokens,
  refreshTokenAccess
} from "../utils/twitchAuth.mjs";
import { encrypt, decrypt } from "../utils/encryption.mjs";
import { getViewerByUserId } from "../utils/dataReview.mjs";
import logger from "../middlewares/logger.mjs";

const router = Router();

// Regular login endpoint
router.get("/auth/login", (req, res) => {
  const state = `login_${req.sessionID}`;
  const authorizationUrl = getAuthorizationUrl(state, "login"); // Pass login scope
  res.redirect(authorizationUrl);
});

// Unified callback handler
router.get("/auth/twitch/callback", async (req, res) => {
  try {
    console.log("\n=== START CALLBACK ===");
    console.log("Session ID:", req.sessionID);
    console.log("Initial Session:", req.session);

    const authorizationCode = req.query.code;
    const state = req.query.state;
    const isLoginFlow = state?.startsWith("login_");

    const tokens = await getTokens(authorizationCode);
    console.log("Got Tokens: ", tokens);

    const userData = await fetchUserData(tokens.access_token);
    console.log("Got User Data: ", userData);

    const followerCount = await fetchChannelFollowers(
      tokens.access_token,
      userData.id
    );
    console.log("Got Follower Count: ", followerCount);

    userData.followers_count = followerCount;

    console.log("Before setting session:", req.session);
    
    // Store in session
    req.session.twitchData = {
      user: userData,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    };

    // Explicitly save the session
    req.session.save((err) => {
      if (err) {
        console.log("Session save error:", err);
      } else {
        console.log("Session after save:", req.session);
      }
    });

    console.log("Session after setting data:", req.session);

    // Force session save
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          reject(err);
        }
        resolve();
      });
    });

    console.log("Session after save:", req.session);

    if (isLoginFlow) {
      const existingViewer = await getViewerByUserId("twitch", userData.id);

      if (existingViewer) {
        console.log("=== END CALLBACK (existing user) ===\n");
        res.redirect(
          `http://localhost:3000/login/callback?sessionId=${req.sessionID}`
        );
      } else {
        console.log("=== END CALLBACK (new user) ===\n");
        res.redirect(`http://localhost:3000/connect`);
      }
    } else {
      console.log("=== END CALLBACK (connect flow) ===\n");
      res.redirect(
        `http://localhost:3000/connect/callback?sessionId=${req.sessionID}`
      );
    }
  } catch (error) {
    console.error("Error in callback:", error);
    res.status(500).json({
      success: false,
      message: "Error processing Twitch callback",
      error: error.message
    });
  }
});

router.get("/auth/twitch", (req, res) => {
  const state = req.sessionID;
  const authorizationUrl = getAuthorizationUrl(state);
  res.redirect(authorizationUrl);
});

router.get("/auth/twitch/session-data", (req, res) => {
  console.log("\n=== SESSION DATA REQUEST ===");
  console.log("Session ID:", req.sessionID);
  console.log("Full Session:", req.session);
  console.log("Session twitchData:", req.session?.twitchData);

  if (!req.session?.twitchData) {
    console.log("=== NO SESSION DATA FOUND ===\n");
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

  console.log("=== SENDING SESSION DATA ===\n");
  return res.json({
    success: true,
    ...twitchData
  });
});

router.get("/OLDauth/twitch/callback", async (req, res) => {
  try {
    const authorizationCode = req.query.code;

    const tokens = await getTokens(authorizationCode);
    const userData = await fetchUserData(tokens.access_token);
    const followerCount = await fetchChannelFollowers(
      tokens.access_token,
      userData.id
    );

    userData.followers_count = followerCount;

    req.session.twitchData = {
      user: userData,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    };

    res.redirect(
      `http://localhost:3000/connect/callback?sessionId=${req.sessionID}`
    );
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user data",
      error: error.message
    });
  }
});

router.post("/auth/save", async (req, res) => {
  const { twitchData, kickData } = req.body;

  try {
    const result = await saveCombinedUserData(twitchData, kickData);
    res.json({ success: true, message: "User data saved", user: result });
  } catch (error) {
    console.error("Error saving user data:", error);
    res.status(500).json({
      success: false,
      message: "Error saving user data",
      error: error.message
    });
  }
});

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
    console.error("Error refreshing token:", error);
    res.status(500).json({
      success: false,
      message: "Error refreshing token",
      error: error.message
    });
  }
});

router.get("/auth/failure", (req, res) => {
  res.status(401).json({ success: false, message: "Authentication failed" });
});

export default router;
