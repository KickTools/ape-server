// src/middlewares/tokenAuth.mjs
import jwt from 'jsonwebtoken';
import { encrypt, decrypt } from '../utils/encryption.mjs';
import logger from './logger.mjs';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export const generateTokens = (userData, twitchRefreshToken) => {
  const accessToken = jwt.sign(
    { user: userData, type: 'access' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    {
      userId: userData.id,
      type: 'refresh',
      twitchRefreshToken: encrypt(twitchRefreshToken)
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (req, res, next) => {
  const startTime = Date.now();
  const token = req.cookies.access_token;
  
  if (!token) {
    logger.warn('Access token missing from request');
    return res.status(401).json({ success: false, message: "Access token missing" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'access') {
      logger.warn('Invalid token type for access token');
      return res.status(401).json({ success: false, message: "Invalid token type" });
    }

    req.user = decoded.user;
    req.accessToken = token;
    
    next();
  } catch (error) {
    logger.error('Access token verification failed', {
      error: error.name,
      duration: Date.now() - startTime
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: "Token expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

export const verifyRefreshToken = (req, res, next) => {
  const startTime = Date.now();
  const token = req.cookies.refresh_token;
  
  if (!token) {
    logger.warn('Refresh token missing from request');
    return res.status(401).json({ success: false, message: "Refresh token missing" });
  }

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      logger.warn('Invalid token type for refresh token');
      return res.status(401).json({ success: false, message: "Invalid token type" });
    }

    req.user = { ...req.user, userId: decoded.userId };
    req.twitchRefreshToken = decrypt(decoded.twitchRefreshToken);
    
    next();
  } catch (error) {
    logger.error('Refresh token verification failed', {
      error: error.name,
      duration: Date.now() - startTime
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: "Token expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

export const verifyTwitchTokens = async (req, res, next) => {
  const startTime = Date.now();
  try {
    if (!req.twitchAccessToken || !req.twitchRefreshToken) {
      logger.warn('Missing Twitch tokens');
      return res.status(401).json({ success: false, message: "Twitch tokens missing" });
    }
    
    next();
  } catch (error) {
    logger.error('Twitch token verification failed', {
      error: error.message,
      duration: Date.now() - startTime
    });
    return res.status(401).json({ success: false, message: "Invalid Twitch tokens" });
  }
};