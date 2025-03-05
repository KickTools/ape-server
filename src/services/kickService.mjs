// src/services/kickService.mjs
import axios from 'axios';
import logger from '../middlewares/logger.mjs';
import { chatCache } from '../utils/cache.mjs';

const BASE_URL = process.env.CASTERLABS_BASE_URL;
const CASTERLABS_KEY = process.env.CASTERLABS_KEY;

export async function fetchKickUserData(kickName) {
  try {
    const url = `${BASE_URL}/proxy/kick/${CASTERLABS_KEY}/api/v2/channels/${kickName}`;
    const response = await axios.get(url);
    const data = response.data;

    const userData = {
      id: data.id,
      user_id: data.user_id,
      slug: data.slug,
      chatroom_id: data.chatroom.id,
      username: data.user.username,
      profile_pic: data.user.profile_pic,
      bio: data.user.bio,
      social_links: {
        instagram: data.user.instagram,
        twitter: data.user.twitter,
        youtube: data.user.youtube,
        discord: data.user.discord,
        tiktok: data.user.tiktok,
        facebook: data.user.facebook,
      },
      is_banned: data.is_banned,
      vod_enabled: data.vod_enabled,
      subscription_enabled: data.subscription_enabled,
      is_affiliate: data.is_affiliate,
      is_verified: data.verified,
      followers_count: data.followers_count,
      banner_image_url: data.banner_image?.url,
      created_at: data.chatroom.created_at
    };

    return userData;
  } catch (error) {
    logger.error(`Error fetching Kick user data: ${error.message}`);
    throw error;
  }
}

export async function fetchStreamerUsersData(streamer, viewer) {
  try {
    const url = `${BASE_URL}/proxy/kick/${CASTERLABS_KEY}/api/v2/channels/${streamer}/users/${viewer}`;
    const response = await axios.get(url);
    const data = response.data;

    const viewerData = {
      followed: data.following_since ? true : false,
      following_since: data.following_since,
      subscribed_for: data.subscribed_for || 0,
      is_banned: data.banned !== null
    };

    return viewerData;
  } catch (error) {
    logger.error(`Error fetching Kick viewer data: ${error.message}`);
    throw error;
  }
}

export async function fetchChatHistory(streamerId, viewerId) {
  const cachedMessages = chatCache.getMessages(streamerId, viewerId);
  if (cachedMessages) return cachedMessages;

  let messages = [];
  let cursor = null;
  const urlBase = `${BASE_URL}/proxy/kick/${CASTERLABS_KEY}/api/v2/channels/${streamerId}/users/${viewerId}/messages`;

  try {
    while (true) {
      const url = cursor ? `${urlBase}?cursor=${cursor}` : urlBase;
      const response = await axios.get(url);
      const data = response.data;

      if (data.status.error) {
        logger.error(`API Error: ${data.status.message}`);
        break;
      }

      messages.push(...data.data.messages);
      cursor = data.data.cursor;

      if (!cursor || data.data.messages.length === 0) break;
    }

    chatCache.setMessages(streamerId, viewerId, messages);
    return messages;
  } catch (error) {
    logger.error(`Error fetching chat history: ${error.message}`);
    throw error;
  }
}