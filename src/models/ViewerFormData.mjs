// src/models/ViewerFormData.mjs
import { connectionB } from '../services/mongo.mjs';
import mongoose from 'mongoose';
import logger from "../middlewares/logger.mjs";

const viewerFormDataSchema = new mongoose.Schema({
    viewer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Viewer', // Both models are on connectionB now
        required: true 
    },
    bitcoinAddress: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true 
    },
    contactAddress: { 
        type: String, 
        required: true 
    },
}, {
    timestamps: true,
    versionKey: false
});

// Create a custom error type for duplicate Bitcoin addresses
class DuplicateBitcoinAddressError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DuplicateBitcoinAddressError';
        this.statusCode = 400;
    }
}

// Static method to check for duplicate Bitcoin address
viewerFormDataSchema.statics.checkDuplicateBitcoinAddress = async function(bitcoinAddress, excludeId = null) {
    try {
        const query = { bitcoinAddress };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }
        
        const existing = await this.findOne(query);
        if (existing) {
            logger.warn(`Duplicate Bitcoin address attempt: ${bitcoinAddress}`, {
                existingId: existing._id.toString(),
                timestamp: new Date().toISOString(),
                currentUser: global.currentUser || 'KickTools'  // Using provided login
            });
            throw new DuplicateBitcoinAddressError('This Bitcoin address is already registered');
        }
        return true;
    } catch (error) {
        if (error instanceof DuplicateBitcoinAddressError) {
            throw error;
        } else {
            logger.error(`Error checking duplicate Bitcoin address: ${error.message}`, {
                bitcoinAddress,
                excludeId: excludeId ? excludeId.toString() : null,
                stack: error.stack,
                timestamp: new Date().toISOString(),
                currentUser: global.currentUser || 'KickTools' 
            });
            throw new Error('Failed to validate Bitcoin address. Please try again later.');
        }
    }
};

// Pre-validate middleware to check for duplicates
viewerFormDataSchema.pre('validate', async function(next) {
    try {
        await ViewerFormData.checkDuplicateBitcoinAddress(this.bitcoinAddress, this._id);
        next();
    } catch (error) {
        logger.error(`Validation error for ViewerFormData: ${error.message}`, {
            viewerId: this.viewer ? this.viewer.toString() : 'unknown',
            errorName: error.name,
            timestamp: new Date().toISOString(),
            currentUser: global.currentUser || 'KickTools' 
        });
        next(error);
    }
});

// Enhanced findByViewer method with full viewer data
viewerFormDataSchema.statics.findByViewerWithDetails = async function(viewerId) {
    try {
        // Get the formData with populated viewer field
        const formData = await this.findOne({ viewer: viewerId }).populate('viewer');
        
        if (!formData) {
            logger.info(`No form data found for viewer ID: ${viewerId}`, {
                timestamp: new Date().toISOString(),
                currentUser: global.currentUser || 'KickTools'
            });
            return null;
        }
        
        return formData;
    } catch (error) {
        logger.error(`Error in findByViewerWithDetails: ${error.message}`, {
            viewerId: viewerId ? viewerId.toString() : 'unknown',
            stack: error.stack,
            timestamp: new Date().toISOString(),
            currentUser: global.currentUser || 'KickTools'
        });
        throw error;
    }
};

// Log creation and updates with current date in ISO format
viewerFormDataSchema.post('save', function(doc) {
    const currentDate = new Date().toISOString();
    logger.info(`ViewerFormData saved`, {
        id: doc._id.toString(),
        viewerId: doc.viewer.toString(),
        isNew: this.isNew,
        timestamp: currentDate,
        currentUser: global.currentUser || 'KickTools',
        formattedDate: currentDate.split('T')[0] // YYYY-MM-DD format
    });
});

export const ViewerFormData = connectionB.model('ViewerFormData', viewerFormDataSchema, "ape-user-data");
export { DuplicateBitcoinAddressError };