import jwt from "jsonwebtoken";
import logger from '../middlewares/logger.mjs';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error("JWT_SECRET is not defined in the environment variables!");
}

export function generateToken(user) {
  try {
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in the environment variables!");
    }
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "1h" });
    return token;
  } catch (error) {
    logger.error(`Error generating token: ${error.message}`);
    return null; // Or throw the error, depending on your error handling strategy
  }
}

export function verifyToken(token) {
  try {
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in the environment variables!");
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    logger.warn(`Token verification failed: ${error.message}`);
    return null;
  }
}