import { Authorization } from "../models/Authorization.mjs";
import { Profile } from "../models/Profile.mjs";
import { Viewer } from "../models/Viewer.mjs";
import logger from "../middlewares/logger.mjs";
import crypto from 'crypto';

export async function saveKickUserData(userData) {
  try {
    const { userId, username, bio, profileImage } = userData;

    // Generate a unique key for the user
    const key = crypto.randomBytes(16).toString('hex');

    // Save authorization data
    let authorization = await Authorization.findOneAndUpdate(
      { platform: "kick", user_id: userId },
      {
        platform: "kick",
        user_id: userId,
        access_token: key,
      },
      { new: true, upsert: true }
    );

    // Save profile data
    let profile = await Profile.findOneAndUpdate(
      { email: `${username}@kick.com` }, 
      {
        email: `${username}@kick.com`,
        kick: {
          bio: bio,
          profile_image_url: profileImage,
        },
      },
      { new: true, upsert: true }
    );

    // Save viewer data
    let viewer = await Viewer.findOneAndUpdate(
      { "kick.user_id": userId },
      {
        name: username,
        kick: {
          user_id: userId,
          username: username,
          verified: true,
          verified_at: new Date(),
          auth: authorization._id,
        },
        profile: profile._id,
      },
      { new: true, upsert: true }
    );

    return { username, key };
  } catch (error) {
    logger.error(`Error saving Kick user data: ${error.message}`);
    throw error;
  }
}
