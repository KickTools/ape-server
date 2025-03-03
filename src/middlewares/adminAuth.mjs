// src/middlewares/adminAuth.mjs
import logger from "./logger.mjs";

export const requireAdminOrWebmaster = (req, res, next) => {
  const allowedRoles = ["admin", "webmaster"];
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