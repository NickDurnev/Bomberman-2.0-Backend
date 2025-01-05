import { Game } from "@entity/game";
import {
  Coordinates,
  BombDetails,
  SpoilDetails,
  PlayerPositionData,
} from "@types";
import { GAME_DURATION } from "@constants";
import Lobby from "./lobby";
import { serverSocket } from "./app";

const runningGames: Map<string, Game> = new Map();

class Play {
  socket_game_id: string | null = null;
  id: string;
  leave: (gameId: string) => void;
  broadcast: any;

  constructor(id: string, leave: (gameId: string) => void, broadcast: any) {
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

  onStartGame(game_id: string) {
    this.socket_game_id = game_id;

    const game = Lobby.deletePendingGame(this.socket_game_id);
    if (!game) return; // Type check to ensure `game` is defined
    runningGames.set(game.id, game);
    console.log(`Game ${game.id} has started...`);

    setTimeout(() => {
      console.log(`Game ${game.id} has finished...`);
      //TODO ADD finish game socket emit to all players in the game room
    }, GAME_DURATION);
    serverSocket.sockets.in(game.id).emit("launch game", game);
  }

  onGetCurrentGame(game_id: string) {
    return runningGames.get(game_id);
  }

  updatePlayerPosition({ x, y, playerId, gameId }: PlayerPositionData) {
    const coordinates = { x, y };

    this.broadcast
      .to(gameId)
      .emit("move player", { player_id: playerId, ...coordinates });
  }

  onDisconnectFromGame() {
    if (this.socket_game_id) {
      const currentGame = runningGames.get(this.socket_game_id);

      if (currentGame) {
        serverSocket.sockets
          .in(this.socket_game_id)
          .emit("player disconnect", { player_id: this.id });
      }
    }
  }

  createBomb({ col, row, playerId, gameId }: BombDetails) {
    const currentGame = runningGames.get(gameId);
    if (!currentGame) return; // Type check to ensure `currentGame` is defined

    const currentPlayer = currentGame.players.find(
      (player) => player.id === playerId
    );
    const bomb = currentGame.addBomb({
      col,
      row,
      power: currentPlayer?.power ?? 1,
    });

    if (bomb) {
      setTimeout(() => {
        const blastedCells = bomb.detonate();

        serverSocket.sockets.to(gameId).emit("detonate bomb", {
          bomb_id: bomb.id,
          blastedCells,
        });
      }, bomb.explosion_time);

      serverSocket.sockets
        .to(gameId)
        .emit("show bomb", { bomb_id: bomb.id, col: bomb.col, row: bomb.row });
    }
  }

  onPickUpSpoil({ spoil_id, playerId, gameId }: SpoilDetails) {
    const currentGame = runningGames.get(gameId);
    if (!currentGame) return; // Type check to ensure `currentGame` is defined

    const currentPlayer = currentGame.players.find(
      (player) => player.id === playerId
    );
    const spoil = currentGame.findSpoil(spoil_id);

    if (spoil) {
      currentGame.deleteSpoil(spoil.id);
      currentPlayer?.pickSpoil(spoil.spoil_type);

      serverSocket.sockets.to(gameId).emit("spoil was picked", {
        player_id: currentPlayer?.id,
        spoil_id: spoil.id,
        spoil_type: spoil.spoil_type,
      });
    }
  }

  onPlayerDied({ x, y, playerId, gameId }: PlayerPositionData) {
    const coordinates = { x, y };

    serverSocket.sockets
      .to(gameId)
      .emit("show bones", { player_id: playerId, ...coordinates });

    const currentGame = runningGames.get(gameId);
    if (!currentGame) return; // Type check to ensure `currentGame` is defined

    const currentPlayer = currentGame.players.find(
      (player) => player.id === playerId
    );
    currentPlayer?.dead();

    let alivePlayersCount = 0;
    let alivePlayerSkin: string | null = null;

    for (const player of Object.values(currentGame.players)) {
      if (player.isAlive) {
        alivePlayersCount += 1;
        alivePlayerSkin = player.skin;
      }
    }

    if (alivePlayersCount < 2 && alivePlayerSkin) {
      setTimeout(() => {
        serverSocket.sockets.to(gameId).emit("player win", alivePlayerSkin);
      }, 3000);
    }
  }
}

export default Play;
