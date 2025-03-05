// src/utils/cache.mjs
import NodeCache from 'node-cache';

const statsCache = new NodeCache();

// Existing cache settings
const GLOBAL_STATS_CACHE_KEY = 'globalStats';
const DAILY_STATS_CACHE_KEY_PREFIX = 'dailyStats:';
const CACHE_TTL_SECONDS = 60 * 5; // 5 minutes

// New verification flow cache settings
const VERIFY_CACHE_KEY_PREFIX = 'verify:';
const VERIFY_FLOW_TTL = 60 * 15; // 15 minutes to complete verification

// Chat cache settings
const CHAT_CACHE_KEY_PREFIX = 'chatHistory:';
const CHAT_CACHE_TTL = 60; // Cache chat messages for 60 seconds

// Add verification-specific methods
const verificationCache = {
  setTwitchData: (sessionId, data) => {
    return statsCache.set(
      `${VERIFY_CACHE_KEY_PREFIX}${sessionId}:twitch`, 
      data, 
      VERIFY_FLOW_TTL
    );
  },

  getTwitchData: (sessionId) => {
    return statsCache.get(`${VERIFY_CACHE_KEY_PREFIX}${sessionId}:twitch`);
  },


  setVerificationComplete: (sessionId, combinedData) => {
    return statsCache.set(
      `${VERIFY_CACHE_KEY_PREFIX}${sessionId}:complete`,
      combinedData,
      VERIFY_FLOW_TTL
    );
  },

  getVerificationStatus: (sessionId) => {
    return {
      twitch: statsCache.get(`${VERIFY_CACHE_KEY_PREFIX}${sessionId}:twitch`),
      complete: statsCache.get(`${VERIFY_CACHE_KEY_PREFIX}${sessionId}:complete`)
    };
  },

  clearVerificationData: (sessionId) => {
    statsCache.del(`${VERIFY_CACHE_KEY_PREFIX}${sessionId}:twitch`);
    statsCache.del(`${VERIFY_CACHE_KEY_PREFIX}${sessionId}:complete`);
  }
};

const chatCache = {
  setMessages: (streamerId, viewerId, messages) => {
    return statsCache.set(
      `${CHAT_CACHE_KEY_PREFIX}${streamerId}:${viewerId}`, 
      messages, 
      CHAT_CACHE_TTL
    );
  },

  getMessages: (streamerId, viewerId) => {
    return statsCache.get(`${CHAT_CACHE_KEY_PREFIX}${streamerId}:${viewerId}`);
  },

  clearMessages: (streamerId, viewerId) => {
    statsCache.del(`${CHAT_CACHE_KEY_PREFIX}${streamerId}:${viewerId}`);
  }
};

export { 
  statsCache, 
  GLOBAL_STATS_CACHE_KEY, 
  DAILY_STATS_CACHE_KEY_PREFIX, 
  CACHE_TTL_SECONDS,
  verificationCache ,
  VERIFY_FLOW_TTL,
  chatCache 
};