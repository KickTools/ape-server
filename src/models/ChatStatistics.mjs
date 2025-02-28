// src/models/ChatStatistics.mjs
import { connectionA } from '../services/mongo.mjs';
import mongoose from 'mongoose';
import logger from '../middlewares/logger.mjs';

const chatStatisticsSchema = new mongoose.Schema({
    channel_id: { type: Number, required: true },
    chatroom_id: { type: Number, required: true },
    stream_session_id: { type: String, required: true },
    stream_date: { type: Date, required: true },
    chatters: [{
        user_id: { type: Number, required: true },
        username: { type: String, required: true },
        message_count: { type: Number, default: 1 },
        first_message_at: { type: Date },
        last_message_at: { type: Date }
    }]
}, {
    timestamps: true,
    versionKey: false
});

// Indexes for efficient querying
chatStatisticsSchema.index({ channel_id: 1, chatroom_id: 1, stream_date: 1 });
chatStatisticsSchema.index({ stream_session_id: 1 });
chatStatisticsSchema.index({ 'chatters.user_id': 1 });

// Pre-save middleware
chatStatisticsSchema.pre('save', function(next) {
    logger.info(`Attempting to save chat statistics for channel: ${this.channel_id}, session: ${this.stream_session_id}`);
    next();
});

// Post-save middleware
chatStatisticsSchema.post('save', function(doc) {
    logger.info(`Chat statistics saved successfully for channel: ${doc.channel_id}, session: ${doc.stream_session_id}`);
});

// Error handling middleware
chatStatisticsSchema.post('save', function(error, doc, next) {
    logger.error(`Error saving chat statistics for channel: ${doc.channel_id}, session: ${doc.stream_session_id}: ${error.message}`);
    next(error);
});

export const ChatStatistics = connectionA.model('ChatStatistics', chatStatisticsSchema, "kick-chat_statistics");