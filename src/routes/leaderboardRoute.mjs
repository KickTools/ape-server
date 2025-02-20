import express from 'express';
import { ChatterLeaderboard } from '../models/ChatterLeaderboard.mjs'; // Adjust path to your model
import { statsCache, CACHE_TTL_SECONDS } from '../utils/cache.mjs';
import logger from '../middlewares/logger.mjs';

const router = express.Router();



router.get('/chat-leaderboard', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const sortBy = req.query.sortBy || 'rank';
    const sortOrder = req.query.sortOrder || 'asc';

    if (limit <= 0) {
      return res.status(400).json({ message: 'Limit must be positive' });
    }

    const cacheKey = `leaderboard:page:${page}:limit:${limit}:sortBy:${sortBy}:sortOrder:${sortOrder}`;
    const cachedData = statsCache.get(cacheKey);
    if (cachedData) {
      logger.info('Serving leaderboard from cache', { cacheKey });
      return res.json(cachedData);
    }

    logger.info('Querying leaderboard from DB', { page, limit, sortBy, sortOrder });

    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const dataPromise = ChatterLeaderboard.find({})
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .select('user_id username stats.total_messages stats.streams_participated rank')
      .lean(); // Add .lean() to skip Mongoose hydration
    const totalPromise = ChatterLeaderboard.countDocuments({});

    const [data, total] = await Promise.all([dataPromise, totalPromise]);

    logger.info('Query completed', { dataLength: data.length, total });

    const response = {
      data,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    };

    statsCache.set(cacheKey, response, CACHE_TTL_SECONDS);
    logger.info('Cached leaderboard data', { cacheKey });

    return res.json({ success: true, data: response });
  } catch (error) {
    logger.error('Error fetching leaderboard', {
      error: error.message,
      stack: error.stack // Add stack trace for more detail
    });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;