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
const game_1 = require("./entity/game");
const app_1 = require("./app");
// Lobby Room ID
const lobbyId = "lobby_room";
// Map to store pending games
const pendingGames = new Map();
const Lobby = {
    onEnterLobby(callback) {
        // Join the lobby room
        this.join(lobbyId);
        // Return available pending games
        callback(Lobby.availablePendingGames());
    },
    onLeaveLobby() {
        this.leave(lobbyId);
    },
    onCreateGame({ mapName, gameName }, callback) {
        const newGame = Lobby.createPendingGame({ mapName, gameName });
        // Update the lobby games list
        Lobby.updateLobbyGames();
        // Return the new game's ID
        callback({ game_id: newGame.id });
    },
    onEnterPendingGame(game_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const current_game = pendingGames.get(game_id);
            if (current_game) {
                this.join(current_game.id);
                // Save current game ID in the socket object
                this.socket_game_id = current_game.id;
                yield current_game.addPlayer(this.customId || "");
                if (current_game.isFull()) {
                    Lobby.updateLobbyGames();
                }
                Lobby.updateCurrentGame(current_game);
            }
        });
    },
    onLeavePendingGame() {
        const current_game = pendingGames.get(this.socket_game_id || "");
        if (current_game) {
            this.leave(current_game.id);
            this.socket_game_id = null;
            current_game.removePlayer(this.customId || "");
            if (current_game.isEmpty()) {
                Lobby.deletePendingGame(current_game.id);
                return;
            }
            if (!current_game.isFull()) {
                Lobby.updateLobbyGames();
            }
            Lobby.updateCurrentGame(current_game);
        }
    },
    createPendingGame({ mapName, gameName }) {
        const newGame = new game_1.Game({ mapName, gameName });
        pendingGames.set(newGame.id, newGame);
        return newGame;
    },
    deletePendingGame(game_id) {
        const game = pendingGames.get(game_id);
        if (game) {
            pendingGames.delete(game.id);
            Lobby.updateLobbyGames();
        }
        return game;
    },
    availablePendingGames() {
        return Array.from(pendingGames.values()).filter((game) => !game.isFull());
    },
    onCheckNameAvailable(gameName, callback) {
        const isAvailable = !Array.from(pendingGames.values()).some((game) => {
            return game.name === gameName;
        });
        callback({ isAvailable });
    },
    updateLobbyGames() {
        app_1.serverSocket.sockets
            .in(lobbyId)
            .emit("display pending games", Lobby.availablePendingGames());
    },
    updateCurrentGame(game) {
        // Emit the updated game to all players in the game room
        app_1.serverSocket.sockets
            .in(game.id)
            .emit("update game", { current_game: game });
    },
};
exports.default = Lobby;
