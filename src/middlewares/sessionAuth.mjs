// src/middlewares/sessionAuth.mjs
import jwt from "jsonwebtoken";
import logger from "./logger.mjs";

export const verifySessionToken = (req, res, next) => {
  const twitchToken = req.cookies.twitch_session_token;
  const kickToken = req.cookies.kick_session_token;

  // Check if at least one session token is present
  const token = twitchToken || kickToken;
  if (!token) {
    logger.warn("No session token provided", {
      method: req.method,
      path: req.path,
      requestId: req.requestId,
    });
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    // Verify the token (either Twitch or Kick)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      user_id: decoded.user_id,
      platform: twitchToken ? "twitch" : "kick",
      role: decoded.role 
    };
    next();
  } catch (error) {
    logger.error("Invalid session token", {
      error: error.message,
      method: req.method,
      path: req.path,
      requestId: req.requestId,
    });
    res.clearCookie("twitch_session_token", { path: "/" });
    res.clearCookie("kick_session_token", { path: "/" });
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session token",
    });
  }
};