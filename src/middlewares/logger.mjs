import winston from "winston";
import "winston-daily-rotate-file";

const transport = new winston.transports.DailyRotateFile({
  filename: "logs/application-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d"
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [transport]
});

export function logUserActivity(req, res, next) {
  const userId = req.user ? req.user.id : "guest";
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || (req.connection?.socket ? req.connection.socket.remoteAddress : null) || 'unknown';
  logger.info(`${req.method} ${req.url} accessed by ${userId} from IP: ${ip}`);
  next();
}

export default logger;