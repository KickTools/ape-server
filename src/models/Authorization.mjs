// src/models/Authorization.mjs
import { connectionB } from '../services/mongo.mjs';
import mongoose from 'mongoose';
import logger from '../middlewares/logger.mjs';

const authorizationSchema = new mongoose.Schema({
    platform: { type: String, required: true },
    user_id: { type: String, required: true },
    access_token: { type: String, required: true },
    refresh_token: { type: String },
    expires_at: { type: Date }
}, {
    timestamps: true,
    versionKey: false
});

// Add a compound unique index to prevent duplicates
authorizationSchema.index({ platform: 1, user_id: 1 }, { unique: true });

// Pre-save middleware to log the authorization attempt
authorizationSchema.pre('save', function(next) {
    logger.info(`Attempting to save authorization for platform: ${this.platform}, user_id: ${this.user_id}`);
    next();
});

// Post-save middleware to log successful saves
authorizationSchema.post('save', function(doc) {
    logger.info(`Authorization saved successfully for platform: ${doc.platform}, user_id: ${doc.user_id}`);
});

// Post-save middleware to log save errors, including duplicate key errors
authorizationSchema.post('save', function(error, doc, next) {
    if (error.name === 'MongoServerError' && error.code === 11000) {
        logger.error(`Duplicate key error saving authorization for platform: ${doc.platform}, user_id: ${doc.user_id}: ${error.message}`);
        next(new Error('Duplicate authorization entry.'));
    } else {
        logger.error(`Error saving authorization for platform: ${doc.platform}, user_id: ${doc.user_id}: ${error.message}`);
        next(error);
    }
});

export const Authorization = connectionB.model('Authorization', authorizationSchema, "ape-auth");