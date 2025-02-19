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

// Add a pre-save middleware to log potential errors
viewerFormDataSchema.pre('save', function(next) {
    const doc = this;
    ViewerFormData.findOne({ bitcoinAddress: doc.bitcoinAddress })
        .then(existingDoc => {
            if (existingDoc && !existingDoc._id.equals(doc._id)) {
                const error = new Error('Bitcoin address must be unique');
                logger.error(`Bitcoin address uniqueness violation: ${doc.bitcoinAddress}`);
                next(error);
            } else {
                next();
            }
        })
        .catch(err => {
            logger.error(`Error during Bitcoin address uniqueness check: ${err.message}`);
            next(err);
        });
});

// Add a post-save middleware to log successful saves
viewerFormDataSchema.post('save', function(doc) {
    logger.info(`ViewerFormData saved successfully with bitcoinAddress: ${doc.bitcoinAddress}`);
});

// Add a post-save middleware to log save errors
viewerFormDataSchema.post('save', function(error, doc, next) {
    if (error.name === 'MongoServerError' && error.code === 11000) {
        logger.error(`Duplicate key error during ViewerFormData save: ${error.message}`);
        next(new Error('Bitcoin address must be unique.'));
    } else {
        logger.error(`Error during ViewerFormData save: ${error.message}`);
        next(error);
    }
});

export const ViewerFormData = mongoose.model('ViewerFormData', viewerFormDataSchema, "verify_viewer_form_data");