// src/services/leaderboardServer.mjs
import { ChatStatistics } from '../models/ChatStatistics.mjs';
import { ChatterLeaderboard } from '../models/ChatterLeaderboard.mjs';
import { STREAMER } from '../constants/streamer.mjs';
import logger from '../middlewares/logger.mjs';

class LeaderboardService {
    async updateLeaderboard() {
        try {
            logger.info('Starting leaderboard update...');
            const startTime = Date.now();
    
            const aggStart = Date.now();
            const chatStats = await ChatStatistics.aggregate([
                { $match: { chatroom_id: STREAMER.chatroom_id } },
                { $unwind: "$chatters" },
                {
                    $group: {
                        _id: "$chatters.user_id",
                        username: { $last: "$chatters.username" },
                        total_messages: { $sum: "$chatters.message_count" },
                        stream_dates: { $addToSet: "$stream_date" },
                        first_seen: { $min: "$chatters.first_message_at" },
                        last_seen: { $max: "$chatters.last_message_at" }
                    }
                },
                { $sort: { total_messages: -1 } },
                {
                    $setWindowFields: {
                        sortBy: { total_messages: -1 },
                        output: { rank: { $rank: {} } }
                    }
                }
            ]);
            logger.info(`Aggregation completed in ${(Date.now() - aggStart) / 1000}s`);
    
            const bulkStart = Date.now();
            const operations = chatStats.map(chatter => ({
                updateOne: {
                    filter: { user_id: chatter._id },
                    update: {
                        $set: {
                            username: chatter.username,
                            'stats.total_messages': chatter.total_messages,
                            'stats.streams_participated': chatter.stream_dates.length,
                            'stats.unique_stream_dates': chatter.stream_dates,
                            'stats.first_seen': chatter.first_seen,
                            'stats.last_seen': chatter.last_seen,
                            rank: chatter.rank,
                            last_updated: new Date()
                        }
                    },
                    upsert: true
                }
            }));
    
            const bulkResult = await ChatterLeaderboard.bulkWrite(operations);
            logger.info(`Bulk write completed in ${(Date.now() - bulkStart) / 1000}s`);
    
            const successfulUpdates = bulkResult.upsertedCount + bulkResult.modifiedCount;
            const failedUpdates = chatStats.length - successfulUpdates;
    
            const duration = (Date.now() - startTime) / 1000;
            logger.info(`Leaderboard update completed in ${duration}s. Processed ${chatStats.length} chatters.`, {
                successfulUpdates,
                failedUpdates
            });
    
            return { successfulUpdates, failedUpdates };
        } catch (error) {
            logger.error('Error during leaderboard update', { error: error.message });
            return { successfulUpdates: 0, failedUpdates: chatStats?.length || 0 };
        }
    }

    async getTopChatters(limit = 100) {
        try {
            return await ChatterLeaderboard
                .find({})
                .sort({ rank: 1 })
                .limit(limit)
                .select('-stats.unique_stream_dates');
        } catch (error) {
            logger.error('Error fetching top chatters', { error: error.message });
            return [];
        }
    }

    async getChatterStats(userId) {
        try {
            return await ChatterLeaderboard.findOne({ user_id: userId });
        } catch (error) {
            logger.error('Error fetching chatter stats', { user_id: userId, error: error.message });
            return null;
        }
    }
}

export const leaderboardService = new LeaderboardService();