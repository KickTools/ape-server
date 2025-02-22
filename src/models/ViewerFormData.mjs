import mongoose from 'mongoose';
import { Viewer } from './Viewer.mjs';
import logger from '../middlewares/logger.mjs';

const viewerFormDataSchema = new mongoose.Schema({
    viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'Viewer', required: true },
    bitcoinAddress: { type: String, required: true, unique: true, index: true },
    contactAddress: { type: String, required: true },
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
    const query = { bitcoinAddress };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }
    
    const existing = await this.findOne(query);
    if (existing) {
        throw new DuplicateBitcoinAddressError('This Bitcoin address is already registered');
    }
    return true;
};

// Pre-validate middleware to check for duplicates
viewerFormDataSchema.pre('validate', async function(next) {
    try {
        await ViewerFormData.checkDuplicateBitcoinAddress(this.bitcoinAddress, this._id);
        next();
    } catch (error) {
        next(error);
    }
});

export const ViewerFormData = mongoose.model('ViewerFormData', viewerFormDataSchema, "verify_viewer_form_data");
export { DuplicateBitcoinAddressError };