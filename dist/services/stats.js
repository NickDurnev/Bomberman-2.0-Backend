"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getByName = exports.get = exports.updatePlayerStats = exports.deleteAllStats = void 0;
const db_1 = require("../db");
const PlayStats_1 = __importDefault(require("@db/models/PlayStats"));
const User_1 = __importDefault(require("@db/models/User"));
const deleteAllStats = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, db_1.connection)();
    try {
        const result = yield PlayStats_1.default.deleteMany({});
        console.log(`Deleted ${result.deletedCount} stats records.`);
    }
    catch (error) {
        console.error("Error deleting stats records:", error);
    }
});
exports.deleteAllStats = deleteAllStats;
const updatePlayerStats = (_a) => __awaiter(void 0, [_a], void 0, function* ({ userId, kills = 0, isWin = false, points = 0, isTop3 = false, }) {
    yield (0, db_1.connection)();
    try {
        const playerStats = yield PlayStats_1.default.findOne({ userId });
        if (playerStats) {
            yield PlayStats_1.default.findOneAndUpdate({ userId }, {
                $inc: { games: 1, points, kills },
                $set: {
                    wins: isWin ? playerStats.wins + 1 : playerStats.wins,
                    top3: isTop3 ? playerStats.top3 + 1 : playerStats.top3,
                },
            });
        }
        else {
            const user = yield User_1.default.findOne({ socketID: userId });
            yield PlayStats_1.default.create({
                userId,
                userName: user.name,
                points,
                kills,
                wins: isWin,
                games: 1,
            });
        }
    }
    catch (error) {
        console.log(error);
    }
});
exports.updatePlayerStats = updatePlayerStats;
const get = (_a) => __awaiter(void 0, [_a], void 0, function* ({ skip, limit, sort }) {
    yield (0, db_1.connection)();
    try {
        const stats = yield PlayStats_1.default.find({})
            .select({ __v: 0 })
            .skip(skip)
            .limit(limit)
            .sort({ [sort]: -1 });
        const total = yield PlayStats_1.default.countDocuments();
        return { stats, total };
    }
    catch (error) {
        console.log(error);
        return { stats: [], total: 0 };
    }
});
exports.get = get;
const getByName = (_a) => __awaiter(void 0, [_a], void 0, function* ({ name, skip, limit }) {
    const stats = yield PlayStats_1.default.find({
        userName: new RegExp(name, "i"),
    })
        .select({ __v: 0 })
        .skip(skip)
        .limit(limit)
        .sort({ name: 1 });
    const total = yield PlayStats_1.default.countDocuments({
        userName: new RegExp(name, "i"),
    });
    return { stats, total };
});
exports.getByName = getByName;
