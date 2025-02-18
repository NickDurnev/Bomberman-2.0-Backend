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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = void 0;
const stats_1 = require("@services/stats");
const getStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const skip = Number(req.query.skip) || 0;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort ? String(req.query.sort) : "points";
    const name = req.query.name ? String(req.query.name) : "";
    try {
        if (name) {
            const { stats, total } = yield (0, stats_1.getByName)({ name, skip, limit });
            res.json({ status: "success", code: 200, data: { stats, total } });
            return;
        }
        const { stats, total } = yield (0, stats_1.get)({ skip, limit, sort });
        res.json({ status: "success", code: 200, data: { stats, total } });
    }
    catch (error) {
        console.error("Error fetching stats:", error);
        res
            .status(error.status || 500)
            .json({ success: false, message: error.message });
    }
});
exports.getStats = getStats;
