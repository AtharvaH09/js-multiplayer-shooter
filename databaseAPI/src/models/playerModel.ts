import mongoose from "mongoose";

export interface IPlayer extends Document {
  username: string;
  password: string;
  isOnline: boolean;
  lastSeen: Date;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  kills: number;
  deaths: number;
}

const PlayerSchema = new mongoose.Schema<IPlayer>(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // hashed
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    matchesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export const Player = mongoose.model('Players', PlayerSchema);