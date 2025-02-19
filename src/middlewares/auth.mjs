import jwt from 'jsonwebtoken';
import { decrypt } from '../utils/encryption.mjs';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

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

    req.user = decoded.user; // Attach user data to request object
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
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
    console.error('JWT verification error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: "Token expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};