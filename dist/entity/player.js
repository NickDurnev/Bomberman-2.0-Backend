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
const constants_1 = require("../constants");
const stats_1 = require("@services/stats");
class Player {
    constructor({ id, skin, name, spawn, spawnOnGrid }) {
        this.id = id;
        this.skin = skin;
        this.name = name;
        this.spawn = spawn;
        this.spawnOnGrid = spawnOnGrid;
        this.isAlive = true;
        this.isTop3 = false;
        this.power = constants_1.INITIAL_POWER;
        this.kills = [];
    }
    pickSpoil(spoil_type) {
        if (spoil_type === constants_1.POWER) {
            this.power += constants_1.STEP_POWER;
        }
    }
    kill(playerId) {
        if (this.id === playerId)
            return;
        this.kills.push(playerId);
    }
    dead() {
        this.isAlive = false;
    }
    top3() {
        this.isTop3 = true;
    }
    processStats(isWin) {
        return __awaiter(this, void 0, void 0, function* () {
            const pointsPerTop3 = this.isTop3 ? constants_1.POINTS_PER_TOP3 : 0;
            const pointsPerWin = isWin ? constants_1.POINTS_PER_WIN : 0;
            const points = this.kills.length * constants_1.POINTS_PER_KILL + pointsPerTop3 + pointsPerWin;
            yield (0, stats_1.updatePlayerStats)({
                userId: this.id,
                points,
                isWin,
                kills: this.kills.length,
                isTop3: this.isTop3,
            });
        });
    }
}
exports.default = Player;
