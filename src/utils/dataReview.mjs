// src/utils/dataReview.mjs
import mongoose from 'mongoose';
import { Profile } from "../models/Profile.mjs";
import { Viewer } from "../models/Viewer.mjs";
import { Authorization } from "../models/Authorization.mjs";
import { ViewerFormData } from "../models/ViewerFormData.mjs";
import logger from "../middlewares/logger.mjs";
import { paginateResults } from './pagination.mjs';

// Enhanced viewer list with pagination and filtering
export async function getViewersList(options = {}) {
  try {
    const {
      page = 1,
      limit = 10,
      platform,
      verified,
      search,
      sortBy = 'createdAt',
      sortOrder = -1
    } = options;

    let query = Viewer.find();

    // Apply filters
    if (platform) {
      query = query.where(`${platform}.verified`).exists(true);
    }
    if (verified !== undefined) {
      const platformPath = platform ? `${platform}.verified` : {
        $or: [
          { 'twitch.verified': verified },
          { 'kick.verified': verified }
        ]
      };
      query = query.where(platformPath);
    }
    if (search) {
      query = query.or([
        { name: new RegExp(search, 'i') },
        { 'twitch.username': new RegExp(search, 'i') },
        { 'kick.username': new RegExp(search, 'i') }
      ]);
    }

    // Apply sorting
    const sortField = sortBy === 'name' ? 'name' : 'createdAt';
    query = query.sort({ [sortField]: sortOrder });

    // Get total count for pagination
    const totalDocs = await Viewer.countDocuments(query);

    // Apply pagination
    query = paginateResults(query, page, limit);

    // Populate related data
    query = query
      .populate('twitch.profile')
      .populate('kick.profile')
      .populate('twitch.auth')
      .populate('kick.auth');

    const viewers = await query.exec();

    return {
      viewers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalDocs / limit),
        totalItems: totalDocs,
        itemsPerPage: limit
      }
    };
  } catch (error) {
    logger.error(`Error fetching viewers list: ${error.message}`);
    throw error;
  }
}

// Enhanced profile retrieval with full platform data
export async function getViewerProfile(platform, userId) {
  try {
    const viewer = await Viewer.findOne({
      [`${platform}.user_id`]: userId
    })
      .populate({
        path: `${platform}.profile`,
        model: 'Profile'
      })
      .populate({
        path: `${platform}.auth`,
        model: 'Authorization'
      })
      .populate('ViewerFormData');

    if (!viewer) {
      throw new Error(`Viewer not found for ${platform} user ID: ${userId}`);
    }

    // Transform the data into a more usable format
    const platformData = viewer[platform];
    const formData = await ViewerFormData.findOne({ viewer: viewer._id });

    return {
      viewerId: viewer._id,
      name: viewer.name,
      platform: {
        userId: platformData.user_id,
        username: platformData.username,
        verified: platformData.verified,
        verifiedAt: platformData.verified_at
      },
      profile: platformData.profile,
      authorization: platformData.auth,
      formData: formData || null,
      createdAt: viewer.createdAt,
      updatedAt: viewer.updatedAt
    };
  } catch (error) {
    logger.error(`Error fetching viewer profile: ${error.message}`);
    throw error;
  }
}

// Utility function to get all profiles
export async function getAllProfiles() {
  try {
    const profiles = await Profile.find({});
    return profiles;
  } catch (error) {
    logger.error(`Error fetching profiles: ${error.message}`);
    throw error;
  }
}

// Utility function to get a single profile by email
export async function getProfileByEmail(email) {
  try {
    const profile = await Profile.findOne({ email });
    return profile;
  } catch (error) {
    logger.error(`Error fetching profile with email ${email}: ${error.message}`);
    throw error;
  }
}

// Utility function to get all viewers
export async function getAllViewers() {
  try {
    const viewers = await Viewer.find({}).populate('profile').populate('twitch.auth').populate('kick.auth');
    return viewers;
  } catch (error) {
    logger.error(`Error fetching viewers: ${error.message}`);
    throw error;
  }
}

// Utility function to get a single viewer by user ID for a specific platform
export async function getViewerByUserId(platform, userId) {
  try {
    const query = {};
    query[`${platform}.user_id`] = userId;

    const viewer = await Viewer.findOne(query)
      // Deep populate both platform profiles and auth
      .populate({
        path: `${platform}.auth`,
        model: 'Authorization'
      })
      .populate({
        path: `${platform}.profile`,
        model: 'Profile'
      })
      // Also populate the other platform's data if it exists
      .populate({
        path: `${platform === 'twitch' ? 'kick.auth' : 'twitch.auth'}`,
        model: 'Authorization'
      })
      .populate({
        path: `${platform === 'twitch' ? 'kick.profile' : 'twitch.profile'}`,
        model: 'Profile'
      });

    if (!viewer) {
      throw new Error(`No viewer found for ${platform} user ID ${userId}`);
    }

    // Transform the data to include full profile information
    const transformedViewer = viewer.toObject();

    // Ensure both platform's profile data is properly structured
    if (transformedViewer.twitch?.profile) {
      transformedViewer.twitch = {
        ...transformedViewer.twitch,
        profileData: transformedViewer.twitch.profile
      };
    }

    if (transformedViewer.kick?.profile) {
      transformedViewer.kick = {
        ...transformedViewer.kick,
        profileData: transformedViewer.kick.profile
      };
    }

    console.log('Transformed viewer data:', JSON.stringify(transformedViewer, null, 2));
    return transformedViewer;
  } catch (error) {
    logger.error(`Error fetching viewer with user ID ${userId} on platform ${platform}: ${error.message}`);
    throw error;
  }
}

// Utility function to get all authorizations
export async function getAllAuthorizations() {
  try {
    const authorizations = await Authorization.find({});
    return authorizations;
  } catch (error) {
    logger.error(`Error fetching authorizations: ${error.message}`);
    throw error;
  }
}

// Utility function to get authorization by user ID for a specific platform
export async function getAuthorizationByUserId(platform, userId) {
  try {
    const authorization = await Authorization.findOne({ platform, user_id: userId });
    return authorization;
  } catch (error) {
    logger.error(`Error fetching authorization with user ID ${userId} on platform ${platform}: ${error.message}`);
    throw error;
  }
}

// Enhanced authorization check
export async function checkAuthorization(platform, userId) {
  try {
    const auth = await Authorization.findOne({
      platform,
      user_id: userId
    });

    if (!auth) {
      return { authorized: false };
    }

    const now = new Date();
    const isExpired = auth.expires_at && auth.expires_at < now;

    return {
      authorized: !isExpired,
      expires_at: auth.expires_at,
      needs_refresh: isExpired || (auth.expires_at && auth.expires_at.getTime() - now.getTime() < 3600000) // Less than 1 hour until expiration
    };
  } catch (error) {
    logger.error(`Error checking authorization: ${error.message}`);
    throw error;
  }
}
