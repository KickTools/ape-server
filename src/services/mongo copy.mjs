// src/services/mongo.mjs
import mongoose from "mongoose";
import logger from "../middlewares/logger.mjs";
import { Viewer } from "../models/Viewer.mjs";
import { Profile } from "../models/Profile.mjs";
import { Authorization } from "../models/Authorization.mjs";

// MongoDB URI from environment variable
const MONGO_URI = process.env.MONGO_URI;
const MOBGO_DB_NAME = process.env.DB_NAME;

// Function to connect to MongoDB and log the connection status
export async function connectMongo() {
  try {
      const options = {
          dbName: MOBGO_DB_NAME
      };

      await mongoose.connect(MONGO_URI, options);
      logger.info("✅ Connected to MongoDB using Mongoose");
      
      // Verify connection
      const collections = await mongoose.connection.db.listCollections().toArray();
      logger.info(`Available collections: ${collections.map(c => c.name).join(', ')}`);
  } catch (err) {
      logger.error(`❌ MongoDB Connection Error: ${err.message}`);
      throw err;
  }
}

export async function isMongoConnected() {
    try {
        // Check if the database connection is open
        if (mongoose.connection.readyState === 1) {
            return 'ok';
        } else {
            return 'failed';
        }
    } catch (error) {
        return 'failed';
    }
}

// Helper function to verify the connection and collection access
export async function verifyMongoSetup() {
  try {
      const viewerCount = await Viewer.countDocuments();
      logger.info(`Successfully connected to verify_viewer_viewers. Found ${viewerCount} viewers.`);
      
      const profileCount = await Profile.countDocuments();
      logger.info(`Successfully connected to verify_viewer_profiles. Found ${profileCount} profiles.`);
      
      const authCount = await Authorization.countDocuments();
      logger.info(`Successfully connected to verify_viewer_authorizations. Found ${authCount} authorizations.`);
      
      // Sample one document from each collection to verify schema
      const sampleViewer = await Viewer.findOne().populate('profile');
      if (sampleViewer) {
          logger.info(`Sample viewer: ${sampleViewer.name}, Twitch username: ${sampleViewer.twitch.username}`);
          if (sampleViewer.profile) {
              logger.info(`Sample profile email: ${sampleViewer.profile.email}`);
          }
      }
      
      const sampleAuth = await Authorization.findOne();
      if (sampleAuth) {
          logger.info(`Sample authorization: Platform: ${sampleAuth.platform}, Access Token: ${sampleAuth.access_token}`);
      }
      
      return true;
  } catch (error) {
      logger.error(`Failed to verify MongoDB setup: ${error.message}`);
      return false;
  }
}
