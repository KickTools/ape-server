// src/middlewares/rateLimiter.mjs
import rateLimit from "express-rate-limit";
import logger from "./logger.mjs";

export const kickRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 250, // 250 requests per window
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded`, {
      ip: req.ip, // Log the IP used for rate limiting
      endpoint: req.originalUrl,
      method: req.method,
    });
    res.status(options.statusCode).send(options.message);
  },
});

export const leaderboardRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per window
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  handler: (req, res, next, options) => {
    logger.warn(`Leaderboard rate limit exceeded`, {
      ip: req.ip,
      endpoint: req.originalUrl,
      method: req.method,
    });
    res.status(options.statusCode).send(options.message);
  },
});

export const analyticsRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: "Too many requests to analytics, please try again later.",
  },
  handler: (req, res, next, options) => {
    logger.warn(`Analytics rate limit exceeded`, {
      ip: req.ip,
      endpoint: req.originalUrl,
      method: req.method,
    });
    res.status(options.statusCode).send(options.message);
  },
});