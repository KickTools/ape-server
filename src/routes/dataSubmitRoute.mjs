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
    if (error instanceof DuplicateEthAddressError) {
        return res.status(400).json({ 
            error: error.message,
            code: 'DUPLICATE_ETH_ADDRESS'
        });
    }
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({ 
            error: `This ${field} is already registered`,
            code: `DUPLICATE_${field.toUpperCase()}`
        });
    }
    logger.error(`Unexpected error: ${error.message}`);
    return res.status(500).json({ 
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR'
    });
};

// Route to submit or update form data
router.post('/form-data', async (req, res) => {
    try {
        const { 
            viewer, 
            bitcoinAddress, 
            contactAddress, 
            ethAddress, 
            language, 
            notifications 
        } = req.body;

        // Require viewer ID for all updates
        if (!viewer) {
            return res.status(400).json({ 
                error: 'Viewer ID is required',
                code: 'MISSING_VIEWER'
            });
        }

        const viewerDoc = await Viewer.findOne({ 'twitch.user_id': viewer });
        if (!viewerDoc) {
            return res.status(404).json({ 
                error: 'Viewer not found',
                code: 'VIEWER_NOT_FOUND' 
            });
        }

        // Check if this is a new document or an update
        let formData = await ViewerFormData.findOne({ viewer: viewerDoc._id });

        // If no existing data and required fields are missing, enforce them for new documents
        if (!formData && (!bitcoinAddress || !contactAddress)) {
            return res.status(400).json({ 
                error: 'New records require bitcoinAddress and contactAddress',
                code: 'MISSING_REQUIRED_FIELDS',
                required: ['bitcoinAddress', 'contactAddress']
            });
        }

        // Build update object with only provided fields
        const updateFields = {};
        if (bitcoinAddress !== undefined) updateFields.bitcoinAddress = bitcoinAddress;
        if (contactAddress !== undefined) updateFields.contactAddress = contactAddress;
        if (ethAddress !== undefined) updateFields.ethAddress = ethAddress; // Allow null to clear the field
        if (language !== undefined) updateFields.language = language;
        if (notifications !== undefined) updateFields.notifications = notifications;

        if (formData) {
            // Update existing document with only provided fields
            Object.assign(formData, updateFields);
            await formData.save();
        } else {
            // Create new document with defaults and provided fields
            formData = new ViewerFormData({
                viewer: viewerDoc._id,
                bitcoinAddress,
                contactAddress,
                language: 'en', // Default for new records
                notifications: false, // Default for new records
                ...updateFields // Override defaults with any provided values
            });
            await formData.save();
        }

        // Fetch the updated document to return
        const updatedFormData = await ViewerFormData.findOne({ viewer: viewerDoc._id });

        return res.status(200).json({ 
            message: 'Form data updated successfully',
            data: {
                id: updatedFormData._id,
                bitcoinAddress: updatedFormData.bitcoinAddress,
                contactAddress: updatedFormData.contactAddress,
                ethAddress: updatedFormData.ethAddress,
                language: updatedFormData.language,
                notifications: updatedFormData.notifications
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
        const viewerDoc = await Viewer.findOne({ 'twitch.user_id': twitchUserId });
        
        if (!viewerDoc) {
            logger.warn(`Viewer not found for twitch user_id: ${twitchUserId}`);
            return res.status(404).json({ error: 'Viewer not found' });
        }

        const formData = await ViewerFormData.findOne({ viewer: viewerDoc._id });
        
        if (!formData) {
            logger.warn(`Form data not found for viewer: ${viewerDoc._id}`);
            return res.status(404).json({ error: 'Form data not found' });
        }

        res.status(200).json({
            id: formData._id,
            bitcoinAddress: formData.bitcoinAddress,
            contactAddress: formData.contactAddress,
            ethAddress: formData.ethAddress,
            language: formData.language,
            notifications: formData.notifications
        });
    } catch (error) {
        logger.error(`Error fetching form data: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;