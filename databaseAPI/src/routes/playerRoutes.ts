import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { generateToken } from "../utils/generateToken";

import { Player } from "../models/playerModel";

import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router()

/**
 * Get all players
 */
router.get("/", async (req, res) => {
  try {
    const players = await Player.find();
    return res.status(200).json({
      count: players.length,
      data: players
    });
  } catch (err: any) {
    console.error(`Error fetching players: ${err.message}`)
    res.status(500).json({ message: "Server error occurred while fetching players" })
  }
});

/**
 * Get a single player by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);

    if (!player) return res.status(404).json({ message: "Player not found" });

    return res.status(200).json(player);

  } catch (err: any) {
    console.error(`Error fetching player: ${err.message}`)

    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid Player ID format' });
    }

    res.status(500).json({ message: "Server error occurred while fetching player" })
  }
});

/**
 * Create a new player
 */
router.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ message: "Bad Request: username and password required" });

    // Check if username already exists
    const existingPlayer = await Player.findOne({ username });
    if (existingPlayer) {
      return res.status(409).json({ message: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Create new player doc
    const newPlayer = new Player({
      username,
      password: hashedPassword,
      isOnline: false,
      matchesParticipated: 0
    });

    await newPlayer.save()

    res.status(201).json({
      message: "Player registered successfully",
      player: {
        id: newPlayer._id,
        username: newPlayer.username,
        matchesPlayed: newPlayer.matchesPlayed
      }
    })

  } catch (err) {
    console.error(`Error saving player data`)
    res.status(500).json({ message: "Server error occurred while saving the player data" })
  }
});

/**
 * Login player
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "Bad Request: username and password required" });

    // Find player
    const player = await Player.findOne({ username });
    if (!player) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, player.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = generateToken(player._id.toString(), player.username);

    res.status(200).json({
      message: "Login successful",
      token,
      player: {
        id: player._id,
        username: player.username,
        matchesPlayed: player.matchesPlayed,
      },
    });
  } catch (err: any) {
    console.error(`Error logging in: ${err.message}`);
    res.status(500).json({ message: "Server error occurred during login" });
  }
});

/** 
 * Private route (requires login) 
 */
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user; // comes from JWT payload
    const player = await Player.findById(user.id);

    if (!player) return res.status(404).json({ message: "Player not found" });

    res.status(200).json(player);
  } catch (err) {
    console.error(`Profile error`, err);
    res.status(500).json({ message: "Server error occurred while finding a profile in" });
  }
});

export default router;