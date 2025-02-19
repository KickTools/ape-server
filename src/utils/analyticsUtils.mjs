import { VerifyViewerGlobalStats, VerifyViewerDailyStats } from '../models/Analytics.mjs';
import logger from '../middlewares/logger.mjs';

export const analyticsUtils = {
  async getGlobalStats() {
    try {
      const stats = await VerifyViewerGlobalStats.getStats();
      return {
        success: true,
        data: {
          totalViewers: stats.totalViewers,
          lastUpdated: stats.lastUpdated
        }
      };
    } catch (error) {
      logger.error(`Failed to fetch global stats: ${error.message}`);
      return {
        success: false,
        error: 'Failed to fetch global statistics'
      };
    }
  },

  async getDailyStats(date) {
    try {
      // If no date provided, use today
      const targetDate = date || new Date().toISOString().split('T')[0];
      const stats = await VerifyViewerDailyStats.getDailyStats(targetDate);
      
      return {
        success: true,
        data: {
          date: stats.date,
          viewersAdded: stats.viewersAdded
        }
      };
    } catch (error) {
      logger.error(`Failed to fetch daily stats for ${date}: ${error.message}`);
      return {
        success: false,
        error: `Failed to fetch daily statistics for ${date}`
      };
    }
  },

  async getDateRangeStats(startDate, endDate) {
    try {
      const stats = await VerifyViewerDailyStats.find({
        date: {
          $gte: startDate,
          $lte: endDate || new Date().toISOString().split('T')[0]
        }
      }).sort({ date: 1 });

      return {
        success: true,
        data: stats.map(stat => ({
          date: stat.date,
          viewersAdded: stat.viewersAdded
        }))
      };
    } catch (error) {
      logger.error(`Failed to fetch stats for range ${startDate} - ${endDate}: ${error.message}`);
      return {
        success: false,
        error: 'Failed to fetch statistics for date range'
      };
    }
  }
};