import mongoose from 'mongoose';
import logger from '../middlewares/logger.mjs';
import { STREAMER } from '../constants/streamer.mjs';

const STREAMER_USERNAME = STREAMER.username;

const chatterLeaderboardSchema = new mongoose.Schema({
    user_id: { type: Number, required: true },
    username: { type: String, required: true },
    stats: {
        total_messages: { type: Number, default: 0 },
        streams_participated: { type: Number, default: 0 },
        unique_stream_dates: [Date],
        first_seen: { type: Date },
        last_seen: { type: Date }
    },
    rank: { type: Number },
    last_updated: { type: Date, default: Date.now }
}, {
    timestamps: true,
    versionKey: false
});

// Indexes
chatterLeaderboardSchema.index({ user_id: 1 }, { unique: true });
chatterLeaderboardSchema.index({ username: 1 });
chatterLeaderboardSchema.index({ 'stats.total_messages': -1 });
chatterLeaderboardSchema.index({ rank: 1 });

// Pre-save middleware to catch and log errors
chatterLeaderboardSchema.pre('save', function (next) {
    next(); // No validation logic needed here, just proceed
});

// Handle errors during save/update operations
chatterLeaderboardSchema.post('save', function (error, doc, next) {
    if (error) {
        logger.error('Error saving to ChatterLeaderboard', {
            collection: `${STREAMER_USERNAME}_chatter_leaderboard`,
            user_id: this.user_id,
            error: error.message,
            stack: error.stack
        });
        return next(); // Skip the error to prevent crashing
    }
    next();
});

// Handle errors during update operations
chatterLeaderboardSchema.post('updateOne', function (error, doc, next) {
    if (error) {
        logger.error('Error updating ChatterLeaderboard', {
            collection: `${STREAMER_USERNAME}_chatter_leaderboard`,
            user_id: this._update?.user_id || 'unknown',
            error: error.message,
            stack: error.stack
        });
        return next(); // Skip the error to prevent crashing
    }
    next();
});

export const ChatterLeaderboard = mongoose.model('ChatterLeaderboard', chatterLeaderboardSchema, `${STREAMER_USERNAME}_chatter_leaderboard`);