import mongoose, { Schema, Document } from "mongoose";

interface Participant {
  player: mongoose.Types.ObjectId;
  kills: number;
  deaths: number;
}

export interface IMatch extends Document {
  teamA: mongoose.Types.ObjectId[];
  teamB: mongoose.Types.ObjectId[];
  scoreA: number;
  scoreB: number;
  participants: Participant[];
  endedAt: Date;
}

const matchSchema = new Schema<IMatch>({
  teamA: [{ type: Schema.Types.ObjectId, ref: "Player" }],
  teamB: [{ type: Schema.Types.ObjectId, ref: "Player" }],
  scoreA: { type: Number, required: true },
  scoreB: { type: Number, required: true },
  participants: [
    {
      player: { type: Schema.Types.ObjectId, ref: "Player" },
      kills: Number,
      deaths: Number,
    },
  ],
  endedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const Match = mongoose.model<IMatch>("Match", matchSchema);