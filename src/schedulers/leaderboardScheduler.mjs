import cron from 'node-cron';
import { leaderboardService } from '../services/leaderboardService.mjs';
import logger from '../middlewares/logger.mjs';

// Update every 5 minutes
const LEADERBOARD_UPDATE_SCHEDULE = '*/5 * * * *';

export function startLeaderboardScheduler() {
    logger.info('Starting leaderboard scheduler...');
    
    // Schedule the update task
    cron.schedule(LEADERBOARD_UPDATE_SCHEDULE, async () => {
        try {
            await leaderboardService.updateLeaderboard();
        } catch (error) {
            logger.error('Error in leaderboard scheduler:', error);
        }
    });
}