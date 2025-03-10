// src/models/Analytics.mjs
import { connectionB } from '../services/mongo.mjs';
import mongoose from 'mongoose';
import logger from "../middlewares/logger.mjs";

const verifyViewerStatsSchema = new mongoose.Schema({
  totalViewers: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const verifyViewerDailyStatsSchema = new mongoose.Schema({
    date: { type: String, required: true },
    viewersAdded: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Single index definition for date
verifyViewerDailyStatsSchema.index({ date: 1 }, { unique: true });

// Utility methods
verifyViewerStatsSchema.statics.getStats = async function() {
  try {
    const stats = await this.findOne();
    return stats || await this.create({});
  } catch (error) {
    logger.error(`Failed to get global stats: ${error.message}`);
    throw error;
  }
};

verifyViewerDailyStatsSchema.statics.getDailyStats = async function(date) {
  try {
    const stats = await this.findOne({ date });
    return stats || await this.create({ date });
  } catch (error) {
    logger.error(`Failed to get daily stats for ${date}: ${error.message}`);
    throw error;
  }
};

// Create models using connectionB (the Ape Gang database connection)
export const VerifyViewerGlobalStats = connectionB.model(
  'VerifyViewerGlobalStats', 
  verifyViewerStatsSchema,
  'ape-globalStats'
);

export const VerifyViewerDailyStats = connectionB.model(
  'VerifyViewerDailyStats', 
  verifyViewerDailyStatsSchema,
  'ape-dailyStats'
);