// src/index.mjs
import "dotenv/config";
import express from "express";
import session from "express-session";
import passport from "./config/passport.mjs";
import { logUserActivity } from "./middlewares/logger.mjs";
import authRoutes from "./routes/authRoute.mjs";
import kickRoutes from "./routes/kickRoute.mjs";
import dataReviewRoute from "./routes/dataReviewRoute.mjs";
import dataSubmitRoute from "./routes/dataSubmitRoute.mjs";
import { connectMongo } from "./services/mongo.mjs";
import logger from "./middlewares/logger.mjs";
import { kickRateLimiter } from "./middlewares/rateLimiter.mjs";
import cors from "cors";

const app = express();

// Enable CORS with proper configuration
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json()); // Add middleware to parse JSON bodies

// Initialize MongoDB connection
connectMongo()
  .then(() => {
    logger.info("Database initialized successfully");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1); // Exit the process with failure
  });

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: 'lax',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
app.use(logUserActivity);

// Apply rate limiter middleware to the Kick routes
app.use("/kick", kickRateLimiter, kickRoutes);

// Routes
app.use(authRoutes);
app.use("/data/retrieve", dataReviewRoute);
app.use("/data/submit", dataSubmitRoute);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).send("Something went wrong!");
});

const PORT = process.env.PORT || 9988;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));