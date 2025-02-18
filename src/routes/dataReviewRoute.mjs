import express from 'express';
import { getAllProfiles, getProfileByEmail, getAllViewers, getViewerByUserId, getAllAuthorizations, getAuthorizationByUserId, getViewersList, getViewerProfile, checkAuthorization } from '../utils/dataReview.mjs';
import { viewerCache } from '../utils/viewerCache.mjs';
import logger from '../middlewares/logger.mjs';

const router = express.Router();

// Route to get all profiles
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await getAllProfiles();
    res.json(profiles);
  } catch (error) {
    logger.error(`Error fetching profiles: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to get a profile by email
router.get('/profiles/:email', async (req, res) => {
  try {
    const profile = await getProfileByEmail(req.params.email);
    res.json(profile);
  } catch (error) {
    logger.error(`Error fetching profile for email ${req.params.email}: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to get all viewers
router.get('/viewers', async (req, res) => {
  try {
    const viewers = await getAllViewers();
    res.json(viewers);
  } catch (error) {
    logger.error(`Error fetching viewers: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to get a viewer by user ID for a specific platform
router.get('/viewers/:platform/:userId', async (req, res) => {
  try {
    const { platform, userId } = req.params;
    const viewer = await getViewerByUserId(platform, userId);
    res.json(viewer);
  } catch (error) {
    logger.error(`Error fetching viewer for platform ${req.params.platform} and userId ${req.params.userId}: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to get all authorizations
router.get('/authorizations', async (req, res) => {
  try {
    const authorizations = await getAllAuthorizations();
    res.json(authorizations);
  } catch (error) {
    logger.error(`Error fetching authorizations: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to get an authorization by user ID for a specific platform
router.get('/authorizations/:platform/:userId', async (req, res) => {
  try {
    const { platform, userId } = req.params;
    const authorization = await getAuthorizationByUserId(platform, userId);
    res.json(authorization);
  } catch (error) {
    logger.error(`Error fetching authorization for platform ${req.params.platform} and userId ${req.params.userId}: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get paginated list of viewers with filters
router.get('/viewers', async (req, res) => {
  try {
    const {
      page,
      limit,
      platform,
      verified,
      search,
      sortBy,
      sortOrder
    } = req.query;

    const result = await getViewersList({
      page: parseInt(page),
      limit: parseInt(limit),
      platform,
      verified: verified === 'true',
      search,
      sortBy,
      sortOrder: sortOrder === 'asc' ? 1 : -1
    });

    res.json(result);
  } catch (error) {
    logger.error(`Error in viewers route with query ${JSON.stringify(req.query)}: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get detailed viewer profile
router.get('/viewers/:platform/:userId', async (req, res) => {
  try {
    const { platform, userId } = req.params;
    const profile = await getViewerProfile(platform, userId);
    res.json(profile);
  } catch (error) {
    logger.error(`Error in viewer profile route for platform ${req.params.platform} and userId ${req.params.userId}: ${error.message}`);
    res.status(404).json({ error: 'Viewer not found' });
  }
});

// Check authorization status
router.get('/auth/:platform/:userId', async (req, res) => {
  try {
    const { platform, userId } = req.params;
    const authStatus = await checkAuthorization(platform, userId);
    res.json(authStatus);
  } catch (error) {
    logger.error(`Error in authorization check route for platform ${req.params.platform} and userId ${req.params.userId}: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Viewer Search populated from cache
router.get('/search/viewers', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.json({ results: [] });
    }

    const results = await viewerCache.search(query, parseInt(limit.toString()));
    
    res.json({
      results: results.map(viewer => ({
        id: viewer._id,
        name: viewer.name,
        twitch: viewer.twitch ? {
          username: viewer.twitch.username,
          verified: viewer.twitch.verified
        } : undefined,
        kick: viewer.kick ? {
          username: viewer.kick.username,
          verified: viewer.kick.verified
        } : undefined
      }))
    });
  } catch (error) {
    logger.error(`Search error with query ${req.query.q} and limit ${req.query.limit}: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get cache statistics
router.get('/viewers/cache/stats', (req, res) => {
  const stats = viewerCache.getCacheStats();
  res.json(stats);
});

export default router;