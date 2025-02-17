// src/utils/viewerCache.mjs
import { Viewer } from '../models/Viewer.mjs';
import logger from '../middlewares/logger.mjs';

class ViewerCache {
  constructor() {
    this.cache = new Map();
    this.searchIndex = new Map();
    this.lastRefresh = null;
    this.refreshInterval = 5 * 60 * 1000; // 5 minutes
    this.initializeCache();
  }

  async initializeCache() {
    try {
      await this.refreshCache();
      // Set up periodic cache refresh
      setInterval(() => this.refreshCache(), this.refreshInterval);
    } catch (error) {
      logger.error('Failed to initialize viewer cache:', error);
    }
  }

  async refreshCache() {
    try {
      const viewers = await Viewer.find()
        .populate('twitch.profile')
        .populate('kick.profile');

      // Clear existing cache and search index
      this.cache.clear();
      this.searchIndex.clear();

      // Populate cache and search index
      viewers.forEach(viewer => {
        this.cache.set(viewer._id.toString(), viewer);
        this.indexViewer(viewer);
      });

      this.lastRefresh = new Date();
      logger.info(`Viewer cache refreshed at ${this.lastRefresh}`);
    } catch (error) {
      logger.error('Failed to refresh viewer cache:', error);
    }
  }

  indexViewer(viewer) {
    const searchableStrings = [
      viewer.name,
      viewer.twitch?.username,
      viewer.kick?.username
    ].filter(Boolean);

    searchableStrings.forEach(str => {
      if (!str) return;
      
      const normalizedStr = str.toLowerCase();
      // Generate prefixes for prefix search (e.g., "sam" -> ["s", "sa", "sam"])
      for (let i = 1; i <= normalizedStr.length; i++) {
        const prefix = normalizedStr.slice(0, i);
        if (!this.searchIndex.has(prefix)) {
          this.searchIndex.set(prefix, new Set());
        }
        this.searchIndex.get(prefix).add(viewer._id.toString());
      }
    });
  }

  search(query, limit = 10) {
    if (!query) return [];
    
    const normalizedQuery = query.toLowerCase();
    const matchingIds = this.searchIndex.get(normalizedQuery) || new Set();
    
    const results = Array.from(matchingIds)
      .map(id => this.cache.get(id))
      .filter(Boolean)
      .slice(0, limit);

    return results;
  }

  getViewer(id) {
    return this.cache.get(id);
  }

  getCacheStats() {
    return {
      totalViewers: this.cache.size,
      totalIndexEntries: this.searchIndex.size,
      lastRefresh: this.lastRefresh,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB'
    };
  }
}

// Create and export a single instance
export const viewerCache = new ViewerCache();