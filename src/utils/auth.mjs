// src/utils/auth.mjs
import jwt from "jsonwebtoken";
import { Session } from "../models/Session.mjs";
import logger from "../middlewares/logger.mjs";
import { encrypt, decrypt } from './encryption.mjs';

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-for-testing";
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;
const SEVEN_DAYS_IN_MS = SEVEN_DAYS_IN_SECONDS * 1000;

export const generateSessionToken = (userId) => {
    if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined");
    const payload = {
        user_id: userId,
        iat: Math.floor(Date.now() / 1000), // Issued Time
        exp: Math.floor(Date.now() / 1000) + SEVEN_DAYS_IN_SECONDS // Expires in 7 days
    };
    return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
};

export const getSessionCookieConfig = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SEVEN_DAYS_IN_MS, // 7 days
});

export const saveTwitchSession = async (tokens, userData, expiresAt) => {
    try {
        const encryptedAccessToken = encrypt(tokens.access_token);
        const encryptedRefreshToken = encrypt(tokens.refresh_token);

        const session = await Session.findOneAndUpdate(
            { user_id: userData.id },
            {
                user_id: userData.id,
                access_token: encryptedAccessToken,
                refresh_token: encryptedRefreshToken,
                expires_at: expiresAt,
                platform: "twitch",
            },
            { upsert: true, new: true }
        );

        return session;
    } catch (error) {
        logger.error("Failed to save Twitch session", { error: error.message, userId: userData.id });
        throw error;
    }
};

export const getTwitchSessionTokens = async (userId) => {
    try {
        const session = await Session.findOne({ user_id: userId });
        if (!session) {
            throw new Error("Session not found");
        }

        const decryptedAccessToken = decrypt(session.access_token);
        const decryptedRefreshToken = decrypt(session.refresh_token);

        return {
            access_token: decryptedAccessToken,
            refresh_token: decryptedRefreshToken,
            expires_at: session.expires_at,
        };
    } catch (error) {
        logger.error("Failed to retrieve Twitch session tokens", { error: error.message, userId });
        throw error;
    }
};

export const saveKickSession = async (tokens, userData, expiresAt) => {
    try {
        const encryptedAccessToken = encrypt(tokens.access_token);
        const encryptedRefreshToken = encrypt(tokens.refresh_token);

        const session = await Session.findOneAndUpdate(
            { user_id: userData.user_id },
            {
                user_id: userData.user_id,
                access_token: encryptedAccessToken,
                refresh_token: encryptedRefreshToken,
                expires_at: expiresAt,
                platform: "kick",
            },
            { upsert: true, new: true }
        );

        return session;
    } catch (error) {
        logger.error("Failed to save Kick session", { error: error.message, userId: userData.id });
        throw error;
    }
};

export const getKickSessionTokens = async (userId) => {
    try {
        const session = await Session.findOne({ user_id: userId });
        if (!session) {
            throw new Error("Session not found");
        }

        const decryptedAccessToken = decrypt(session.access_token);
        const decryptedRefreshToken = decrypt(session.refresh_token);

        return {
            access_token: decryptedAccessToken,
            refresh_token: decryptedRefreshToken,
            expires_at: session.expires_at,
        };
    } catch (error) {
        logger.error("Failed to retrieve Kick session tokens", { error: error.message, userId });
        throw error;
    }
};

export async function saveXSession(userId, tokens) {
    try {
      const encryptedAccessToken = encrypt(tokens.access_token);
      const encryptedRefreshToken = encrypt(tokens.refresh_token);
      
      const session = await Session.findOneAndUpdate(
        { user_id: userId, platform: 'x' },
        {
          user_id: userId,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000),
          platform: 'x'
        },
        { upsert: true, new: true }
      );
      
      logger.info(`X session saved for user ${userId}`, {
        timestamp: new Date().toISOString(),
        currentUser: 'KickTools'
      });
      
      return session;
    } catch (error) {
      logger.error(`Failed to save X session: ${error.message}`, {
        userId,
        timestamp: new Date().toISOString(),
        currentUser: 'KickTools',
        stack: error.stack
      });
      throw error;
    }
  }
  
  export async function getXSessionTokens(userId) {
    try {
      const session = await Session.findOne({ user_id: userId, platform: 'x' });
      
      if (!session) {
        logger.warn(`No X session found for user ${userId}`, {
          timestamp: new Date().toISOString(),
          currentUser: 'KickTools'
        });
        return null;
      }
      
      const decryptedAccessToken = decrypt(session.access_token);
      const decryptedRefreshToken = decrypt(session.refresh_token);
      
      return { 
        access_token: decryptedAccessToken, 
        refresh_token: decryptedRefreshToken,
        expires_at: session.expires_at
      };
    } catch (error) {
      logger.error(`Failed to get X session tokens: ${error.message}`, {
        userId,
        timestamp: new Date().toISOString(),
        currentUser: 'KickTools',
        stack: error.stack
      });
      throw error;
    }
  }

export async function deleteXSession(userId) {
  try {
    await Session.deleteOne({ user_id: userId, platform: 'x' });
    
    logger.info(`X session deleted for user ${userId}`, {
      timestamp: new Date().toISOString(),
      currentUser: 'KickTools'
    });
  } catch (error) {
    logger.error(`Failed to delete X session: ${error.message}`, {
      userId,
      timestamp: new Date().toISOString(),
      currentUser: 'KickTools',
      stack: error.stack
    });
    throw error;
  }
}