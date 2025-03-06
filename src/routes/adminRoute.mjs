// src/routes/adminRoute.mjs
import { Router } from "express";
import { requireAdminOrWebmaster, requireWebmasterOrOwner } from "../middlewares/adminAuth.mjs";
import { Viewer } from "../models/Viewer.mjs";
import logger from "../middlewares/logger.mjs";

const router = Router();

// Get all users with elevated privileges (admin, webmaster, owner)
router.get("/privileged-users", requireAdminOrWebmaster, async (req, res) => {
    try {
        const privilegedUsers = await Viewer.find({
            role: { $in: ["admin", "webmaster", "owner"] }
        }).select('name role twitch.username kick.username createdAt');

        res.json({
            success: true,
            users: privilegedUsers
        });
    } catch (error) {
        logger.error("Error fetching privileged users", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to fetch privileged users"
        });
    }
});

// Search Viewers
router.get("/search-viewers", requireWebmasterOrOwner, async (req, res) => {
    try {
        const searchQuery = req.query.q;
        const MIN_SEARCH_LENGTH = 4;

        if (!searchQuery || searchQuery.length < MIN_SEARCH_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Search query must be at least ${MIN_SEARCH_LENGTH} characters`
            });
        }

        const viewers = await Viewer.find({
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { "twitch.username": { $regex: searchQuery, $options: 'i' } },
                { "kick.username": { $regex: searchQuery, $options: 'i' } }
            ]
        })
            .select('name role twitch.username kick.username createdAt')
            .limit(10)
            .sort({ name: 1 }); // Sort results alphabetically

        res.json({
            success: true,
            users: viewers
        });
    } catch (error) {
        logger.error("Error searching viewers", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to search viewers"
        });
    }
});

// Update user role (only webmaster and owner can do this)
router.put("/update-role/:userId", requireWebmasterOrOwner, async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ["regular", "admin", "webmaster", "owner"];
    if (!validRoles.includes(role)) {
        return res.status(400).json({
            success: false,
            message: "Invalid role specified"
        });
    }

    // Prevent owner role assignment through API
    if (role === "owner") {
        return res.status(403).json({
            success: false,
            message: "Owner role cannot be assigned through API"
        });
    }

    try {
        const user = await Viewer.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Prevent modifying other webmaster/owner roles unless you're an owner
        if ((user.role === "webmaster" || user.role === "owner") && req.user.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Cannot modify Webmaster or Owner roles"
            });
        }

        user.role = role;
        await user.save();

        logger.info("User role updated", {
            updatedBy: req.user.user_id,
            targetUser: userId,
            newRole: role
        });

        res.json({
            success: true,
            message: "User role updated successfully",
            user: {
                id: user._id,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        logger.error("Error updating user role", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to update user role"
        });
    }
});

export default router;