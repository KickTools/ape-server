// src/utils/twitchApi.mjs
import axios from "axios";

const BASE_URL = "https://api.twitch.tv/helix";
const TWITCH_CLIENT_ID = process.env.CLIENT_ID;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Client-Id": TWITCH_CLIENT_ID
  }
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      return new Promise(resolve => {
        setTimeout(() => resolve(api(error.config)), retryAfter * 1000);
      });
    }
    return Promise.reject(error);
  }
);

export const fetchUserData = async (accessToken) => {
  try {
    const response = await api.get('/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data.data[0];
  } catch (error) {
    throw new Error("Failed to fetch user data");
  }
};

export const fetchChannelFollowers = async (accessToken, broadcasterId) => {
  try {
    const response = await api.get('/channels/followers', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params: {
        broadcaster_id: broadcasterId
      }
    });
    return response.data.total; // Extract total count of followers
  } catch (error) {
    throw new Error("Failed to fetch channel followers");
  }
};

export const fetchChannels = async (accessToken, userId) => {
  try {
    const response = await api.get('/channels', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params: {
        broadcaster_id: userId
      }
    });
    return response.data.data;
  } catch (error) {
    throw new Error("Failed to fetch channels");
  }
};

export const fetchFollowedChannels = async (accessToken, userId) => {
  try {
    const response = await api.get('/users/follows', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params: {
        from_id: userId
      }
    });
    return response.data.data;
  } catch (error) {
    throw new Error("Failed to fetch followed channels");
  }
};
