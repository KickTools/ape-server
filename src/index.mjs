// src/index.mjs
import "dotenv/config";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import cors from "cors";
import logger from "./middlewares/logger.mjs";
import authRoutes from "./routes/authRoute.mjs";
import kickRoutes from "./routes/kickRoute.mjs";
import leaderboardRoute from "./routes/leaderboardRoute.mjs";
import dataReviewRoute from "./routes/dataReviewRoute.mjs";
import dataSubmitRoute from "./routes/dataSubmitRoute.mjs";
import analyticsRoute from "./routes/analyticsRoute.mjs";
import { connectMongo } from "./services/mongo.mjs";
import { verifySessionToken } from "./middlewares/sessionAuth.mjs";
import { kickRateLimiter, leaderboardRateLimiter, analyticsRateLimiter } from "./middlewares/rateLimiter.mjs";
import { getAccessTokenCookieConfig } from "./utils/cookieConfig.mjs";
import { startLeaderboardScheduler } from "./schedulers/leaderboardScheduler.mjs";

const app = express();
const corsOrigins = [process.env.FRONTEND_URL, process.env.BACKEND_URL];

app.set("trust proxy", 1);
app.use(cookieParser());
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json()); // Add middleware to parse JSON bodies

// Performance monitoring middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // Store the request ID for correlation
  req.requestId = requestId;

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      // Only log requests taking more than 1 second
      logger.warn("Slow request detected", {
        requestId,
        method: req.method,
        path: req.path,
        duration,
        status: res.statusCode
      });
    }
  });

  next();
});

// Initialize MongoDB connection
connectMongo()
  .then(() => {
    logger.info("Database connection established");

    // Start the leaderboard scheduler after DB connection is successful
    startLeaderboardScheduler();
    logger.info("Leaderboard scheduler started");
  })
  .catch((err) => {
    logger.error("Database connection failed", {
      error: err.message
    });
    process.exit(1);
  });

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions"
    }),
    cookie: getAccessTokenCookieConfig()
  })
);

// Routes
app.use("/auth", authRoutes); // Apply to all /auth routes
app.use("/kick", kickRateLimiter, verifySessionToken, kickRoutes);
app.use("/leaderboard", leaderboardRateLimiter, leaderboardRoute); 
app.use("/analytics", analyticsRateLimiter, analyticsRoute);
app.use("/data/retrieve", verifySessionToken, dataReviewRoute);
app.use("/data/submit", verifySessionToken, dataSubmitRoute); 

// Error handling
app.use((err, req, res, next) => {
  const errorId = Math.random().toString(36).substring(7);

  logger.error("Unhandled error", {
    errorId,
    path: req.path,
    method: req.method,
    error: err.message,
    requestId: req.requestId
  });

  res.status(500).json({
    success: false,
    message: "Internal server error",
    errorId,
    ...(process.env.NODE_ENV === "development" ? { error: err.message } : {})
  });
});

// Global error handlers
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", {
    error: reason instanceof Error ? reason.message : reason
  });
  process.exit(1);
});

const PORT = process.env.PORT || 9988;
app.listen(PORT, () => {
  logger.info(`Server started`, {
    port: PORT,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});
