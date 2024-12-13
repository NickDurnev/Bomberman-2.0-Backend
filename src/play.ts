import Lobby from "./lobby";
import { Game } from "./entity/game";
import {
  Coordinates,
  BombDetails,
  SpoilDetails,
  PlayerDeathCoordinates,
} from "./types";
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
    console.log("game_id:", game_id);
    console.log("this.socket_game_id:", this.socket_game_id);
    this.socket_game_id = game_id;

    const game = Lobby.deletePendingGame(this.socket_game_id);
    if (!game) return; // Type check to ensure `game` is defined
    runningGames.set(game.id, game);
    console.log(`Game ${game.id} has started...`);
    serverSocket.sockets.in(game.id).emit("launch game", game);
  }

  onGetCurrentGame(game_id: string) {
    console.log(runningGames);
    return runningGames.get(game_id);
  }

  updatePlayerPosition(coordinates: Coordinates) {
    if (this.socket_game_id) {
      this.broadcast
        .to(this.socket_game_id)
        .emit("move player", { player_id: this.id, ...coordinates });
    }
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

  createBomb({ col, row }: BombDetails) {
    if (!this.socket_game_id) return;

    const gameId = this.socket_game_id;
    const currentGame = runningGames.get(gameId);
    if (!currentGame) return; // Type check to ensure `currentGame` is defined

    const currentPlayer = currentGame.players.find(
      (player) => player.id === this.id
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

  onPickUpSpoil({ spoil_id }: SpoilDetails) {
    if (!this.socket_game_id) return;

    const gameId = this.socket_game_id;
    const currentGame = runningGames.get(gameId);
    if (!currentGame) return; // Type check to ensure `currentGame` is defined

    const currentPlayer = currentGame.players.find(
      (player) => player.id === this.id
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

  onPlayerDied(coordinates: PlayerDeathCoordinates) {
    if (!this.socket_game_id) return;

    serverSocket.sockets
      .to(this.socket_game_id)
      .emit("show bones", { player_id: this.id, ...coordinates });

    const gameId = this.socket_game_id;
    const currentGame = runningGames.get(gameId);
    if (!currentGame) return; // Type check to ensure `currentGame` is defined

    const currentPlayer = currentGame.players.find(
      (player) => player.id === this.id
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
