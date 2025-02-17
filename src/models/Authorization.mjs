// src/models/Authorization.mjs
import mongoose from 'mongoose';

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

export const Authorization = mongoose.model('Authorization', authorizationSchema, "verify_viewer_authorizations");