import { CustomSocket, NewGamePayload } from "@types";
import { Game } from "./entity/game";
import { LOBBY_TIMEOUT } from "./constants";
import { serverSocket } from "./app";

// Lobby Room ID
const lobbyId = "lobby_room";

// Map to store pending games
const pendingGames = new Map<string, Game>();

const Lobby = {
  onEnterLobby(this: CustomSocket, callback: (games: Game[]) => void) {
    // Join the lobby room
    this.join(lobbyId);

    // Return available pending games
    callback(Lobby.availablePendingGames());
  },

  onLeaveLobby(this: CustomSocket) {
    this.leave(lobbyId);
  },

  onCreateGame(
    this: CustomSocket,
    data: NewGamePayload,
    callback: (data: { game_id: string }) => void
  ) {
    const newGame = Lobby.createPendingGame(data);
    newGame.createdAt = Date.now(); // Store timestamp
    // Update the lobby games list
    Lobby.updateLobbyGames();

    // Return the new game's ID
    callback({ game_id: newGame.id });
  },

  async onEnterPendingGame(this: CustomSocket, game_id: string) {
    const current_game = pendingGames.get(game_id);

    if (current_game) {
      this.join(current_game.id);

      // Save current game ID in the socket object
      this.socket_game_id = current_game.id;
      await current_game.addPlayer(this.customId || "");

      if (current_game.isFull()) {
        Lobby.updateLobbyGames();
      }

      Lobby.updateCurrentGame(current_game);
    }
  },

  onLeavePendingGame(this: CustomSocket) {
    const current_game = pendingGames.get(this.socket_game_id || "");

    if (current_game) {
      this.leave(current_game.id);
      this.socket_game_id = null;
      current_game.removePlayer(this.customId || "");

      if (current_game.isEmpty()) {
        Lobby.deletePendingGame(current_game.id);
        Lobby.updateLobbyGames();
        return;
      }

      if (!current_game.isFull()) {
        Lobby.updateLobbyGames();
      }

      Lobby.updateCurrentGame(current_game);
    }
  },

  createPendingGame(data: NewGamePayload) {
    const newGame = new Game(data);
    pendingGames.set(newGame.id, newGame);
    return newGame;
  },

  deletePendingGame(game_id: string) {
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

  onCheckNameAvailable(
    gameName: string,
    callback: (data: { isAvailable: boolean }) => void
  ) {
    const isAvailable = !Array.from(pendingGames.values()).some((game) => {
      return game.name === gameName;
    });

    callback({ isAvailable });
  },

  updateLobbyGames() {
    serverSocket.sockets
      .in(lobbyId)
      .emit("display pending games", Lobby.availablePendingGames());
  },

  updateCurrentGame(game: Game) {
    // Emit the updated game to all players in the game room
    serverSocket.sockets
      .in(game.id)
      .emit("update game", { current_game: game });
  },
};

// Cleanup job: Runs every 1 minute to remove stale pending games
setInterval(() => {
  const now = Date.now();
  pendingGames.forEach((game, gameId) => {
    if (now - game.createdAt >= LOBBY_TIMEOUT * 1000) {
      if (game.isEmpty()) {
        Lobby.deletePendingGame(gameId);
      }
    }
  });
}, 60 * 1000);

export default Lobby;
