// src/middlewares/adminAuth.mjs
import logger from "./logger.mjs";

export const requireAdminOrWebmaster = (req, res, next) => {
  const allowedRoles = ["admin", "webmaster", "owner"];
  if (!allowedRoles.includes(req.user.role)) {
    logger.warn("Unauthorized access attempt to admin route", {
      userId: req.user.user_id,
      platform: req.user.platform,
      role: req.user.role,
      method: req.method,
      path: req.path,
      requestId: req.requestId
    });
    return res.status(403).json({ success: false, message: "Admin or Webmaster access required" });
  }
  next();
};

// Check if user is webmaster or owner
export const requireWebmasterOrOwner = (req, res, next) => {
  const allowedRoles = ["webmaster", "owner"];
  if (!allowedRoles.includes(req.user.role)) {
    logger.warn("Unauthorized attempt to modify user roles", {
      userId: req.user.user_id,
      role: req.user.role,
      method: req.method,
      path: req.path,
      requestId: req.requestId
    });
    return res.status(403).json({ 
      success: false, 
      message: "Only Webmaster or Owner can modify user roles" 
    });
  }
  next();
};