import logger from "../middlewares/logger.mjs";
import { Viewer } from "../models/Viewer.mjs";
import { Profile } from "../models/Profile.mjs";
import { Session } from "../models/Session.mjs";
import { generateSessionToken } from "./auth.mjs"; // Import to regenerate tokens

export async function saveTwitchUserData(userData) {
  const startTime = Date.now();
  try {
    if (!userData || !userData.user_id || !userData.login || !userData.display_name) {
      throw new Error("Missing required Twitch user data fields");
    }

    const session = await Session.findOne({
      platform: "twitch",
      user_id: userData.user_id
    });
    if (!session) {
      throw new Error("Session record not found for Twitch user");
    }

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
          { "twitch.user_id": userData.user_id },
          { "twitch.username": userData.login.toLowerCase() }
        ]
      },
      {
        $set: {
          name: userData.display_name,
          "twitch.user_id": userData.user_id,
          "twitch.username": userData.login.toLowerCase(),
          "twitch.verified": true,
          "twitch.verified_at": new Date(),
          "twitch.session": session._id,
          "twitch.profile": profile._id
        }
      },
      { new: true, upsert: true }
    );

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
    if (!userData || !userData.user_id || !userData.username) {
      throw new Error("Missing required Kick user data fields");
    }

    const { user_id, username } = userData;

    const session = await Session.findOne({
      platform: "kick",
      user_id: user_id.toString()
    });
    if (!session) {
      throw new Error("Session record not found for Kick user");
    }

    const profile = await Profile.findOneAndUpdate(
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
            profile_pic: userData.profile_picture,
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

    const query = existingViewer
      ? { _id: existingViewer._id }
      : {
          $or: [
            { "kick.user_id": user_id },
            { "kick.username": username.toLowerCase() }
          ]
        };

    const viewer = await Viewer.findOneAndUpdate(
      query,
      {
        $set: {
          "kick.user_id": user_id,
          "kick.username": username.toLowerCase(),
          "kick.verified": true,
          "kick.verified_at": new Date(),
          "kick.session": session._id,
          "kick.profile": profile._id
        }
      },
      { new: true, upsert: true }
    );

    return { viewer };
  } catch (error) {
    logger.error(`Error saving Kick user data: ${error.message}`);
    throw new Error(`Failed to save Kick user data: ${error.message}`);
  }
}

export async function saveCombinedUserData(twitchData, kickData) {
  const startTime = Date.now();
  let twitchResult;
  let kickResult;

  try {
    if (twitchData && twitchData.user) {
      const twitchUser = twitchData.user;
      twitchResult = await saveTwitchUserData(twitchUser);
    } else {
      logger.warn("Twitch data missing or incomplete, skipping Twitch save");
    }

    if (kickData) {
      kickResult = await saveKickUserData(kickData, twitchResult);
    } else {
      throw new Error("Kick data is required");
    }

    const viewer = await Viewer.findOneAndUpdate(
      { _id: kickResult.viewer._id },
      { $setOnInsert: { role: "regular" } },
      { new: true, upsert: true }
    );

    const twitchSessionToken = twitchResult
      ? generateSessionToken(twitchData.user.id, viewer.role)
      : null;
    const kickSessionToken = generateSessionToken(kickData.user_id, viewer.role);

    logger.info("Combined user data saved", {
      twitchId: twitchResult ? twitchResult.twitch.user_id : "N/A",
      kickId: kickData.user_id,
      role: viewer.role,
      duration: Date.now() - startTime
    });

    return {
      viewer,
      twitchSessionToken,
      kickSessionToken
    };
  } catch (error) {
    logger.error("Failed to save combined user data", {
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}