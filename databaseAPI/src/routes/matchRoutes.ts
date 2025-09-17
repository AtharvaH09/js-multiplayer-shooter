import express from "express";
import { Match } from "../models/matchModel";
import { Player } from "../models/playerModel";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

/**
 * Save a finished match
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { teamA, teamB, scoreA, scoreB, participants } = req.body

    const newMatch = new Match({
      teamA,
      teamB,
      scoreA,
      scoreB,
      participants,
    });

    await newMatch.save()

    // Increment matchesPlayed for each participant
    const playerIds = participants.map((p: any) => p.player)
    await Player.updateMany(
      { _id: { $in: playerIds } },
      { $inc: { matchesPlayed: 1 } }
    );

    res.status(201).json({
      message: "Match saved successfully",
      match: newMatch,
    });
  } catch (err: any) {
    console.error(`Error saving match: ${err.message}`)
    res.status(500).json({ message: "Server error occurred while saving match" })
  }
});


/**
 * Get all matches (could later filter by player ID)
 */
router.get("/", async (req, res) => {
  try {
    const matches = await Match.find().populate("participants.player", "username")
    res.json(matches)
  } catch (err: any) {
    console.error(`Error fetching matches: ${err.message}`)
    res.status(500).json({ message: "Server error occurred while fetching matches" })
  }
});

export default router;