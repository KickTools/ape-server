import { connectionB } from '../services/mongo.mjs';
import mongoose from 'mongoose';
import logger from '../middlewares/logger.mjs';

const eventSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    date: { 
        type: Date, 
        required: true 
    },
    endDate: { 
        type: Date
    },
    status: { 
        type: String, 
        enum: ['upcoming', 'ongoing', 'completed', 'cancelled', 'archived'],
        default: 'upcoming'
    },
    href: { 
        type: String,
        default: '#'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Viewer',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Viewer'
    }
}, {
    timestamps: true,
    versionKey: false
});

eventSchema.post("save", function (error, doc, next) {
    if (error) {
        logger.error(`Error saving Event '${doc.name}': ${error.message}`);
    }
    next(error);
});

export const Event = connectionB.model('Event', eventSchema, 'ape-events');