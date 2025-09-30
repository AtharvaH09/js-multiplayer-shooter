import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import playerRoutes from "./routes/playerRoutes";
import matchRoutes from "./routes/matchRoutes";
import leaderboardRoutes from "./routes/leaderboardRoutes";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5555;
const MONGO_URL = process.env.MONGO_URL as string;

/**
 * Middlewares
 */
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:3000", 
      "http://127.0.0.1:3000", 
      "http://localhost:5173", 
      "http://127.0.0.1:5173", 
    ],
    credentials: true,
  })
);

/**
 * Routes
 */
app.use("/players", playerRoutes);
app.use("/matches", matchRoutes);
app.use("/leaderboard", leaderboardRoutes);

app.get('/', (req, res) => {
  res.send("Hello World");
});

// Connect to the database and start the server
mongoose.connect(MONGO_URL)
  .then(() => {
    console.log("Successfully connected to the Database");
    app.listen(PORT, () => {
      console.log(`App listening on PORT: ${PORT}`);
    });
  })
  .catch(err => {
    console.error(`Error: ${err.message}`);
  });
