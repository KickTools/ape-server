// src/models/Session.mjs
import mongoose from "mongoose";
import logger from "../middlewares/logger.mjs";

const sessionSchema = new mongoose.Schema(
    {
        user_id: { type: String, required: true },
        access_token: { type: String, required: true },
        refresh_token: { type: String, required: true },
        expires_at: { type: Date, required: true },
        platform: { type: String, required: true },
    },
    {
        timestamps: true,
        versionKey: false 
    }
);

sessionSchema.index({ user_id: 1 });

sessionSchema.pre("save", function (next) { 
    const doc = this;
    if (!doc.user_id) {
        logger.error("User ID is required but missing");
        return next(new Error("User ID is required"));
    }
    next();
}); 

sessionSchema.post("save", function (doc) {
    logger.info(`Session saved successfully for user ID: ${doc.user_id}`);
}); 

sessionSchema.post("save", function (error, doc, next) {
    logger.error(`Error during Session save: ${error.message} for user ID: ${doc?.user_id || "unknown"}`);
    next(error);
});

export const Session = mongoose.model("Session", sessionSchema, "verify_viewer_sessions");