// src/models/Viewer.mjs
import mongoose from 'mongoose';

const viewerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    twitch: {
        user_id: { type: String },
        username: { type: String },
        verified: { type: Boolean, default: false },
        verified_at: { type: Date },
        auth: { type: mongoose.Schema.Types.ObjectId, ref: 'Authorization' },
        profile: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }
    },
    kick: {
        user_id: { type: String },
        username: { type: String },
        verified: { type: Boolean, default: false },
        verified_at: { type: Date },
        auth: { type: mongoose.Schema.Types.ObjectId, ref: 'Authorization' },
        profile: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }
    }
}, {
    timestamps: true,
    versionKey: false
});

// Define indexes once, removing the `index: true` from the schema properties
viewerSchema.index({ "twitch.username": 1 });
viewerSchema.index({ "kick.username": 1 });

export const Viewer = mongoose.model('Viewer', viewerSchema, "verify_viewer_viewers");