import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import playerRoutes from "./routes/playerRoutes";
import matchRoutes from "./routes/matchRoutes";
import leaderboardRoutes from "./routes/leaderboardRoutes"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5555
const MONGO_URL = process.env.MONGO_URL

/**
 * Middlewares
 */
app.use(express.json())

/**
 * Routes
 */
app.use("/players", playerRoutes)
app.use("/matches", matchRoutes)
app.use("/leaderboard", leaderboardRoutes)

app.get('/', (req, res) => {
  res.send("Hello World")
});

mongoose.connect(`${MONGO_URL}`)
  .then(() => {
    console.log("Successfully connected to the Database")
    
    app.listen(PORT, () => {
      console.log(`App listening on PORT: ${PORT}`)
    });
  })
  .catch(err => {
    console.error(`Error ${err.message}`)
  });