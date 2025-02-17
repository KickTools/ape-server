import mongoose from 'mongoose';
import { Viewer } from './Viewer.mjs';  // Adjust the import path as necessary

const viewerFormDataSchema = new mongoose.Schema({
    viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'Viewer', required: true },
    bitcoinAddress: { type: String, required: true },
    contactAddress: { type: String, required: true },
}, {
    timestamps: true,
    versionKey: false
});

export const ViewerFormData = mongoose.model('ViewerFormData', viewerFormDataSchema, "verify_viewer_form_data");