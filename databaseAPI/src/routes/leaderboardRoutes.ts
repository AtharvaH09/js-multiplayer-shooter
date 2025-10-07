import express from "express";
import { Player } from "../models/playerModel";

const router = express.Router();

/**
 * Top Matches Played
 */
router.get("/matches", async (req, res) => {
  try {
    const leaderboard = await Player.find({})
      .sort({ matchesPlayed: -1 })
      .limit(10)
      .select("username matchesPlayed");
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch matches leaderboard" });
  }
});

/**
 * Top Kills
 */
router.get("/kills", async (req, res) => {
  try {
    const leaderboard = await Player.find({})
      .sort({ kills: -1 })
      .limit(10)
      .select("username kills");
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch kills leaderboard" });
  }
});

/**
 * Top K/D Ratio
 */
router.get("/kd", async (req, res) => {
  try {
    const players = await Player.find({ deaths: { $gt: 0 } })
      .select("username kills deaths");

    const leaderboard = players
      .map(p => ({
        username: p.username,
        kdRatio: +(p.deaths === 0 ? p.kills : p.kills / p.deaths).toFixed(2)
      }))
      .sort((a, b) => b.kdRatio - a.kdRatio)
      .slice(0, 10);

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch K/D leaderboard" });
  }
});

export default router;
