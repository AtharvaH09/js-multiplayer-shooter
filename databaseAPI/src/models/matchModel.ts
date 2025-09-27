import mongoose, { Schema, Document } from "mongoose";

interface Participant {
  player: mongoose.Types.ObjectId | string;
  kills: number;
  deaths: number;
}

export interface IMatch extends Document {
  teamA: (mongoose.Types.ObjectId | string)[];
  teamB: (mongoose.Types.ObjectId | string)[];
  scoreA: number;
  scoreB: number;
  participants: Participant[];
  endedAt: Date;
}

const matchSchema = new Schema<IMatch>({
  teamA: [{ type: Schema.Types.Mixed }],
  teamB: [{ type: Schema.Types.Mixed }],
  scoreA: { type: Number, required: true },
  scoreB: { type: Number, required: true },
  participants: [
    {
      player: { type: Schema.Types.Mixed },
      kills: Number,
      deaths: Number,
    },
  ],
  endedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const Match = mongoose.model<IMatch>("Match", matchSchema);