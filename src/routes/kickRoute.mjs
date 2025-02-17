// src/routes/kickRoute.mjs
import { Router } from 'express';
import { fetchKickUserData } from '../services/kickService.mjs';
import { kickRateLimiter } from '../middlewares/rateLimiter.mjs'; // Import the rate limiter middleware
import { saveKickUserData } from '../utils/saveUserData.mjs'; // Import the utility function
import logger from '../middlewares/logger.mjs';

const router = Router();

router.get('/channel/:kickName', kickRateLimiter, async (req, res) => {
  const { kickName } = req.params;

  try {
    const userData = await fetchKickUserData(kickName);
    res.json({ success: true, user: userData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching Kick user data', error: error.message });
  }
});

router.post('/verify', async (req, res) => {
  const { userId, username, bio, profileImage } = req.body;

  try {
    // Save user data to the database using the utility function
    const result = await saveKickUserData({ userId, username, bio, profileImage });

    res.json({ success: true, message: "User verified and data saved", user: result });
  } catch (error) {
    logger.error(`Error verifying user: ${error.message}`);
    res.status(500).json({ success: false, message: "Error verifying user", error: error.message });
  }
});

export default router;
