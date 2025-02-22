// src/utils/auth.mjs
import jwt from "jsonwebtoken";
import { Session } from "../models/Session.mjs";
import logger from "../middlewares/logger.mjs";
import { encrypt, decrypt } from './encryption.mjs';

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-for-testing";

export const generateSessionToken = (userId) => {
    if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined");
    const payload = {
        user_id: userId,
        iat: Math.floor(Date.now() / 1000), // Issued Time
        exp: Math.floor(Date.now() / 1000) + 1 * 60 * 60 // Expires in 1 hour
    };
    return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
};

export const getSessionCookieConfig = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 1 * 60 * 60 * 1000, // 1 hour
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
