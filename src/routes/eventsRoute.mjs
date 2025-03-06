// Events Routing
import { Router } from "express";
import { requireAdminOrWebmaster, requireWebmasterOrOwner } from "../middlewares/adminAuth.mjs";
import { Event } from "../models/Event.mjs";
import logger from "../middlewares/logger.mjs";

const router = Router();

// Create new event
router.post("/", requireAdminOrWebmaster, async (req, res) => {
    try {
        const { name, description, date, endDate, href } = req.body;

        const event = new Event({
            name,
            description,
            date,
            endDate,
            href,
            createdBy: req.user.user_id
        });

        await event.save();

        logger.info("New event created", {
            eventId: event._id,
            createdBy: req.user.user_id
        });

        res.json({
            success: true,
            message: "Event created successfully",
            event
        });
    } catch (error) {
        logger.error("Error creating event", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to create event"
        });
    }
});

// Get all events
router.get("/", requireAdminOrWebmaster, async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};
        
        const events = await Event.find(query)
            .sort({ date: 1 })
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name');

        res.json({
            success: true,
            events
        });
    } catch (error) {
        logger.error("Error fetching events", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to fetch events"
        });
    }
});

// Update event
router.put("/:eventId", requireAdminOrWebmaster, async (req, res) => {
    try {
        const { eventId } = req.params;
        const updateData = req.body;

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        // Update the event data
        Object.assign(event, updateData);
        event.updatedBy = req.user.user_id;

        await event.save();

        logger.info("Event updated", {
            eventId,
            updatedBy: req.user.user_id
        });

        res.json({
            success: true,
            message: "Event updated successfully",
            event
        });
    } catch (error) {
        logger.error("Error updating event", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to update event"
        });
    }
});

// Delete event
router.delete("/:eventId", requireAdminOrWebmaster, async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        await Event.findByIdAndDelete(eventId);

        logger.info("Event deleted", {
            eventId,
            deletedBy: req.user.user_id
        });

        res.json({
            success: true,
            message: "Event deleted successfully"
        });
    } catch (error) {
        logger.error("Error deleting event", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to delete event"
        });
    }
});

// Archive event
router.put("/:eventId/archive", requireAdminOrWebmaster, async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        event.status = 'archived';
        event.updatedBy = req.user.user_id;
        await event.save();

        logger.info("Event archived", {
            eventId,
            archivedBy: req.user.user_id
        });

        res.json({
            success: true,
            message: "Event archived successfully",
            event
        });
    } catch (error) {
        logger.error("Error archiving event", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to archive event"
        });
    }
});

// Get public events (upcoming and ongoing only)
router.get("/public", async (req, res) => {

    try {
        const currentDate = new Date();

        const events = await Event.find({
            $or: [
                { 
                    status: 'upcoming',
                    date: { $gte: currentDate }
                },
                {
                    status: 'ongoing'
                }
            ]
        })
        .sort({ date: 1 })
        .limit(10);

        // Transform the events data for the frontend
        const transformedEvents = events.map(event => {
            const eventDate = new Date(event.date);
            return {
                day: eventDate.getDate().toString(),
                name: event.name,
                description: event.description,
                date: eventDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                href: event.href || '#',
                status: event.status
            };
        });

        res.json({
            success: true,
            events: transformedEvents
        });
    } catch (error) {
        logger.error("Error fetching public events", { 
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: "Failed to fetch events"
        });
    }
});

// Get single event by ID (if needed for event details page)
router.get("/public/:eventId", async (req, res) => {
    try {
        const { eventId } = req.params;
        const event = await Event.findOne({
            _id: eventId,
            status: { $in: ['upcoming', 'ongoing'] }
        }).select('name description date endDate href');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        res.json({
            success: true,
            event
        });
    } catch (error) {
        logger.error("Error fetching event details", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to fetch event details"
        });
    }
});

export default router;