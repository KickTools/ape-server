// src/utils/saveUserData.mjs
import crypto from "crypto";
import { encrypt } from "../utils/encryption.mjs";
import logger from "../middlewares/logger.mjs";
import { Viewer } from "../models/Viewer.mjs";
import { Profile } from "../models/Profile.mjs";
import { Authorization } from "../models/Authorization.mjs";
import { updateViewerAnalytics } from "./analyticsUtils.mjs";




// Helper function to validate Twitch data
function validateTwitchData(userData, authData) {
  if (!userData || !authData) {
    throw new Error("Missing Twitch user or auth data");
  }

  const requiredUserFields = ["id", "login", "display_name"];
  const requiredAuthFields = ["accessToken", "refreshToken", "expiresAt"];

  const missingUserFields = requiredUserFields.filter(field => !userData[field]);
  const missingAuthFields = requiredAuthFields.filter(field => !authData[field]);

  if (missingUserFields.length > 0 || missingAuthFields.length > 0) {
    throw new Error("Missing required fields for Twitch data");
  }
}

// Helper function to validate Kick data
function validateKickData(userData) {
  if (!userData) {
    throw new Error("Missing Kick user data");
  }

  const requiredFields = ["user_id", "username"];
  const missingFields = requiredFields.filter(field => !userData[field]);

  if (missingFields.length > 0) {
    throw new Error("Missing required Kick fields");
  }
}

export async function saveTwitchUserData(userData, authData) {
  const startTime = Date.now();
  try {
    validateTwitchData(userData, authData);

    const authorization = await Authorization.findOneAndUpdate(
      { platform: "twitch", user_id: userData.id },
      {
        platform: "twitch",
        user_id: userData.id,
        access_token: encrypt(authData.accessToken),
        refresh_token: encrypt(authData.refreshToken),
        expires_at: authData.expiresAt
      },
      { new: true, upsert: true }
    );

    const profile = await Profile.findOneAndUpdate(
      { email: userData.email || `${userData.login.toLowerCase()}@twitch.tv` },
      {
        $set: {
          email: userData.email || `${userData.login.toLowerCase()}@twitch.tv`,
          twitch: {
            bio: userData.description,
            profile_image_url: userData.profile_image_url,
            offline_image_url: userData.offline_image_url,
            created_at: userData.created_at,
            view_count: userData.view_count,
            login: userData.login,
            display_name: userData.display_name,
            type: userData.type,
            broadcaster_type: userData.broadcaster_type,
            description: userData.description
          }
        }
      },
      { new: true, upsert: true }
    );

    const viewer = await Viewer.findOneAndUpdate(
      {
        $or: [
          { "twitch.user_id": userData.id },
          { "twitch.username": userData.login.toLowerCase() }
        ]
      },
      {
        $set: {
          name: userData.display_name,
          "twitch.user_id": userData.id,
          "twitch.username": userData.login.toLowerCase(),
          "twitch.verified": true,
          "twitch.verified_at": new Date(),
          "twitch.auth": authorization._id,
          "twitch.profile": profile._id
        }
      },
      { new: true, upsert: true }
    );

    await updateViewerAnalytics(); 

    logger.info("Twitch user data saved", {
      userId: userData.id,
      duration: Date.now() - startTime
    });

    return viewer;
  } catch (error) {
    logger.error("Failed to save Twitch user data", {
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}

export async function saveKickUserData(userData, existingViewer = null) {
  try {
    // Validate input data
    validateKickData(userData);

    const { user_id, username } = userData;

    // Generate a unique key for the user
    const key = crypto.randomBytes(16).toString("hex");

    // Save authorization data
    let authorization = await Authorization.findOneAndUpdate(
      { platform: "kick", user_id: user_id.toString() },
      { access_token: key },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    // Save profile data
    let profile = await Profile.findOneAndUpdate(
      { "kick.username": username.toLowerCase() },
      {
        $set: {
          email: userData.email || `${username.toLowerCase()}@kick.com`,
          kick: {
            id: userData.id,
            user_id: userData.user_id,
            slug: userData.slug,
            chatroom_id: userData.chatroom_id,
            username: userData.username,
            profile_pic: userData.profile_pic,
            bio: userData.bio,
            email_verified_at: userData.email_verified_at,
            is_banned: userData.is_banned,
            vod_enabled: userData.vod_enabled,
            subscription_enabled: userData.subscription_enabled,
            is_affiliate: userData.is_affiliate,
            is_verified: userData.is_verified,
            followers_count: userData.followers_count,
            banner_image_url: userData.banner_image_url,
            social_links: userData.social_links,
            created_at: userData.created_at
          }
        }
      },
      { new: true, upsert: true }
    );

    // Update existing viewer or create new one
    const query = existingViewer
      ? { _id: existingViewer._id }
      : {
          $or: [
            { "kick.user_id": user_id },
            { "kick.username": username.toLowerCase() }
          ]
        };

    let viewer = await Viewer.findOneAndUpdate(
      query,
      {
        $set: {
          "kick.user_id": user_id,
          "kick.username": username.toLowerCase(),
          "kick.verified": true,
          "kick.verified_at": new Date(),
          "kick.auth": authorization._id,
          "kick.profile": profile._id
        }
      },
      { new: true, upsert: true }
    );

    logger.info(
      `Kick user ${username} has been verified and data saved in the database`
    );
    return { viewer, key };
  } catch (error) {
    logger.error(`Error saving Kick user data: ${error.message}`);
    throw new Error(`Failed to save Kick user data: ${error.message}`);
  }
}

export async function saveCombinedUserData(twitchData, kickData) {
  const startTime = Date.now();
  try {
    const { user, accessToken, refreshToken, expiresAt } = twitchData;
    
    const twitchResult = await saveTwitchUserData(user, {
      accessToken,
      refreshToken,
      expiresAt
    });

    const kickResult = await saveKickUserData(kickData, twitchResult);

    logger.info("Combined user data saved", {
      twitchId: user.id,
      kickId: kickData.user_id,
      duration: Date.now() - startTime
    });

    return kickResult.viewer;
  } catch (error) {
    logger.error("Failed to save combined user data", {
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}
