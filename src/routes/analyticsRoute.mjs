import express from 'express';
import fetch from 'node-fetch';
import { analyticsUtils } from '../utils/analyticsUtils.mjs';
import { viewerCache } from '../utils/viewerCache.mjs';
import logger from '../middlewares/logger.mjs';
import { requireAdminOrWebmaster } from '../middlewares/adminAuth.mjs';
import { statsCache, GLOBAL_STATS_CACHE_KEY, DAILY_STATS_CACHE_KEY_PREFIX, CACHE_TTL_SECONDS } from '../utils/cache.mjs';
import { verifySessionToken } from "../middlewares/sessionAuth.mjs";


const router = express.Router();

// Get global stats
router.get('/global', async (req, res) => {
  try {
    const result = await analyticsUtils.getGlobalStats();
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (error) {
    logger.error(`Error in global stats endpoint: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get daily stats - defaults to today if no date provided
router.get('/daily/:date?', async (req, res) => {
  try {
    const date = req.params.date;
    
    // Validate date format if provided
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const result = await analyticsUtils.getDailyStats(date);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (error) {
    logger.error(`Error in daily stats endpoint: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get stats for a date range
router.get('/range/:startDate/:endDate?', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    
    // Validate date formats
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || (endDate && !dateRegex.test(endDate))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const result = await analyticsUtils.getDateRangeStats(startDate, endDate);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (error) {
    logger.error(`Error in range stats endpoint: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get cache statistics
router.get('/viewers/cache/stats', (req, res) => {
  const stats = viewerCache.getCacheStats();
  res.json(stats);
});

// Global Stats Route with Caching
router.get('/verification/global', async (req, res) => {
  try {
    let stats = statsCache.get(GLOBAL_STATS_CACHE_KEY);
    
    if (stats === undefined) {
      const result = await analyticsUtils.getGlobalStats();
      if (!result.success) {
        return res.status(500).json(result);
      }
      
      stats = result.data;
      statsCache.set(GLOBAL_STATS_CACHE_KEY, stats, CACHE_TTL_SECONDS);
      logger.info("Global stats cache miss. Data fetched from database.");
    } else {
      logger.info("Global stats cache hit.");
    }

    return res.json({ success: true, data: stats });
  } catch (error) {
    logger.error(`Error in verification global stats endpoint: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error'
    });
  }
});

// Daily Stats Route with Caching
router.get('/verification/daily', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ 
        success: false, 
        error: 'Date parameter is required (YYYY-MM-DD)' 
      });
    }

    const cacheKey = DAILY_STATS_CACHE_KEY_PREFIX + date;
    let stats = statsCache.get(cacheKey);

    if (stats === undefined) {
      const result = await analyticsUtils.getDailyStats(date);
      if (!result.success) {
        return res.status(500).json(result);
      }
      
      stats = result.data;
      statsCache.set(cacheKey, stats, CACHE_TTL_SECONDS);
      logger.info(`Daily stats cache miss for ${date}. Data fetched from database.`);
    } else {
      logger.info(`Daily stats cache hit for ${date}.`);
    }

    return res.json({ success: true, data: stats });
  } catch (error) {
    logger.error(`Error in verification daily stats endpoint: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.get('/admin-analtyics/:userId', verifySessionToken, requireAdminOrWebmaster, async (req, res) => {

    try {
      const { userId } = req.params;

      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or missing user ID parameter'
        });
      }

      const kicktoolsUrl = `https://api.kicktools.app/api/customers/external/analytics/user_id/${userId}`;
      const apiKey = process.env.KICKTOOLS_API_KEY || '3A4713EFAAD694F5BB8585DD15AC55C0';

      const response = await fetch(kicktoolsUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Kicktools API error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({
          success: false,
          error: `Failed to fetch analytics data: ${errorText}`
        });
      }

      const analyticsData = await response.json();
      res.json({
        success: true,
        data: analyticsData
      });

    } catch (error) {
      logger.error(`Error in user-analytics endpoint: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching analytics'
      });
    }
  }
);

export default router;