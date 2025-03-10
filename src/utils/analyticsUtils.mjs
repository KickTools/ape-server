// src/utils/analyticsUtils.mjs
import { VerifyViewerGlobalStats, VerifyViewerDailyStats } from '../models/Analytics.mjs';
import { Viewer } from "../models/Viewer.mjs";
import logger from '../middlewares/logger.mjs';

export const analyticsUtils = {
  async getGlobalStats() {
    try {
      const globalStats = await VerifyViewerGlobalStats.findOne();
      
      return {
        success: true,
        data: {
          totalViewers: globalStats?.totalViewers || 0,
          levelDistribution: globalStats?.levelDistribution || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
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

export async function updateViewerAnalytics() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Count total viewers
    const totalViewers = await Viewer.countDocuments();

    // Count viewers created today
    const viewersAddedToday = await Viewer.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    // Compute level distribution
    const levelCounts = await Viewer.aggregate([
      {
        $project: {
          level: {
            $sum: [
              { $cond: [{ $eq: ["$twitch.verified", true] }, 1, 0] },
              { $cond: [{ $eq: ["$kick.verified", true] }, 1, 0] },
              { $cond: [{ $eq: ["$x.verified", true] }, 1, 0] }
            ]
          }
        }
      },
      {
        $group: {
          _id: "$level",
          count: { $sum: 1 }
        }
      }
    ]);

    const levelDistribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
    levelCounts.forEach(({ _id, count }) => {
      levelDistribution[_id] = count;
    });

    // Update global stats
    await VerifyViewerGlobalStats.findOneAndUpdate(
      {},
      {
        $set: {
          totalViewers,
          levelDistribution,
          lastUpdated: new Date()
        }
      },
      { upsert: true }
    );

    // Update daily stats
    await VerifyViewerDailyStats.updateOne(
      { date: today },
      { $set: { viewersAdded: viewersAddedToday } },
      { upsert: true }
    );

    logger.info(`Analytics updated: totalViewers=${totalViewers}, viewersAddedToday=${viewersAddedToday}, levelDistribution=${JSON.stringify(levelDistribution)}`);
  } catch (error) {
    logger.error(`Failed to update analytics: ${error.message}`);
    throw error;
  }
}
