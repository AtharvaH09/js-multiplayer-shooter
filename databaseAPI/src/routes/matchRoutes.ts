import express from "express";
import { Match } from "../models/matchModel";
import { Player } from "../models/playerModel";
import { authMiddleware } from "../middleware/authMiddleware";
import jwt from "jsonwebtoken";

const router = express.Router();

// Middleware that allows either SERVER_TOKEN or normal JWT
function serverOrPlayerAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Missing token" });

  const token = authHeader.split(" ")[1];

  // First check server token
  if (token === process.env.SERVER_TOKEN) {
    req.isServer = true;
    return next();
  }

  // Otherwise fall back to normal JWT
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/**
 * Save a finished match
 */
router.post("/", serverOrPlayerAuth, async (req, res) => {
  try {
    const { teamA, teamB, scoreA, scoreB, participants } = req.body;

    const newMatch = new Match({
      teamA,
      teamB,
      scoreA,
      scoreB,
      participants,
    });

    await newMatch.save();

    // Increment matchesPlayed for each participant (skip guests!)
    const playerIds = participants
      .map((p: any) => p.player)
      .filter((id: string) => !id.startsWith("Guest-"));

    if (playerIds.length > 0) {
      await Player.updateMany(
        { _id: { $in: playerIds } },
        { $inc: { matchesPlayed: 1 } }
      );
    }

    res.status(201).json({
      message: "Match saved successfully",
      match: newMatch,
    });
  } catch (err: any) {
    console.error(`Error saving match: ${err.message}`);
    res
      .status(500)
      .json({ message: "Server error occurred while saving match" });
  }
});

/**
 * Get all matches (could later filter by player ID)
 */
router.get("/", async (req, res) => {
  try {
    const matches = await Match.find().populate(
      "participants.player",
      "username"
    );
    res.json(matches);
  } catch (err: any) {
    console.error(`Error fetching matches: ${err.message}`);
    res
      .status(500)
      .json({ message: "Server error occurred while fetching matches" });
  }
});

export default router;