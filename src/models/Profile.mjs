// src/models/Profile.mjs
import mongoose from 'mongoose';

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
  additional_info: { type: Map, of: String } // For any other dynamic fields
}, {
  timestamps: true,
  versionKey: false // Disable the version key
});

export const Profile = mongoose.model('Profile', profileSchema, "verify_viewer_profiles");