import express from 'express';
import { analyticsUtils } from '../utils/analyticsUtils.mjs';
import logger from '../middlewares/logger.mjs';

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

export default router;