import express from 'express';
import { ViewerFormData } from '../models/ViewerFormData.mjs';
import { Viewer } from '../models/Viewer.mjs';
import logger from '../middlewares/logger.mjs';

const router = express.Router();

// Route to submit or update form data
router.post('/form-data', async (req, res) => {
  try {
    const { viewer, bitcoinAddress, contactAddress } = req.body;

    // Check if the required fields are provided
    if (!viewer || !bitcoinAddress || !contactAddress) {
      logger.warn(`Missing required fields in form data submission. Viewer: ${viewer}, Bitcoin Address: ${bitcoinAddress}, Contact Address: ${contactAddress}`);
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Find the Viewer document based on the twitch user_id
    const viewerDoc = await Viewer.findOne({ 'twitch.user_id': viewer });
    if (!viewerDoc) {
      logger.warn(`Viewer not found for twitch user_id: ${viewer}`);
      return res.status(404).json({ error: 'Viewer not found' });
    }

    // Find the ViewerFormData document based on the viewer ID
    let formData = await ViewerFormData.findOne({ viewer: viewerDoc._id });

    if (formData) {
      // Update existing form data
      formData.bitcoinAddress = bitcoinAddress;
      formData.contactAddress = contactAddress;
      logger.info(`Updating form data for viewer: ${viewerDoc._id}`);
    } else {
      // Create new form data
      formData = new ViewerFormData({
        viewer: viewerDoc._id,
        bitcoinAddress,
        contactAddress
      });
      logger.info(`Creating new form data for viewer: ${viewerDoc._id}`);
    }

    // Save the form data to the database
    await formData.save();

    res.status(201).json({ message: 'Form data submitted successfully' });
  } catch (error) {
    logger.error(`Error submitting form data: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to fetch form data
router.get('/form-data/:twitchUserId', async (req, res) => {
  try {
    const { twitchUserId } = req.params;

    // Find the Viewer document based on the twitch user_id
    const viewerDoc = await Viewer.findOne({ 'twitch.user_id': twitchUserId });
    if (!viewerDoc) {
      logger.warn(`Viewer not found for twitch user_id: ${twitchUserId}`);
      return res.status(404).json({ error: 'Viewer not found' });
    }

    // Find the ViewerFormData document based on the viewer ID
    const formData = await ViewerFormData.findOne({ viewer: viewerDoc._id });

    if (!formData) {
      logger.warn(`Form data not found for viewer: ${viewerDoc._id}`);
      return res.status(404).json({ error: 'Form data not found' });
    }

    res.status(200).json(formData);
  } catch (error) {
    logger.error(`Error fetching form data: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;