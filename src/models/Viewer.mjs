// src/models/Viewer.mjs
import { connectionB } from "../services/mongo.mjs";
import mongoose from "mongoose";
import logger from "../middlewares/logger.mjs";
import { VerifyViewerGlobalStats, VerifyViewerDailyStats } from './Analytics.mjs';

const viewerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, enum: ["regular", "admin", "webmaster"], default: "regular" },
    giveaways: {type: mongoose.Schema.Types.ObjectId, ref: "ViewerGiveaways"},
    twitch: {
      user_id: { type: String },
      username: { type: String },
      verified: { type: Boolean, default: false },
      verified_at: { type: Date },
      session: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
      profile: { type: mongoose.Schema.Types.ObjectId, ref: "Profile" }
    },
    kick: {
      user_id: { type: String },
      username: { type: String },
      verified: { type: Boolean, default: false },
      verified_at: { type: Date },
      session: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
      profile: { type: mongoose.Schema.Types.ObjectId, ref: "Profile" }
    },
    x: {
      user_id: { type: String },
      username: { type: String },
      verified: { type: Boolean, default: false },
      verified_at: { type: Date },
      session: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
      profile: { type: mongoose.Schema.Types.ObjectId, ref: "Profile" }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

viewerSchema.index({ "twitch.username": 1 });
viewerSchema.index({ "kick.username": 1 });
viewerSchema.index({ "x.username": 1 });

// Pre-save middleware
viewerSchema.pre("save", function (next) {
  const doc = this;
  if (!doc.name) {
    logger.error(
      `Viewer name is required but missing for twitch user_id: ${doc.twitch?.user_id} and kick user_id: ${doc.kick?.user_id}`
    );
    return next(new Error("Viewer name is required"));
  }
  next();
});

// Post-save middleware for logging
viewerSchema.post("save", function (doc) {
  logger.info(
    `Viewer saved successfully with twitch username: ${doc.twitch?.username} and kick username: ${doc.kick?.username}`
  );
});

// Post-save middleware for error logging
viewerSchema.post("save", function (error, doc, next) {
  logger.error(
    `Error during Viewer save: ${error.message} for twitch username: ${doc.twitch?.username} and kick username: ${doc.kick?.username}`
  );
  next(error);
});

export const Viewer = connectionB.model(
  "Viewer",
  viewerSchema,
  "ape-users"
);