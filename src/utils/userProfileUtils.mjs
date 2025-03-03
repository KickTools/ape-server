// src/utils/userProfileUtils.mjs
import { Viewer } from "../models/Viewer.mjs";
import { ViewerFormData } from "../models/ViewerFormData.mjs";
import { ChatterLeaderboard } from "../models/ChatterLeaderboard.mjs";
import { fetchKickUserData, fetchStreamerUsersData } from '../services/kickService.mjs';
import logger from "../middlewares/logger.mjs";
import mongoose from 'mongoose';

const STREAMER_USERNAME = process.env.STREAMER_USERNAME || "trainwreckstv";

export async function getDetailedUserProfile(platform, id) {
  try {
    logger.info(`Starting getDetailedUserProfile for ${platform}/${id}`);

    const viewer = await getViewerData(platform, id);
    if (!viewer) {
      throw new Error("Viewer not found");
    }
    logger.info(`Viewer found: ${viewer._id}`);

    const formData = await getFormData(viewer._id);
    logger.info(`Form data fetched: ${formData ? formData._id : 'none'}`);

    const kickUserData = viewer.kick?.username ? await fetchKickUserData(viewer.kick.username) : null;
    logger.info(`Kick user data fetched for ${viewer.kick?.username || 'none'}: ${kickUserData ? 'success' : 'null'}`);

    const kickStats = viewer.kick?.username ? await fetchStreamerUsersData(STREAMER_USERNAME, viewer.kick.username) : null;
    logger.info(`Kick stats fetched for ${viewer.kick?.username || 'none'}: ${kickStats ? 'success' : 'null'}`);

    const kickChatActivity = viewer.kick?.user_id ? await getKickChatActivity(viewer.kick.user_id) : null;
    logger.info(`Kick chat activity fetched for ${viewer.kick?.user_id || 'none'}: ${kickChatActivity ? 'success' : 'null'}`);

    return {
      kick: { username: viewer.kick?.username || null },
      twitch: { username: viewer.twitch?.username || null },
      accountVerified: viewer.createdAt ? viewer.createdAt.toISOString() : null,
      level: calculateLevel(viewer),
      contactAddress: formData?.contactAddress || null,
      btc: formData?.bitcoinAddress || null,
      eth: formData?.ethAddress || null,
      kickRelatedInfo: {
        accountCreatedDate: kickUserData?.created_at || null,
        accountAge: calculateAge(kickUserData?.created_at),
        followed: kickStats?.followed || null,
        followAge: calculateAge(kickStats?.following_since),
        subscriber: kickStats?.subscribed_for > 0,
        subLength: kickStats?.subscribed_for > 0 ? `${kickStats.subscribed_for} months` : null,
        userBanned: kickStats?.is_banned || kickUserData?.is_banned || null,
        chatActivity: {
          messages: kickChatActivity?.stats.total_messages || null,
          daysActive: kickChatActivity?.stats.unique_stream_dates?.length || null,
          watchTime: null
        },
        socialMedia: {
          x: kickUserData?.social_links?.twitter || null,
          instagram: kickUserData?.social_links?.instagram || null,
          youtube: kickUserData?.social_links?.youtube || null,
          discord: kickUserData?.social_links?.discord || null,
          tiktok: kickUserData?.social_links?.tiktok || null,
          facebook: kickUserData?.social_links?.facebook || null
        }
      },
      giveawaysEntered: null,
      giveawaysWon: null
    };
  } catch (error) {
    logger.error(`Error in getDetailedUserProfile for ${platform}/${id}: ${error.message}`, { stack: error.stack });
    throw error;
  }
}

async function getViewerData(platform, id) {
  let viewer;
  if (mongoose.Types.ObjectId.isValid(id)) {
    viewer = await Viewer.findById(id)
      .populate('twitch.profile')
      .populate('kick.profile')
      .lean();
    logger.info(`Searched by _id: ${id}, found: ${viewer ? 'yes' : 'no'}`);
  }
  if (!viewer) {
    viewer = await Viewer.findOne({ [`${platform}.user_id`]: id })
      .populate('twitch.profile')
      .populate('kick.profile')
      .lean();
    logger.info(`Searched by ${platform}.user_id: ${id}, found: ${viewer ? 'yes' : 'no'}`);
  }
  return viewer;
}

async function getFormData(viewerId) {
  try {
    const formData = await ViewerFormData.findOne({ viewer: viewerId }).lean();
    return formData || null;
  } catch (error) {
    logger.error(`Error fetching ViewerFormData for viewer ${viewerId}: ${error.message}`);
    return null; // Graceful fallback
  }
}

async function getKickChatActivity(kickUserId) {
  try {
    const chatData = await ChatterLeaderboard.findOne({ user_id: Number(kickUserId) }).lean();
    return chatData || null;
  } catch (error) {
    logger.error(`Error fetching Kick chat activity for user ${kickUserId}: ${error.message}`);
    return null; // Graceful fallback
  }
}

function calculateLevel(viewer) {
  let level = 0;
  if (viewer.twitch?.verified) level += 1;
  if (viewer.kick?.verified) level += 1;
  if (viewer.x?.verified) level += 1;
  return level;
}

function calculateAge(date) {
  if (!date) return null;
  const now = new Date();
  const created = new Date(date);
  let years = now.getFullYear() - created.getFullYear();
  let months = now.getMonth() - created.getMonth();
  let days = now.getDate() - created.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return `${years}y ${months}m ${days}d`;
}