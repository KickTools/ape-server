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
      search,
      sortBy = 'createdAt',
      sortOrder = -1
    } = options;

    let query = Viewer.find();

    // Apply filters only if explicitly set
    if (platform) {
      query = query.where(`${platform}.verified`).exists(true);
    }

    if (search && search.trim() !== "") {
      query = query.or([
        { name: new RegExp(search, 'i') },
        { 'twitch.username': new RegExp(search, 'i') },
        { 'kick.username': new RegExp(search, 'i') }
      ]);
    } 

    const sortField = sortBy === 'name' ? 'name' : 'createdAt';
    query = query.sort({ [sortField]: sortOrder });

    const totalDocs = await Viewer.countDocuments(query.getFilter());
    query = paginateResults(query, page, limit);

    query = query.populate('twitch.profile').populate('kick.profile');
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

export async function getAllViewerDataByUserId(platform, userId) {
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

    return transformedViewer;
  } catch (error) {
    logger.error(`Error fetching viewer with user ID ${userId} on platform ${platform}: ${error.message}`);
    throw error;
  }
}

// Utility function to get a single viewer by user ID for a specific platform
export async function getViewerByUserId(platform, userId) {
  try {
    const query = {};
    query[`${platform}.user_id`] = userId;

    const viewer = await Viewer.findOne(query)
      .populate({
        path: `${platform}.profile`,
        model: 'Profile'
      })
      .populate({
        path: `${platform === 'twitch' ? 'kick.profile' : 'twitch.profile'}`,
        model: 'Profile'
      });

    if (!viewer) {
      throw new Error(`No viewer found for ${platform} user ID ${userId}`);
    }

    // Transform the data to match the frontend interface
    const transformedViewer = {
      viewer_id: viewer._id,
      twitch: viewer.twitch?.profile?.twitch 
        ? {
            user_id: viewer.twitch.user_id,
            login: viewer.twitch.profile.twitch.login,
            display_name: viewer.twitch.profile.twitch.display_name,
            type: viewer.twitch.profile.twitch.type,
            broadcaster_type: viewer.twitch.profile.twitch.broadcaster_type,
            description: viewer.twitch.profile.twitch.description,
            profile_image_url: viewer.twitch.profile.twitch.profile_image_url,
            offline_image_url: viewer.twitch.profile.twitch.offline_image_url,
            view_count: viewer.twitch.profile.twitch.view_count,
            followers_count: viewer.twitch.profile.twitch.followers_count,
            email: viewer.twitch.profile.twitch.email,
            created_at: viewer.twitch.profile.twitch.created_at,
          }
        : null,
      kick: viewer.kick?.profile?.kick
        ? {
            id: viewer.kick.profile.kick.id,
            user_id: viewer.kick.profile.kick.user_id,
            slug: viewer.kick.profile.kick.slug,
            chatroom_id: viewer.kick.profile.kick.chatroom_id,
            username: viewer.kick.profile.kick.username,
            profile_pic: viewer.kick.profile.kick.profile_pic,
            bio: viewer.kick.profile.kick.bio,
            is_banned: viewer.kick.profile.kick.is_banned,
            vod_enabled: viewer.kick.profile.kick.vod_enabled,
            subscription_enabled: viewer.kick.profile.kick.subscription_enabled,
            is_affiliate: viewer.kick.profile.kick.is_affiliate,
            is_verified: viewer.kick.profile.kick.is_verified,
            followers_count: viewer.kick.profile.kick.followers_count,
            banner_image_url: viewer.kick.profile.kick.banner_image_url,
            created_at: viewer.kick.profile.kick.created_at,
            social_links: viewer.kick.profile.kick.social_links || {}
          }
        : null
    };

    // Remove null values
    if (!transformedViewer.twitch) delete transformedViewer.twitch;
    if (!transformedViewer.kick) delete transformedViewer.kick;

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
