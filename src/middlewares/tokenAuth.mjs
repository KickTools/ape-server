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
  const token = req.cookies.access_token;
  
  if (!token) {
    return res.status(401).json({ success: false, message: "Access token missing" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'access') {
      return res.status(401).json({ success: false, message: "Invalid token type" });
    }

    req.user = decoded.user;
    next();
  } catch (error) {
    logger.error('JWT access token verification error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: "Token expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

export const verifyRefreshToken = (req, res, next) => {
  const token = req.cookies.refresh_token;
  
  if (!token) {
    return res.status(401).json({ success: false, message: "Refresh token missing" });
  }

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: "Invalid token type" });
    }

    req.user = { userId: decoded.userId };
    req.twitchRefreshToken = decrypt(decoded.twitchRefreshToken);
    next();
  } catch (error) {
    logger.error('JWT refresh token verification error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: "Token expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// Platform-specific token handlers
export const verifyTwitchTokens = async (req, res, next) => {
  try {
    if (!req.twitchAccessToken || !req.twitchRefreshToken) {
      return res.status(401).json({ success: false, message: "Twitch tokens missing" });
    }
    // Add any Twitch-specific token validation logic here
    next();
  } catch (error) {
    logger.error('Twitch token verification error:', error);
    return res.status(401).json({ success: false, message: "Invalid Twitch tokens" });
  }
};