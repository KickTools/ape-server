import mongoose from 'mongoose';
import logger from '../middlewares/logger.mjs';

const streamAnalyticsSchema = new mongoose.Schema({
    channel_id: { type: Number, required: true },
    chatroom_id: { type: Number, required: true },
    date: { type: Date, required: true },
    stream_stats: {
        total_live_time: { type: Number, default: 0 },
        peak_viewers: { type: Number, default: 0 },
        total_followers_gained: { type: Number, default: 0 },
        total_subscribers: { type: Number, default: 0 },
        gifted_subs: { type: Number, default: 0 },
        last_stream_start: { type: Date, default: null },
        last_stream_end: { type: Date, default: null },
        current_session_id: { type: String, default: null },
        session_title: { type: String, default: null },
        is_live: { type: Boolean, default: false },
        total_chat_messages: { type: Number, default: 0 },
        unique_chatters: { type: Number, default: 0 }
    },
    subscription_events: [{
        event_type: { type: String },
        timestamp: { type: Date },
        quantity: { type: Number },
        username: { type: String, default: null },
        gifter_username: { type: String, default: null },
        giftee_usernames: { type: [String], default: [] }
    }],
    hosting_events: [{
        host_username: { type: String },
        viewers_brought: { type: Number },
        optional_message: { type: String, default: null },
        timestamp: { type: Date }
    }]
}, {
    timestamps: true,
    versionKey: false
});

// Index for efficient querying
streamAnalyticsSchema.index({ chatroom_id: 1, channel_id: 1, date: 1 }, { unique: true });

// Pre-save middleware
streamAnalyticsSchema.pre('save', function(next) {
    logger.info(`Attempting to save stream analytics for channel: ${this.channel_id}, date: ${this.date}`);
    next();
});

// Post-save middleware
streamAnalyticsSchema.post('save', function(doc) {
    logger.info(`Stream analytics saved successfully for channel: ${doc.channel_id}, date: ${doc.date}`);
});

// Error handling middleware
streamAnalyticsSchema.post('save', function(error, doc, next) {
    logger.error(`Error saving stream analytics for channel: ${doc.channel_id}, date: ${doc.date}: ${error.message}`);
    next(error);
});

export const StreamAnalytics = mongoose.model('StreamAnalytics', streamAnalyticsSchema, "kick-stream_analytics");