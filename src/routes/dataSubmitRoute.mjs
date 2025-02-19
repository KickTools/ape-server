// src/routes/dataSubmitRoute.mjs
import express from 'express';
import { ViewerFormData, DuplicateBitcoinAddressError } from '../models/ViewerFormData.mjs';
import { Viewer } from '../models/Viewer.mjs';
import logger from '../middlewares/logger.mjs';

const router = express.Router();

// Helper function to handle errors
const handleError = (error, res) => {
  if (error instanceof DuplicateBitcoinAddressError) {
      return res.status(400).json({ 
          error: error.message,
          code: 'DUPLICATE_BITCOIN_ADDRESS'
      });
  }
  
  if (error.code === 11000) {
      return res.status(400).json({ 
          error: 'This Bitcoin address is already registered',
          code: 'DUPLICATE_BITCOIN_ADDRESS'
      });
  }
  console.error(error);
  logger.error(`Unexpected error: ${error.message}`);
  return res.status(500).json({ 
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR'
  });
};

// Route to submit or update form data
router.post('/form-data', async (req, res) => {
  try {
      const { viewer, bitcoinAddress, contactAddress } = req.body;

      // Validate required fields
      if (!viewer || !bitcoinAddress || !contactAddress) {
          return res.status(400).json({ 
              error: 'All fields are required',
              code: 'MISSING_FIELDS',
              fields: ['viewer', 'bitcoinAddress', 'contactAddress']
          });
      }

      // Find the Viewer document
      const viewerDoc = await Viewer.findOne({ 'twitch.user_id': viewer });
      if (!viewerDoc) {
          return res.status(404).json({ 
              error: 'Viewer not found',
              code: 'VIEWER_NOT_FOUND' 
          });
      }

      // Check for duplicate Bitcoin address before attempting save/update
      const isIt = await ViewerFormData.checkDuplicateBitcoinAddress(bitcoinAddress);

      // Find existing form data or create new
      let formData = await ViewerFormData.findOne({ viewer: viewerDoc._id });
      
      if (formData) {
          // Update existing
          formData.bitcoinAddress = bitcoinAddress;
          formData.contactAddress = contactAddress;
      } else {
          // Create new
          formData = new ViewerFormData({
              viewer: viewerDoc._id,
              bitcoinAddress,
              contactAddress
          });
      }

      await formData.save();
      
      return res.status(201).json({ 
          message: 'Form data submitted successfully',
          data: {
              id: formData._id,
              bitcoinAddress: formData.bitcoinAddress,
              contactAddress: formData.contactAddress
          }
      });

  } catch (error) {
      return handleError(error, res);
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