import { Schema, model, models } from "mongoose";

const StatsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    points: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    games: { type: Number, default: 0 },
    top3: { type: Number, default: 0 },
  },
  { versionKey: false }
);

const PlayStats = models.stats || model("stats", StatsSchema);

export default PlayStats;
