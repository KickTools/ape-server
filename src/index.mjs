import "dotenv/config";
import express from "express";
import session from "express-session";
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import cors from "cors";
import logger, { logUserActivity } from "./middlewares/logger.mjs";
import authRoutes from "./routes/authRoute.mjs";
import kickRoutes from "./routes/kickRoute.mjs";
import dataReviewRoute from "./routes/dataReviewRoute.mjs";
import dataSubmitRoute from "./routes/dataSubmitRoute.mjs";
import analyticsRoute from "./routes/analyticsRoute.mjs";
import { connectMongo } from "./services/mongo.mjs";
import { kickRateLimiter } from "./middlewares/rateLimiter.mjs";
import { verifyAccessToken } from "./middlewares/auth.mjs";

const app = express();

// Configure Express to trust proxy headers
app.set('trust proxy', 1);

app.use(cookieParser());

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); // Add middleware to parse JSON bodies

// Initialize MongoDB connection
connectMongo()
  .then(() => {
    logger.info("Database initialized successfully");
    console.log("Database initialized successfully");
  })
  .catch((err) => {
    logger.error("Failed to connect to MongoDB", err);
    process.exit(1); // Exit the process with failure
  });

// Session middleware with MongoStore
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false, 
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'None', 
      domain: '.squadw.online', 
    }
  })
);

// Logging middleware
app.use(logUserActivity);

// Apply rate limiter middleware to the Kick routes
app.use("/kick", kickRateLimiter, kickRoutes);

// Public routes for authentication
app.use("/auth", authRoutes);

// Apply authentication middleware to protect the routes
app.use(verifyAccessToken); // Protect routes below this line
app.use("/data/retrieve", dataReviewRoute);
app.use("/data/submit", dataSubmitRoute);
app.use("/analytics", analyticsRoute);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).send("Something went wrong!");
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1); // Exit the process with failure
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1); // Exit the process with failure
});

const PORT = process.env.PORT || 9988;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));