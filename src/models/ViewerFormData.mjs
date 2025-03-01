// src/models/ViewerFormData.mjs
import { connectionB } from '../services/mongo.mjs';
import mongoose from 'mongoose';
import logger from "../middlewares/logger.mjs";

const viewerFormDataSchema = new mongoose.Schema({
    viewer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Viewer',
        required: true 
    },
    bitcoinAddress: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true 
    },
    ethAddress: {
        type: String,
        required: false,
        unique: true,
        index: true,
        sparse: true // Allows null values while maintaining uniqueness
    },
    contactAddress: { 
        type: String, 
        required: true 
    },
    language: {
        type: String,
        required: false,
        default: 'en' // Default to English if not specified
    },
    notifications: {
        type: Boolean,
        required: false,
        default: false
    }
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

class DuplicateEthAddressError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DuplicateEthAddressError';
        this.statusCode = 400;
    }
}

// Check for duplicate Bitcoin address
viewerFormDataSchema.statics.checkDuplicateBitcoinAddress = async function(bitcoinAddress, viewerId, excludeId = null) {
    try {
        const query = { 
            bitcoinAddress,
            viewer: { $ne: viewerId } // Exclude the current viewer's own record
        };
        if (excludeId) query._id = { $ne: excludeId };
        
        const existing = await this.findOne(query);
        if (existing) {
            logger.warn(`Duplicate Bitcoin address attempt: ${bitcoinAddress}`, {
                existingId: existing._id.toString(),
                viewerId,
                timestamp: new Date().toISOString()
            });
            throw new DuplicateBitcoinAddressError('This Bitcoin address is already registered to another user');
        }
        return true;
    } catch (error) {
        if (error instanceof DuplicateBitcoinAddressError) throw error;
        logger.error(`Error checking duplicate Bitcoin address: ${error.message}`, {
            bitcoinAddress,
            viewerId,
            stack: error.stack
        });
        throw new Error('Failed to validate Bitcoin address');
    }
};

// Check for duplicate Ethereum address
viewerFormDataSchema.statics.checkDuplicateEthAddress = async function(ethAddress, viewerId, excludeId = null) {
    if (!ethAddress) return true;
    
    try {
        const query = { 
            ethAddress,
            viewer: { $ne: viewerId } // Exclude the current viewer's own record
        };
        if (excludeId) query._id = { $ne: excludeId };
        
        const existing = await this.findOne(query);
        if (existing) {
            logger.warn(`Duplicate Ethereum address attempt: ${ethAddress}`, {
                existingId: existing._id.toString(),
                viewerId,
                timestamp: new Date().toISOString()
            });
            throw new DuplicateEthAddressError('This Ethereum address is already registered to another user');
        }
        return true;
    } catch (error) {
        if (error instanceof DuplicateEthAddressError) throw error;
        logger.error(`Error checking duplicate Ethereum address: ${error.message}`, {
            ethAddress,
            viewerId,
            stack: error.stack
        });
        throw new Error('Failed to validate Ethereum address');
    }
};

// Pre-validate middleware to check for duplicates
viewerFormDataSchema.pre('validate', async function(next) {
    try {
        await Promise.all([
            ViewerFormData.checkDuplicateBitcoinAddress(this.bitcoinAddress, this.viewer, this._id),
            ViewerFormData.checkDuplicateEthAddress(this.ethAddress, this.viewer, this._id)
        ]);
        next();
    } catch (error) {
        logger.error(`Validation error for ViewerFormData: ${error.message}`, {
            viewerId: this.viewer ? this.viewer.toString() : 'unknown',
            errorName: error.name
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
export { DuplicateBitcoinAddressError, DuplicateEthAddressError };