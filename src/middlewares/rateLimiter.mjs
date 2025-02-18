import rateLimit from 'express-rate-limit';
import logger from './logger.mjs';

export const kickRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 250, // Limit each IP to 250 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}, endpoint: ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  }
});