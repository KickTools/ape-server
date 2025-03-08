import express from 'express';
import { getAllProfiles, getProfileByEmail, getAllViewers, getViewerByUserId, getAllAuthorizations, getAuthorizationByUserId, getViewersList, getViewerProfile, checkAuthorization } from '../utils/dataReview.mjs';
import { getDetailedUserProfile } from '../utils/userProfileUtils.mjs'; 
import { viewerCache } from '../utils/viewerCache.mjs';
import { ViewerFormData } from '../models/ViewerFormData.mjs';
import { Viewer } from '../models/Viewer.mjs';
import logger from '../middlewares/logger.mjs';
import { requireAdminOrWebmaster } from '../middlewares/adminAuth.mjs';

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

router.get('/user-profile/:platform/:userId', requireAdminOrWebmaster, async (req, res) => {
  const startTime = Date.now();
  try {
    const { platform, userId } = req.params;
    logger.info(`Fetching detailed profile for ${platform} user ${userId}`);

    const profileData = await getDetailedUserProfile(platform, userId);

    if (!profileData) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: profileData });
  } catch (error) {
    logger.error(`Error fetching detailed user profile for ${req.params.platform}/${req.params.userId}: ${error.message}`, {
      duration: Date.now() - startTime
    });
    res.status(500).json({ success: false, message: `Failed to fetch user profile: ${error.message}` });
  }
});

// Admin-only: Get all viewers (simple)
router.get('/viewers/all', requireAdminOrWebmaster, async (req, res) => {
  try {
    const viewers = await getAllViewers();
    res.json(viewers);
  } catch (error) {
    logger.error(`Error fetching viewers: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// User or Admin: Get viewer by user ID (restrict to own data unless admin)
router.get('/viewers/:platform/:userId', async (req, res) => {
  try {
    const { platform, userId } = req.params;
    const requestingUserId = req.user.user_id;

    if (requestingUserId !== userId && !["admin", "webmaster"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const viewer = await getViewerByUserId(platform, userId);
    res.json(viewer);
  } catch (error) {
    logger.error(`Error fetching viewer for platform ${req.params.platform} and userId ${req.params.userId}: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin-only: Get all authorizations
router.get('/authorizations', requireAdminOrWebmaster, async (req, res) => {
  try {
    const authorizations = await getAllAuthorizations();
    res.json(authorizations);
  } catch (error) {
    logger.error(`Error fetching authorizations: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// User or Admin: Get authorization by user ID
router.get('/authorizations/:platform/:userId', async (req, res) => {
  try {
    const { platform, userId } = req.params;
    const requestingUserId = req.user.user_id;

    if (requestingUserId !== userId && !["admin", "webmaster"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const authorization = await getAuthorizationByUserId(platform, userId);
    res.json(authorization);
  } catch (error) {
    logger.error(`Error fetching authorization for platform ${req.params.platform} and userId ${req.params.userId}: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin-only: Paginated viewers list with filters
router.get('/viewers', requireAdminOrWebmaster, async (req, res) => {
  try {
    const { page, limit, platform, verified, search, sortBy, sortOrder } = req.query;
    const result = await getViewersList({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
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

// Admin-only: Detailed viewer profile
router.get('/viewers/profile/:platform/:userId', requireAdminOrWebmaster, async (req, res) => {
  try {
    const { platform, userId } = req.params;
    const profile = await getViewerProfile(platform, userId);
    res.json(profile);
  } catch (error) {
    logger.error(`Error in viewer profile route for platform ${req.params.platform} and userId ${req.params.userId}: ${error.message}`);
    res.status(404).json({ error: 'Viewer not found' });
  }
});

// User or Admin: Check authorization status
router.get('/auth/:platform/:userId', async (req, res) => {
  try {
    const { platform, userId } = req.params;
    const requestingUserId = req.user.user_id;

    if (requestingUserId !== userId && !["admin", "webmaster"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const authStatus = await checkAuthorization(platform, userId);
    res.json(authStatus);
  } catch (error) {
    logger.error(`Error in authorization check route for platform ${req.params.platform} and userId ${req.params.userId}: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin-only: Viewer search from cache
router.get('/search/viewers', requireAdminOrWebmaster, async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    if (!query || typeof query !== 'string') {
      return res.json({ results: [] });
    }

    const results = await viewerCache.search(query, parseInt(limit.toString()));
    const viewerIds = results.map(viewer => viewer._id);
    const formData = await ViewerFormData.find({ viewer: { $in: viewerIds } }).lean();

    const formDataMap = new Map(
      formData.map(data => [data.viewer.toString(), {
        bitcoinAddress: data.bitcoinAddress,
        contactAddress: data.contactAddress
      }])
    );

    res.json({
      results: results.map(viewer => ({
        id: viewer._id,
        name: viewer.name,
        twitch: viewer.twitch ? {
          username: viewer.twitch.username,
          verified: viewer.twitch.verified,
          profilePic: viewer.twitch.profile?.twitch?.profile_image_url || 'N/A',
          url: viewer.twitch.username ? `https://twitch.tv/${viewer.twitch.username}` : undefined
        } : undefined,
        kick: viewer.kick ? {
          username: viewer.kick.username,
          verified: viewer.kick.verified,
          profilePic: viewer.kick.profile?.kick?.profile_pic || 'N/A',
          url: viewer.kick.username ? `https://kick.com/${viewer.kick.username}` : undefined,
          twitter: viewer.kick.profile?.kick?.social_links?.twitter
        } : undefined,
        bitcoinAddress: formDataMap.get(viewer._id.toString())?.bitcoinAddress,
        contactAddress: formDataMap.get(viewer._id.toString())?.contactAddress
      }))
    });
  } catch (error) {
    logger.error(`Search error with query ${req.query.q} and limit ${req.query.limit}: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get verification level of a viewer, or by platform and user_id
router.get('/viewers/verification', async (req, res) => {
  try {
    let viewer;
    const { viewerId, platform, userId } = req.query;

    if (viewerId) {
      viewer = await Viewer.findById(viewerId);
    } else if (platform && userId) {
      viewer = await Viewer.findOne({ [`${platform}.user_id`]: userId });
    } else {
      return res.status(400).json({ error: 'Either viewerId or platform and userId are required' });
    }

    if (!viewer) {
      return res.status(404).json({ error: 'Viewer not found' });
    }

    let verificationLevel = 0;
    const verificationStatus = {
      twitch: viewer.twitch?.verified || false,
      kick: viewer.kick?.verified || false,
      x: viewer.x?.verified || false,
    };

    // Count the number of verified platforms
    verificationLevel = Object.values(verificationStatus).filter(Boolean).length;

    res.json({ verificationLevel, verificationStatus });
  } catch (error) {
    console.error(`Error fetching verification level: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;