// src/models/Session.mjs
import { connectionB } from '../services/mongo.mjs';
import mongoose from 'mongoose';
import logger from "../middlewares/logger.mjs";

const sessionSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  access_token: { type: String, required: true },
  refresh_token: { type: String, required: true },
  expires_at: { type: Date, required: true },
  platform: { type: String, required: true, enum: ['twitch', 'kick', 'x'] },
}, {
  timestamps: true,
  versionKey: false
});

// Compound index for faster lookups
sessionSchema.index({ user_id: 1, platform: 1 }, { unique: true });

// Add logging to session operations
sessionSchema.post('save', function(doc) {
  const maskedToken = doc.access_token ? `${doc.access_token.substring(0, 5)}...` : 'undefined';
  logger.info(`Session saved for user ${doc.user_id} on platform ${doc.platform}`, {
    timestamp: new Date().toISOString(),
    currentUser: 'KickTools',
    platform: doc.platform,
    expires: doc.expires_at
  });
});

// Error logging
sessionSchema.post('save', function(error, doc, next) {
  if (error) {
    logger.error(`Error saving session: ${error.message}`, {
      userId: doc?.user_id,
      platform: doc?.platform,
      timestamp: new Date().toISOString(),
      currentUser: 'KickTools'
    });
  }
  next(error);
});

// Create the Session model using connectionB
export const Session = connectionB.model('Session', sessionSchema, 'ape-user-sessions');