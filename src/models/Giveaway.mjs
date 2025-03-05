// src/models/Giveaway.mjs
import { connectionB } from '../services/mongo.mjs';
import mongoose from 'mongoose';
import logger from '../middlewares/logger.mjs';

const giveawaySchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, enum: ["rain", "chat", "ticket"], default: "ticket" },
    start_date: { type: Date, required: true },
    end_date: { type: Date },
    status: { type: String, enum: ["active", "closed", "completed", "canceled", "archived"], default: "active" },
    winners: [{ type: mongoose.Schema.Types.ObjectId, ref: "Viewer" }],
    entrants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Viewer" }],
}, {
    timestamps: true,
    versionKey: false
});

giveawaySchema.post("save", function (error, doc, next) {
    logger.error(`Error saving Giveaway '${doc.title}': ${error.message}`);
    next(error);
  });

export const Giveaway = connectionB.model('Giveaway', giveawaySchema, "ape-giveaways");