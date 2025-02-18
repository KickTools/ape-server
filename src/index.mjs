import "dotenv/config";
import express from "express";
import session from "express-session";
import { logUserActivity } from "./middlewares/logger.mjs";
import authRoutes from "./routes/authRoute.mjs";
import kickRoutes from "./routes/kickRoute.mjs";
import dataReviewRoute from "./routes/dataReviewRoute.mjs";
import dataSubmitRoute from "./routes/dataSubmitRoute.mjs";
import { connectMongo } from "./services/mongo.mjs";
import logger from "./middlewares/logger.mjs";
import { kickRateLimiter } from "./middlewares/rateLimiter.mjs";
import cookieParser from 'cookie-parser';
import cors from "cors";

const app = express();

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
  })
  .catch((err) => {
    logger.error("Failed to connect to MongoDB", err);
    process.exit(1); // Exit the process with failure
  });

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false, 
    saveUninitialized: true,
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

// Routes
app.use(authRoutes); // Assuming account creation happens in authRoutes


app.use("/data/retrieve", dataReviewRoute);
app.use("/data/submit", dataSubmitRoute);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).send("Something went wrong!");
});

const PORT = process.env.PORT || 9988;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));