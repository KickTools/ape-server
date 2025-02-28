// src/models/Profile.mjs
import { connectionB } from '../services/mongo.mjs';
import mongoose from 'mongoose';
import logger from '../middlewares/logger.mjs';

const profileSchema = new mongoose.Schema({
  id: { type: String, index: true },
  email: { type: String, index: true },
  twitch: {
    bio: { type: String },
    profile_image_url: { type: String },
    offline_image_url: { type: String },
    created_at: { type: Date },
    view_count: { type: Number },
    login: { type: String },
    display_name: { type: String },
    type: { type: String },
    broadcaster_type: { type: String },
    followers_count: { type: Number },
    description: { type: String }
  },
  kick: {
    id: { type: Number },
    user_id: { type: Number },
    slug: { type: String },
    chatroom_id: { type: Number },
    username: { type: String },
    profile_pic: { type: String },
    bio: { type: String },
    is_banned: { type: Boolean },
    vod_enabled: { type: Boolean },
    subscription_enabled: { type: Boolean },
    is_affiliate: { type: Boolean },
    is_verified: { type: Boolean },
    followers_count: { type: Number },
    banner_image_url: { type: String },
    social_links: {
      instagram: { type: String },
      twitter: { type: String },
      youtube: { type: String },
      discord: { type: String },
      tiktok: { type: String },
      facebook: { type: String },
    },
    created_at: { type: Date }
  },
  x: {
    id: { type: String },
    username: { type: String },
    name: { type: String },
    profile_image_url: { type: String },
    created_at: { type: Date },
    description: { type: String },
    followers_count: { type: Number },
    following_count: { type: Number }
  },
  additional_info: { type: Map, of: String }
}, {
  timestamps: true,
  versionKey: false
});

// Pre-save middleware to log the profile save attempt
profileSchema.pre('save', function(next) {
  logger.info(`Attempting to save profile with id: ${this.id}, email: ${this.email}, twitch login: ${this.twitch?.login}, kick username: ${this.kick?.username}`);
  next();
});

// Post-save middleware to log successful saves
profileSchema.post('save', function(doc) {
  logger.info(`Profile saved successfully with id: ${doc.id}, email: ${doc.email}, twitch login: ${doc.twitch?.login}, kick username: ${doc.kick?.username}`);
});

// Post-save middleware to log save errors
profileSchema.post('save', function(error, doc, next) {
  logger.error(`Error saving profile with id: ${doc.id}, email: ${doc.email}, twitch login: ${doc.twitch?.login}, kick username: ${doc.kick?.username}: ${error.message}`);
  next(error);
});

export const Profile = connectionB.model('Profile', profileSchema, "ape-user-profiles");