"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const StatsSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true },
    userName: { type: String, required: true },
    points: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    games: { type: Number, default: 0 },
    top3: { type: Number, default: 0 },
}, { versionKey: false });
const PlayStats = mongoose_1.models.stats || (0, mongoose_1.model)("stats", StatsSchema);
exports.default = PlayStats;
