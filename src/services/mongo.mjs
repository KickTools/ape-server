// src/services/mongo.mjs
import mongoose from "mongoose";
import logger from "../middlewares/logger.mjs";

// Create two separate mongoose connections
const connectionA = mongoose.createConnection();
const connectionB = mongoose.createConnection();

// Function to connect to both MongoDB instances
export async function connectMongo() {
  try {
    // Connection A - KickTools database
    const optionsA = {
      dbName: process.env.MONGO_DB_A
    };
    
    await connectionA.openUri(process.env.MONGO_URI_A, optionsA);
    logger.info("✅ Connected to MongoDB A (KickTools) using Mongoose");
    
    // Verify connection A
    const collectionsA = await connectionA.db.listCollections().toArray();
    logger.info(`Available collections in DB A: ${collectionsA.map(c => c.name).join(', ')}`);
    
    // Connection B - Ape Gang database
    const optionsB = {
      dbName: process.env.MONGO_DB_B
    };
    
    await connectionB.openUri(process.env.MONGO_URI_B, optionsB);
    logger.info("✅ Connected to MongoDB B (Ape Gang) using Mongoose");
    
    // Verify connection B
    const collectionsB = await connectionB.db.listCollections().toArray();
    logger.info(`Available collections in DB B: ${collectionsB.map(c => c.name).join(', ')}`);
    
    return { connectionA, connectionB };
  } catch (err) {
    logger.error(`❌ MongoDB Connection Error: ${err.message}`);
    throw err;
  }
}

// Check connection status for both connections
export async function isMongoConnected() {
  try {
    // Check if both database connections are open
    if (connectionA.readyState === 1 && connectionB.readyState === 1) {
      return 'ok';
    } else {
      return 'failed';
    }
  } catch (error) {
    return 'failed';
  }
}

// Helper function to verify the connection and collection access for Connection A
export async function verifyMongoSetupA() {
  try {
    // Import models that will be associated with Connection A
    const { Viewer } = await import("../models/Viewer.mjs");
    const { Profile } = await import("../models/Profile.mjs");
    const { Authorization } = await import("../models/Authorization.mjs");
    
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
    logger.error(`Failed to verify MongoDB setup for Connection A: ${error.message}`);
    return false;
  }
}

// Helper function to verify the connection and collection access for Connection B
export async function verifyMongoSetupB() {
  try {
    // Import models that will be associated with Connection B
    const { VerifyViewerGlobalStats, VerifyViewerDailyStats } = await import("../models/Analytics.mjs");
    
    const stats = await VerifyViewerGlobalStats.findOne();
    logger.info(`Successfully connected to ape-globalStats. Stats found: ${stats ? 'yes' : 'no'}`);
    
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = await VerifyViewerDailyStats.findOne({ date: today });
    logger.info(`Successfully connected to ape-dailyStats. Today's stats found: ${dailyStats ? 'yes' : 'no'}`);
    
    return true;
  } catch (error) {
    logger.error(`Failed to verify MongoDB setup for Connection B: ${error.message}`);
    return false;
  }
}

// Export connections to be used in models
export { connectionA, connectionB };