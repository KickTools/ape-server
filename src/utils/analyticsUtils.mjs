// src/utils/analyticsUtils.mjs
import { VerifyViewerGlobalStats, VerifyViewerDailyStats } from '../models/Analytics.mjs';
import logger from '../middlewares/logger.mjs';

export const analyticsUtils = {
  async getGlobalStats() {
    try {
      const globalStats = await VerifyViewerGlobalStats.findOne();
      
      return {
        success: true,
        data: {
          verifiedViewers: globalStats?.totalViewers || 0,
          botAccounts: 0, // If you want to track this separately later
          lastUpdated: globalStats?.lastUpdated || new Date()
        }
      };
    } catch (error) {
      logger.error(`Failed to fetch global stats: ${error.message}`);
      return {
        success: false,
        error: 'Failed to fetch global stats'
      };
    }
  },

  async getDailyStats(date = new Date().toISOString().split('T')[0]) {
    try {
      const dailyStats = await VerifyViewerDailyStats.findOne({ date });
      
      return {
        success: true,
        data: {
          date,
          dailyActiveUsers: dailyStats?.viewersAdded || 0,
          createdAt: dailyStats?.createdAt,
          updatedAt: dailyStats?.updatedAt
        }
      };
    } catch (error) {
      logger.error(`Failed to fetch daily stats for ${date}: ${error.message}`);
      return {
        success: false,
        error: `Failed to fetch daily stats for ${date}`
      };
    }
  },

  async getDateRangeStats(startDate, endDate = new Date().toISOString().split('T')[0]) {
    try {
      const stats = await VerifyViewerDailyStats.find({
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ date: 1 });

      return {
        success: true,
        data: stats.map(stat => ({
          date: stat.date,
          dailyActiveUsers: stat.viewersAdded,
          createdAt: stat.createdAt,
          updatedAt: stat.updatedAt
        }))
      };
    } catch (error) {
      logger.error(`Failed to fetch stats for range ${startDate} to ${endDate}: ${error.message}`);
      return {
        success: false,
        error: 'Failed to fetch stats for date range'
      };
    }
  }
};