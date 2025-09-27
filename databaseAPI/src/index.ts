import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import serverless from "serverless-http";

import playerRoutes from "./routes/playerRoutes";
import matchRoutes from "./routes/matchRoutes";
import leaderboardRoutes from "./routes/leaderboardRoutes";

dotenv.config();

const app = express();
const MONGO_URL = process.env.MONGO_URL;

/**
 * Middlewares
 */
app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ],
  credentials: true
}));

/**
 * Routes
 */
app.use("/api/players", playerRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

app.get("/api", (req, res) => {
  res.send("Hello World");
});

/**
 * Database connection (runs once per cold start)
 */
mongoose.connect(MONGO_URL!)
  .then(() => console.log("Successfully connected to the Database"))
  .catch(err => console.error(`DB Error: ${err.message}`));

/**
 * Export serverless handler
 */
export const handler = serverless(app);
