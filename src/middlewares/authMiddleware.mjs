// src/middlewares/authMiddleware.mjs
import jwt from 'jsonwebtoken';
import { getKickSessionTokens, saveKickSession, getTwitchSessionTokens, saveTwitchSession } from '../utils/auth.mjs';
import { statsCache, TOKEN_CACHE_KEY_PREFIX, CACHE_TTL_SECONDS } from '../utils/cache.mjs';
import logger from '../middlewares/logger.mjs';

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-for-testing";

const authMiddleware = async (req, res, next) => {
  try {
    const sessionToken = req.cookies.kick_session_token || req.cookies.twitch_session_token;
    if (!sessionToken) {
      logger.error('Unauthorized access attempt: Missing session token');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { user_id } = jwt.verify(sessionToken, JWT_SECRET);
    const platform = req.cookies.kick_session_token ? 'kick' : 'twitch';

    // Check cache first
    const cacheKey = `${TOKEN_CACHE_KEY_PREFIX}${platform}:${user_id}`;
    let tokens = statsCache.get(cacheKey);

    if (!tokens) {
      // Fetch tokens from database if not in cache
      tokens = platform === 'kick' ? await getKickSessionTokens(user_id) : await getTwitchSessionTokens(user_id);

      // Store tokens in cache
      statsCache.set(cacheKey, tokens, tokens.expires_in - 60);
    }

    if (new Date(tokens.expires_at) < new Date()) {
      const newTokens = platform === 'kick'
        ? await kickAuth.refreshToken(tokens.refresh_token)
        : await twitchAuth.refreshToken(tokens.refresh_token);

      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      platform === 'kick'
        ? await saveKickSession(newTokens, { user_id }, expiresAt)
        : await saveTwitchSession(newTokens, { user_id }, expiresAt);

      // Update cache with new tokens
      statsCache.set(cacheKey, newTokens, newTokens.expires_in - 60);

      req.accessToken = newTokens.access_token;
    } else {
      req.accessToken = tokens.access_token;
    }

    next();
  } catch (error) {
    logger.error('Authentication error', { error: error.message });
    res.status(401).json({ error: 'Unauthorized' });
  }
};

export default authMiddleware;