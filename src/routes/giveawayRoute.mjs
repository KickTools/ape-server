import express from "express";
import { Viewer } from "../models/Viewer.mjs";
import { ViewerGiveaways } from "../models/ViewerGiveaways.mjs";
import { Giveaway } from "../models/Giveaway.mjs";
import logger from "../middlewares/logger.mjs";
import { requireAdminOrWebmaster } from "../middlewares/adminAuth.mjs";
import crypto from 'crypto';

const router = express.Router();

function getRandomIndex(max) {
    const range = max;
    if (range <= 0) {
        throw new Error('Range must be positive');
    }
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const randomBytes = crypto.randomBytes(bytesNeeded); // Corrected line
    let randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
        randomValue = (randomValue << 8) | randomBytes[i];
    }
    return randomValue % range;
}

// GET giveaways with filtering
router.get("/", requireAdminOrWebmaster, async (req, res) => {
    try {
        const { status, type, search } = req.query;

        // Build query object based on filters
        const query = {};
        if (status && status !== 'all') query.status = status;
        if (type && type !== 'all') query.type = type;
        if (search) {
            query.title = { $regex: search, $options: 'i' }; // Case insensitive search
        }

        const giveaways = await Giveaway.find(query).lean();
        res.json({ success: true, data: giveaways });
    } catch (error) {
        logger.error(`Error fetching giveaways: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// Get eligible viewers count
router.get("/eligible-viewers", requireAdminOrWebmaster, async (req, res) => {
    try {
        const verificationLevel = parseInt(req.query.verificationLevel) || 2;

        // Build verification query based on level
        const verificationQuery = {
            $or: [
                { "twitch.verified": true },
                { "kick.verified": true },
            ],
        };

        if (verificationLevel >= 3) {
            verificationQuery["x.verified"] = true;
        }
        if (verificationLevel >= 4) {
            verificationQuery["discord.verified"] = true;
        }
        if (verificationLevel >= 5) {
            verificationQuery["telegram.verified"] = true;
        }

        const count = await Viewer.countDocuments(verificationQuery);

        res.json({
            success: true,
            data: { count }
        });
    } catch (error) {
        logger.error(`Error fetching eligible viewer count: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
});

// Admin-only: Get viewer details by ID
router.patch("/:id", requireAdminOrWebmaster, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Fields that are allowed to be updated
        const allowedFields = ['title', 'type', 'winnersCount', 'start_date', 'end_date', 'verificationLevel', 'allowPreviousWinners', 'keyword', 'followLength', 'subscribersOnly'];

        // Filter out any fields not in allowedFields
        const filteredUpdate = Object.keys(updateData)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = updateData[key];
                return obj;
            }, {});

        const giveaway = await Giveaway.findByIdAndUpdate(
            id,
            { $set: filteredUpdate },
            { new: true }
        );

        if (!giveaway) {
            return res.status(404).json({ success: false, message: "Giveaway not found" });
        }

        logger.info(`Giveaway ${id} updated successfully`);
        res.json({ success: true, data: giveaway });
    } catch (error) {
        logger.error(`Error updating giveaway ${req.params.id}: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

router.post("/viewers", requireAdminOrWebmaster, async (req, res) => {
    try {
        const { viewerIds } = req.body;
        const viewers = await Viewer.find({
            _id: { $in: viewerIds }
        }).lean().select('_id name');

        res.json({
            success: true,
            data: viewers.map(viewer => ({
                id: viewer._id,
                name: viewer.name
            }))
        });
    } catch (error) {
        logger.error(`Error fetching viewers: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// Admin-only: Create a new giveaway
router.post("/", requireAdminOrWebmaster, async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            title,
            type,
            winnersCount,
            verificationLevel,
            allowPreviousWinners,
            keyword,
            followLength,
            subscribersOnly,
            startDate,
            endDate,
        } = req.body;

        if (!title || !type) {
            return res.status(400).json({ success: false, message: "Title and type are required" });
        }

        if (type === "ticket" && (!startDate || !endDate)) {
            return res.status(400).json({ success: false, message: "Start and end dates are required for ticket giveaways" });
        }

        // Check for existing active or closed ticket giveaways
        if (type === "ticket") {
            const existingGiveaway = await Giveaway.findOne({
                type: "ticket",
                status: { $in: ["active", "closed"] }
            });

            if (existingGiveaway) {
                return res.status(400).json({
                    success: false,
                    message: `A ticket giveaway (${existingGiveaway.title}) is already active or closed but not completed. Complete or cancel it before starting a new one.`,
                });
            }
        }

        // If type is rain, set status to closed since it's instant
        const status = type === "rain" ? "closed" : "active";

        const giveaway = new Giveaway({
            title,
            type,
            status: status,
            start_date: type === "ticket" ? new Date(startDate) : new Date(), // Default to now for non-ticket
            end_date: type === "ticket" ? new Date(endDate) : null,
            winners: [],
            entrants: [],
            allowPreviousWinners: allowPreviousWinners || true,
            verificationLevel: verificationLevel || 2,
        });

        await giveaway.save();
        logger.info(`Giveaway ${title} created successfully`, { duration: Date.now() - startTime });

        res.status(201).json({
            success: true,
            data: {
                id: giveaway._id,
                title,
                type,
                status: giveaway.status,
                startDate: giveaway.start_date,
                endDate: giveaway.end_date,
            },
        });
    } catch (error) {
        logger.error(`Error creating giveaway: ${error.message}`, { duration: Date.now() - startTime });
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// Admin-only: Update giveaway status (e.g., close entries, complete)
router.patch("/:id/status", requireAdminOrWebmaster, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["active", "closed", "completed", "canceled"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const giveaway = await Giveaway.findById(id);
        if (!giveaway) {
            return res.status(404).json({ success: false, message: "Giveaway not found" });
        }

        giveaway.status = status;
        await giveaway.save();

        logger.info(`Giveaway ${id} status updated to ${status}`);
        res.json({ success: true, data: giveaway });
    } catch (error) {
        logger.error(`Error updating giveaway ${req.params.id} status: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// Admin-only: Draw winners for a giveaway
router.post("/:id/draw", requireAdminOrWebmaster, async (req, res) => {
    try {
        const { id } = req.params;
        const { winnersCount, verificationLevel, allowPreviousWinners } = req.body;

        console.log(`🔹 Received request to draw winners for giveaway ${id}`);
        console.log(`➡️ Requested winners: ${winnersCount}, Verification Level: ${verificationLevel}, Allow Previous Winners: ${allowPreviousWinners}`);

        const giveaway = await Giveaway.findById(id);
        if (!giveaway) {
            console.log(`❌ Giveaway ${id} not found.`);
            return res.status(404).json({ success: false, message: "Giveaway not found" });
        }

        if (giveaway.status === "completed") {
            console.log(`❌ Giveaway ${id} already completed.`);
            return res.status(400).json({ success: false, message: "Giveaway already completed" });
        }

        // Fetch eligible viewers based on verification level
        const verificationQuery = {
            $or: [
                { "twitch.verified": true },
                { "kick.verified": true },
            ],
        };
        if (verificationLevel >= 3) verificationQuery["x.verified"] = true;

        const viewers = await Viewer.find(verificationQuery).select("_id name").lean();
        console.log(`✅ Found ${viewers.length} eligible viewers.`);

        if (viewers.length === 0) {
            return res.status(400).json({ success: false, message: "No eligible viewers found" });
        }

        const viewerIds = viewers.map((v) => v._id);

        // Fetch ViewerGiveaways to check win history
        const viewerGiveaways = await ViewerGiveaways.find({ viewer_id: { $in: viewerIds } }).lean();
        console.log(`🔍 Found ${viewerGiveaways.length} viewer giveaway entries.`);

        const winsMap = new Map(viewerGiveaways.map((vg) => [vg.viewer_id.toString(), vg.total_wins]));

        // Build weighted pool for luck factor
        let pool = [];
        viewers.forEach((viewer) => {
            const wins = winsMap.get(viewer._id.toString()) || 0;
            if (allowPreviousWinners || wins === 0) {
                pool.push({ viewerId: viewer._id, name: viewer.name, weight: wins > 0 ? 1 : 2 });
            }
        });

        console.log(`🎲 Final pool size after filtering: ${pool.length}`);

        if (pool.length === 0) {
            return res.status(400).json({ success: false, message: "No eligible winners in the pool" });
        }

        // Shuffle and pick winners using a random selection
        const getRandomIndex = (size) => Math.floor(Math.random() * size);
        const winners = [];

        console.log(`🏆 Starting winner selection - Pool size: ${pool.length}, Winners requested: ${winnersCount}`);

        while (winners.length < winnersCount && pool.length > 0) {
            const randomIndex = getRandomIndex(pool.length);
            console.log(`🎯 Iteration ${winners.length + 1}: Selected index ${randomIndex}, Winner: ${pool[randomIndex].name}`);

            winners.push({ _id: pool[randomIndex].viewerId, name: pool[randomIndex].name });
            pool.splice(randomIndex, 1);

            console.log(`📉 Pool size after removal: ${pool.length}`);
        }

        console.log(`✅ Winners selected (${winners.length}):`, winners.map(w => w.name));

        // Update giveaway with winners
        giveaway.winners = winners.map((winner) => winner._id);
        giveaway.status = "completed";
        console.log(`💾 Saving giveaway with winners: ${giveaway.winners.length}`);
        await giveaway.save();

        // Update ViewerGiveaways for winners
        await Promise.all(
            winners.map(async (winner) => {
                try {
                    await ViewerGiveaways.findOneAndUpdate(
                        { viewer_id: winner._id },
                        {
                            $addToSet: { giveaways: giveaway._id },
                            $inc: { total_entries: 1, total_wins: 1 },
                        },
                        { upsert: true }
                    );
                    console.log(`✅ Successfully updated viewer giveaways for ${winner.name}`);
                } catch (error) {
                    console.error(`❌ Failed to update winner ${winner.name}:`, error.message);
                }
            })
        );

        console.log(`🎉 Winners drawn for giveaway ${id}: ${winners.length} selected`);
        res.json({ success: true, data: { giveaway, winners } });
    } catch (error) {
        console.error(`🔥 Error drawing winners for giveaway ${req.params.id}: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// Admin-only: Draw a single winner for a giveaway
router.post("/:id/draw-single", requireAdminOrWebmaster, async (req, res) => {
    try {
      const { id } = req.params;
      let { verificationLevel, allowPreviousWinners } = req.body;
  
      console.log(`🔹 Received request to draw a single winner for giveaway ${id}`);
      
      const giveaway = await Giveaway.findById(id);
      if (!giveaway) {
        console.log(`❌ Giveaway ${id} not found.`);
        return res.status(404).json({ success: false, message: "Giveaway not found" });
      }
  
      // Use values from the giveaway if not provided in the request
      verificationLevel = verificationLevel ?? giveaway.verificationLevel ?? 2;
      allowPreviousWinners = allowPreviousWinners ?? giveaway.allowPreviousWinners ?? false;
  
      console.log(`➡️ Using Verification Level: ${verificationLevel}, Allow Previous Winners: ${allowPreviousWinners}`);
  
      if (giveaway.status === "completed") {
        console.log(`❌ Giveaway ${id} already completed.`);
        return res.status(400).json({ success: false, message: "Giveaway already completed" });
      }
  
      // Ensure giveaway is in closed status
      if (giveaway.status !== "closed") {
        console.log(`❌ Giveaway ${id} must be closed before drawing winners.`);
        return res.status(400).json({ success: false, message: "Giveaway must be closed before drawing winners" });
      }
  
      // Check if there are entrants
      if (!giveaway.entrants || giveaway.entrants.length === 0) {
        console.log(`❌ No entrants for giveaway ${id}.`);
        return res.status(400).json({ success: false, message: "No entrants found for this giveaway" });
      }
      
      console.log(`✅ Found ${giveaway.entrants.length} entrants for this giveaway.`);
  
      // Get detailed info about the entrants
      const entrantViewers = await Viewer.find({
        _id: { $in: giveaway.entrants }
      }).select("_id name").lean();
      
      console.log(`✅ Found ${entrantViewers.length} entrant viewers with details.`);
  
      if (entrantViewers.length === 0) {
        return res.status(400).json({ success: false, message: "No valid entrants found for this giveaway" });
      }
  
      // Fetch ViewerGiveaways to check win history
      const viewerGiveaways = await ViewerGiveaways.find({ 
        viewer_id: { $in: giveaway.entrants } 
      }).lean();
      
      console.log(`🔍 Found ${viewerGiveaways.length} viewer giveaway entries for these entrants.`);
  
      const winsMap = new Map(viewerGiveaways.map((vg) => [vg.viewer_id.toString(), vg.total_wins]));
  
      // Build weighted pool for luck factor - ONLY from entrants
      let pool = [];
      entrantViewers.forEach((viewer) => {
        // Skip viewers who are already winners in this giveaway
        if (giveaway.winners.some(w => w.toString() === viewer._id.toString())) {
          console.log(`👉 Skipping viewer ${viewer.name} as they are already a winner in this giveaway.`);
          return;
        }
        
        const wins = winsMap.get(viewer._id.toString()) || 0;
        if (allowPreviousWinners || wins === 0) {
          pool.push({ viewerId: viewer._id, name: viewer.name, weight: wins > 0 ? 1 : 2 });
          console.log(`👍 Adding viewer ${viewer.name} to the pool with weight ${wins > 0 ? 1 : 2}.`);
        } else {
          console.log(`👉 Skipping viewer ${viewer.name} as they have ${wins} previous wins and allowPreviousWinners is false.`);
        }
      });
  
      console.log(`🎲 Final pool size after filtering: ${pool.length}`);
  
      if (pool.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "No eligible winners in the pool. This may be because all entrants have already won in previous giveaways and 'Allow Previous Winners' is disabled."
        });
      }
  
      // Select a single random winner
      const randomIndex = getRandomIndex(pool.length);
      const winner = pool[randomIndex];
      console.log(`🎯 Selected winner: ${winner.name}`);
      
      // Add winner to the giveaway
      giveaway.winners.push(winner.viewerId);
      
      // If all winners have been drawn, mark as completed
      const winnersCount = giveaway.winnersCount || 1; // Default to 1 if not set
      if (giveaway.winners.length >= winnersCount) {
        giveaway.status = "completed";
        console.log(`✅ All winners drawn, marking giveaway as completed`);
      }
      
      await giveaway.save();
  
      // Update ViewerGiveaways for the winner
      await ViewerGiveaways.findOneAndUpdate(
        { viewer_id: winner.viewerId },
        {
          $addToSet: { giveaways: giveaway._id },
          $inc: { total_entries: 1, total_wins: 1 },
        },
        { upsert: true }
      );
      console.log(`✅ Successfully updated viewer giveaways for ${winner.name}`);
      
      res.json({ 
        success: true, 
        data: { 
          giveaway, 
          winner: winner.viewerId,
          isComplete: giveaway.status === "completed"
        } 
      });
      
    } catch (error) {
      console.error(`🔥 Error drawing single winner for giveaway ${req.params.id}: ${error.message}`);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  });

// User or Admin: Enter a ticket giveaway (Primal Pass Pick)
router.post("/:id/enter", async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id; // From auth middleware

        const giveaway = await Giveaway.findById(id);
        if (!giveaway || giveaway.type !== "ticket") {
            return res.status(404).json({ success: false, message: "Ticket giveaway not found" });
        }

        if (giveaway.status !== "active") {
            return res.status(400).json({ success: false, message: "Giveaway is not active" });
        }

        if (new Date() < giveaway.start_date || new Date() > giveaway.end_date) {
            return res.status(400).json({ success: false, message: "Giveaway is not within entry period" });
        }

        const viewer = await Viewer.findOne({
            $or: [
                { "twitch.user_id": userId },
                { "kick.user_id": userId },
                { "x.user_id": userId },
            ],
        });
        if (!viewer) {
            return res.status(404).json({ success: false, message: "Viewer not found" });
        }

        // Check if already entered
        if (giveaway.entrants.includes(viewer._id)) {
            return res.status(400).json({ success: false, message: "You have already entered this giveaway" });
        }

        giveaway.entrants.push(viewer._id);
        await giveaway.save();

        await ViewerGiveaways.findOneAndUpdate(
            { viewer_id: viewer._id },
            {
                $addToSet: { giveaways: giveaway._id },
                $inc: { total_entries: 1 },
            },
            { upsert: true }
        );

        logger.info(`Viewer ${viewer._id} entered giveaway ${id}`);

        // Return additional information for UI feedback
        res.json({
            success: true,
            message: "Successfully entered giveaway",
            data: {
                enteredAt: new Date(),
                totalEntries: giveaway.entrants.length
            }
        });
    } catch (error) {
        logger.error(`Error entering giveaway ${req.params.id}: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

router.get("/:id/entry-status", async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id; // From auth middleware

        const giveaway = await Giveaway.findById(id);
        if (!giveaway) {
            return res.status(404).json({ success: false, message: "Giveaway not found" });
        }

        const viewer = await Viewer.findOne({
            $or: [
                { "twitch.user_id": userId },
                { "kick.user_id": userId },
                { "x.user_id": userId },
            ],
        });

        if (!viewer) {
            return res.status(404).json({ success: false, message: "Viewer not found" });
        }

        const hasEntered = giveaway.entrants.includes(viewer._id);

        res.json({
            success: true,
            data: {
                hasEntered,
                giveawayStatus: giveaway.status,
                isWinner: giveaway.winners.includes(viewer._id),
                totalEntrants: giveaway.entrants.length,
                giveaway: {
                    id: giveaway._id,
                    title: giveaway.title,
                    startDate: giveaway.start_date,
                    endDate: giveaway.end_date,
                    type: giveaway.type,
                    status: giveaway.status
                }
            }
        });
    } catch (error) {
        logger.error(`Error checking entry status for giveaway ${req.params.id}: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

router.get("/analytics", requireAdminOrWebmaster, async (req, res) => {
    try {
        // Aggregate total counts
        const totalCount = await Giveaway.countDocuments();
        const activeCount = await Giveaway.countDocuments({ status: "active" });
        const closedCount = await Giveaway.countDocuments({ status: "closed" });
        const completedCount = await Giveaway.countDocuments({ status: "completed" });

        // Count total winners
        const giveaways = await Giveaway.find({ winners: { $exists: true, $ne: [] } });
        const winnerCount = giveaways.reduce((acc, giveaway) => acc + giveaway.winners.length, 0);

        // Count by type
        const rainCount = await Giveaway.countDocuments({ type: "rain" });
        const chatCount = await Giveaway.countDocuments({ type: "chat" });
        const ticketCount = await Giveaway.countDocuments({ type: "ticket" });

        // Recent activity (last 10 giveaways)
        const recentGiveaways = await Giveaway.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        res.json({
            success: true,
            data: {
                totalCount,
                activeCount,
                closedCount,
                completedCount,
                winnerCount,
                typeBreakdown: {
                    rain: rainCount,
                    chat: chatCount,
                    ticket: ticketCount
                },
                recentActivity: recentGiveaways
            }
        });
    } catch (error) {
        logger.error(`Error fetching giveaway analytics: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

export default router;