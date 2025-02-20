import winston from "winston";
import "winston-daily-rotate-file";

// File transport for rotating logs
const fileTransport = new winston.transports.DailyRotateFile({
  filename: "logs/application-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  level: "info"  // Keep file logging at info level
});

// Console transport for development
const consoleTransport = new winston.transports.Console({
  level: "debug",  // Show debug messages in console
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      let msg = `${timestamp} ${level}: ${message}`;
      if (Object.keys(metadata).length > 0) {
        msg += `\n${JSON.stringify(metadata, null, 2)}`;
      }
      return msg;
    })
  )
});

// Create the logger
const logger = winston.createLogger({
  level: "debug",  // Set overall lowest level to debug
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),  // Include stack traces
    winston.format.json()
  ),
  transports: [
    fileTransport,
    consoleTransport
  ]
});

// User activity logging middleware
export function logUserActivity(req, res, next) {
  const userId = req.user ? req.user.id : "guest";
  const ip = req.ip || 
             req.connection?.remoteAddress || 
             req.socket?.remoteAddress || 
             (req.connection?.socket ? req.connection.socket.remoteAddress : null) || 
             'unknown';
  
  // Log basic info
  logger.info(`${req.method} ${req.url} accessed by ${userId} from IP: ${ip}`);
 
  next();
}

// Add convenience methods for structured logging
logger.logApiRequest = (req, status, duration) => {
  logger.info(`API Request: ${req.method} ${req.url}`, {
    status,
    duration,
    userId: req.user?.id,
    ip: req.ip
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

export default logger;