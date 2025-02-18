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
const uuid_1 = require("uuid");
const _constants_1 = require("@constants");
const lobby_1 = __importDefault(require("./lobby"));
const app_1 = require("./app");
const runningGames = new Map();
class Play {
    constructor(id, leave, broadcast) {
        this.socket_game_id = null;
        this.id = id;
        this.leave = leave;
        this.broadcast = broadcast;
    }
    onLeaveGame() {
        if (this.socket_game_id) {
            runningGames.delete(this.socket_game_id);
            this.leave(this.socket_game_id);
            this.socket_game_id = null;
        }
    }
    onStartTimer(game_id) {
        this.socket_game_id = game_id;
        app_1.serverSocket.sockets.in(game_id).emit("start timer");
    }
    onStartGame(game_id) {
        this.socket_game_id = game_id;
        const game = lobby_1.default.deletePendingGame(this.socket_game_id);
        if (!game)
            return; // Type check to ensure `game` is defined
        runningGames.set(game.id, game);
        console.log(`Game ${game.id} has started...`);
        this.endGame({
            game_id: game.id,
            mapName: game.mapName,
            gameName: game.name,
            delay: _constants_1.GAME_DURATION,
            isProcessStats: false,
        });
        app_1.serverSocket.sockets.in(game.id).emit("launch game", game);
    }
    onGetCurrentGame(game_id) {
        return runningGames.get(game_id);
    }
    endGame(_a) {
        return __awaiter(this, arguments, void 0, function* ({ game_id, mapName, gameName, winnerId = null, isProcessStats = true, delay, }) {
            const currentGame = runningGames.get(game_id);
            if (!currentGame)
                return;
            if (isProcessStats) {
                yield currentGame.processGameStats(winnerId);
            }
            setTimeout(() => {
                const newGame = lobby_1.default.createPendingGame({ mapName, gameName });
                runningGames.delete(game_id);
                app_1.serverSocket.sockets.to(game_id).emit("end game", {
                    game_id: game_id,
                    new_game_id: newGame.id,
                    prevGameInfo: currentGame,
                });
                console.log(`Game ${game_id} has finished...`);
            }, delay * 1000);
        });
    }
    updatePlayerPosition({ x, y, playerId, gameId }) {
        const coordinates = { x, y };
        this.broadcast
            .to(gameId)
            .emit("move player", Object.assign({ player_id: playerId }, coordinates));
    }
    onDisconnectFromGame() {
        if (this.socket_game_id) {
            const currentGame = runningGames.get(this.socket_game_id);
            if (currentGame) {
                app_1.serverSocket.sockets
                    .in(this.socket_game_id)
                    .emit("player disconnect", { player_id: this.id });
            }
        }
    }
    createBomb({ col, row, playerId, gameId }) {
        var _a;
        const currentGame = runningGames.get(gameId);
        if (!currentGame)
            return;
        const currentPlayer = currentGame.players.find((player) => player.id === playerId);
        const bomb = currentGame.addBomb({
            col,
            row,
            power: (_a = currentPlayer === null || currentPlayer === void 0 ? void 0 : currentPlayer.power) !== null && _a !== void 0 ? _a : 1,
        });
        if (bomb) {
            setTimeout(() => {
                this.detonateBomb({ bomb_id: bomb.id, playerId, gameId });
            }, bomb.explosion_time);
            app_1.serverSocket.sockets.to(gameId).emit("show bomb", {
                bomb_id: bomb.id,
                playerId,
                col: bomb.col,
                row: bomb.row,
            });
        }
    }
    detonateBomb({ bomb_id, playerId, gameId }) {
        const currentGame = runningGames.get(gameId);
        if (!currentGame)
            return;
        const bomb = currentGame.bombs.get(bomb_id);
        if (bomb) {
            const blastedCells = bomb.detonate();
            currentGame.deleteBomb(bomb_id);
            app_1.serverSocket.sockets.to(gameId).emit("detonate bomb", {
                bomb_id: bomb.id,
                playerId,
                blastedCells,
            });
        }
    }
    onBlastVsBomb({ bomb_id, playerId, gameId }) {
        this.detonateBomb({ bomb_id, playerId, gameId });
    }
    onPickUpSpoil({ spoil_id, playerId, gameId }) {
        const currentGame = runningGames.get(gameId);
        if (!currentGame)
            return;
        const currentPlayer = currentGame.players.find((player) => player.id === playerId);
        const spoil = currentGame.findSpoil(spoil_id);
        if (spoil) {
            currentGame.deleteSpoil(spoil.id);
            currentPlayer === null || currentPlayer === void 0 ? void 0 : currentPlayer.pickSpoil(spoil.spoil_type);
            app_1.serverSocket.sockets.to(gameId).emit("spoil was picked", {
                player_id: currentPlayer === null || currentPlayer === void 0 ? void 0 : currentPlayer.id,
                spoil_id: spoil.id,
                spoil_type: spoil.spoil_type,
            });
        }
    }
    onPlayerDied({ col, row, playerId, gameId, killerId }) {
        const currentGame = runningGames.get(gameId);
        if (!currentGame)
            return;
        const tombId = (0, uuid_1.v4)();
        currentGame.addTombStone({ tombId, row, col });
        app_1.serverSocket.sockets
            .to(gameId)
            .emit("show tombstone", { player_id: playerId, tombId, col, row });
        const currentPlayer = currentGame.players.find((player) => player.id === playerId);
        currentPlayer === null || currentPlayer === void 0 ? void 0 : currentPlayer.dead();
        const currentKiller = currentGame.players.find((player) => player.id === killerId);
        currentKiller === null || currentKiller === void 0 ? void 0 : currentKiller.kill(playerId);
        let alivePlayersCount = 0;
        let alivePlayer = null;
        for (const player of Object.values(currentGame.players)) {
            if (player.isAlive) {
                alivePlayersCount += 1;
                alivePlayer = player;
            }
        }
        if (alivePlayersCount === 3) {
            currentGame.players.forEach((player) => {
                player.top3();
            });
        }
        if (alivePlayersCount < 2 && alivePlayer) {
            app_1.serverSocket.sockets
                .to(gameId)
                .emit("player win", { winner: alivePlayer, prevGameInfo: currentGame });
            this.endGame({
                game_id: gameId,
                mapName: currentGame.mapName,
                gameName: currentGame.name,
                winnerId: alivePlayer.id,
                delay: 5,
            });
        }
        if (!alivePlayersCount) {
            this.endGame({
                game_id: gameId,
                mapName: currentGame.mapName,
                gameName: currentGame.name,
                delay: 0,
            });
        }
    }
}
exports.default = Play;
