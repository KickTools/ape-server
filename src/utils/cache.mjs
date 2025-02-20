// src/utils/cache.mjs
import NodeCache from 'node-cache';

const statsCache = new NodeCache();

// Cache settings (adjust as needed)
const GLOBAL_STATS_CACHE_KEY = 'globalStats';
const DAILY_STATS_CACHE_KEY_PREFIX = 'dailyStats:';
const CACHE_TTL_SECONDS = 60 * 5; // Cache for 5 minutes (adjust as needed)

export { statsCache, GLOBAL_STATS_CACHE_KEY, DAILY_STATS_CACHE_KEY_PREFIX, CACHE_TTL_SECONDS };