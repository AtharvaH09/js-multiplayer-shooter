import express from "express";
import { Player } from "../models/playerModel";
import { Match } from "../models/matchModel";

const router = express.Router();

/**
 * Get top 10 players by matchesPlayed
 */
router.get("/matches", async (req, res) => {
  try {
    const players = await Player.find({}, "username matchesPlayed")
      .sort({ matchesPlayed: -1 })   // highest first
      .limit(10);

    res.status(200).json({
      message: "Top 10 players by matches played",
      leaderboard: players,
    });
  } catch (err: any) {
    console.error(`Error fetching leaderboard: ${err.message}`)
    res.status(500).json({ message: "Server error occurred while fetching leaderboard" })
  }
});

/** 
 * Kills leaderboard
 */
router.get("/kills", async (req, res) => {
  try {
    const leaderboard = await Match.aggregate([
      // Break apart participants array
      { $unwind: "$participants" },

      // Group by playerId and sum kills
      {
        $group: {
          _id: "$participants.playerId",
          totalKills: { $sum: "$participants.kills" },
        },
      },

      // Sort by kills descending
      { $sort: { totalKills: -1 } },

      // Limit top 10
      { $limit: 10 },

      // Lookup player username
      {
        $lookup: {
          from: "players", // name of Player collection
          localField: "_id",
          foreignField: "_id",
          as: "player",
        },
      },

      // Simplify the player object
      {
        $project: {
          _id: 0,
          playerId: "$_id",
          totalKills: 1,
          username: { $arrayElemAt: ["$player.username", 0] },
        },
      },
    ]);

    res.json(leaderboard)
  } catch (err) {
    console.error("Error building kills leaderboard:", err)
    res.status(500).json({ message: "Error fetching kills leaderboard" })
  }
});

/**
 * Deaths leaderboard
 */
router.get("/deaths", async (req, res) => {
  try {
    const leaderboard = await Match.aggregate([
      { $unwind: "$participants" },
      {
        $group: {
          _id: "$participants.playerId",
          totalDeaths: { $sum: "$participants.deaths" },
        },
      },
      { $sort: { totalDeaths: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "players",
          localField: "_id",
          foreignField: "_id",
          as: "player",
        },
      },
      {
        $project: {
          _id: 0,
          playerId: "$_id",
          totalDeaths: 1,
          username: { $arrayElemAt: ["$player.username", 0] },
        },
      },
    ]);

    res.json(leaderboard)
  } catch (err) {
    console.error("Error fetching deaths leaderboard:", err)
    res.status(500).json({ message: "Error fetching deaths leaderboard" })
  }
});

/**
 * K/D ratio leaderboard
 */
router.get("/kd", async (req, res) => {
  try {
    const leaderboard = await Match.aggregate([
      { $unwind: "$participants" },
      {
        $group: {
          _id: "$participants.playerId",
          totalKills: { $sum: "$participants.kills" },
          totalDeaths: { $sum: "$participants.deaths" },
        },
      },
      {
        $addFields: {
          kdRatio: {
            $cond: [
              { $eq: ["$totalDeaths", 0] },
              "$totalKills", // if deaths=0, ratio = kills
              { $divide: ["$totalKills", "$totalDeaths"] },
            ],
          },
        },
      },
      { $sort: { kdRatio: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "players",
          localField: "_id",
          foreignField: "_id",
          as: "player",
        },
      },
      {
        $project: {
          _id: 0,
          playerId: "$_id",
          totalKills: 1,
          totalDeaths: 1,
          kdRatio: { $round: ["$kdRatio", 2] },
          username: { $arrayElemAt: ["$player.username", 0] },
        },
      },
    ]);

    res.json(leaderboard);
  } catch (err) {
    console.error("Error fetching K/D leaderboard:", err)
    res.status(500).json({ message: "Error fetching K/D leaderboard" })
  }
});

export default router;