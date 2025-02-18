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
exports.Game = void 0;
const uuid_1 = require("uuid");
const socket_1 = require("@services/socket");
const constants_1 = require("../constants");
const player_1 = __importDefault(require("./player"));
const bomb_1 = require("./bomb");
class Game {
    constructor({ mapName, gameName }) {
        this.id = (0, uuid_1.v4)();
        this.name = gameName;
        this.mapName = mapName;
        this.layer_info = require(`../maps/${this.mapName}.json`)
            .layers[0];
        this.max_players = this.layer_info.properties.max_players;
        this.players = [];
        this.playerSpawns = [...this.layer_info.properties.spawns];
        this.shadow_map = this.createMapData();
        this.spoils = new Map();
        this.bombs = new Map();
        this.tombstones = new Map();
    }
    addPlayer(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.getUserInfo(id);
            const existPlayer = this.players.find((player) => player.name === (user === null || user === void 0 ? void 0 : user.name) && player.skin === (user === null || user === void 0 ? void 0 : user.picture));
            if (existPlayer) {
                this.playerSpawns.push(existPlayer.spawnOnGrid);
                this.players.splice(this.players.indexOf(existPlayer), 1);
            }
            const [spawn, spawnOnGrid] = this.getAndRemoveSpawn();
            const player = new player_1.default({
                id,
                skin: (user === null || user === void 0 ? void 0 : user.picture) || "",
                name: (user === null || user === void 0 ? void 0 : user.name) || "",
                spawn,
                spawnOnGrid,
            });
            this.players.push(player);
        });
    }
    processGameStats() {
        return __awaiter(this, arguments, void 0, function* (winnerId = null) {
            for (const player of this.players) {
                console.log("player:", player);
                const isWin = player.id === winnerId;
                yield player.processStats(isWin);
            }
        });
    }
    removePlayer(id) {
        const player = this.players.find((player) => player.id === id);
        if (player) {
            this.playerSpawns.push(player.spawnOnGrid);
            this.players.splice(this.players.indexOf(player), 1);
        }
    }
    isEmpty() {
        return this.players.length === 0;
    }
    isFull() {
        return this.players.length === this.max_players;
    }
    getUserInfo(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield (0, socket_1.getUserBySocketId)(id);
            return user;
        });
    }
    getAndRemoveSpawn() {
        const index = Math.floor(Math.random() * this.playerSpawns.length);
        const spawnOnGrid = this.playerSpawns[index];
        this.playerSpawns.splice(index, 1);
        const spawn = {
            x: (spawnOnGrid === null || spawnOnGrid === void 0 ? void 0 : spawnOnGrid.col) * constants_1.TILE_SIZE,
            y: (spawnOnGrid === null || spawnOnGrid === void 0 ? void 0 : spawnOnGrid.row) * constants_1.TILE_SIZE,
        };
        return [spawn, spawnOnGrid];
    }
    createMapData() {
        const { data: tiles, width, height, properties: { empty, wall, box }, } = this.layer_info;
        const mapMatrix = [];
        let i = 0;
        for (let row = 0; row < height; row++) {
            mapMatrix.push([]);
            for (let col = 0; col < width; col++) {
                mapMatrix[row][col] = constants_1.EMPTY_CELL;
                if (tiles[i] === box) {
                    mapMatrix[row][col] = constants_1.DESTRUCTIBLE_CELL;
                }
                else if (tiles[i] === wall) {
                    mapMatrix[row][col] = constants_1.NON_DESTRUCTIBLE_CELL;
                }
                i++;
            }
        }
        return mapMatrix;
    }
    addBomb({ col, row, power, }) {
        const bomb = new bomb_1.Bomb({ game: this, col, row, power });
        if (this.bombs.has(bomb.id))
            return false;
        this.bombs.set(bomb.id, bomb);
        return bomb;
    }
    getMapCell(row, col) {
        return this.shadow_map[row][col];
    }
    nullifyMapCell(row, col) {
        this.shadow_map[row][col] = constants_1.EMPTY_CELL;
    }
    findSpoil(spoil_id) {
        return this.spoils.get(spoil_id);
    }
    addSpoil(spoil) {
        this.spoils.set(spoil.id, spoil);
    }
    addTombStone({ tombId, row, col, }) {
        this.tombstones.set(tombId, { row, col });
    }
    deleteSpoil(spoil_id) {
        this.spoils.delete(spoil_id);
    }
    deleteBomb(bomb_id) {
        this.bombs.delete(bomb_id);
    }
}
exports.Game = Game;
