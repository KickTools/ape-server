// src/models/ViewerGiveaways.mjs
import { connectionB } from '../services/mongo.mjs';
import mongoose from 'mongoose';
import logger from '../middlewares/logger.mjs';

const viewerGiveawaySchema = new mongoose.Schema({
  viewer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Viewer", required: true, index: true },
  total_entries: { type: Number, default: 0 },
  total_wins: { type: Number, default: 0 },
  giveaways: [{ type: mongoose.Schema.Types.ObjectId, ref: "Giveaway" }]
}, {
  timestamps: true,
  versionKey: false
});

viewerGiveawaySchema.post("save", function (error, doc, next) {
  logger.error(`Error saving ViewerGiveaways: ${error.message} for viewer_id: ${doc.viewer_id}`);
  next(error);
});

export const ViewerGiveaways = connectionB.model('ViewerGiveaways', viewerGiveawaySchema, "ape-user-giveaways");