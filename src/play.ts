import { v4 as uuidv4 } from "uuid";
import { Game } from "@entity/game";
import { UserDetails, SpoilDetails, PlayerPositionData } from "@types";
import { GAME_DURATION } from "@constants";
import Lobby from "./lobby";
import Player from "./entity/player";
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
    console.log("LEAVE_GAME: this.socket_game_id:", this.socket_game_id);
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
      runningGames.delete(game.id);

      serverSocket.sockets.to(game.id).emit("end game", {
        game_id: game.id,
      });

      console.log(`Game ${game.id} has finished...`);
    }, GAME_DURATION * 1000);
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

  createBomb({ col, row, playerId, gameId }: UserDetails) {
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

  onPlayerDied({ col, row, playerId, gameId }: UserDetails) {
    const currentGame = runningGames.get(gameId);
    if (!currentGame) return; // Type check to ensure `currentGame` is defined

    const tombId = uuidv4();

    currentGame.addTombStone({ tombId, row, col });

    serverSocket.sockets
      .to(gameId)
      .emit("show tombstone", { player_id: playerId, tombId, col, row });

    const currentPlayer = currentGame.players.find(
      (player) => player.id === playerId
    );
    currentPlayer?.dead();

    let alivePlayersCount = 0;
    let alivePlayer: Player | null = null;

    for (const player of Object.values(currentGame.players)) {
      if (player.isAlive) {
        alivePlayersCount += 1;
        alivePlayer = player;
      }
    }

    if (alivePlayersCount < 2 && alivePlayer) {
      setTimeout(() => {
        serverSocket.sockets.to(gameId).emit("player win", alivePlayer);
      }, 3000);
    }
  }
}

export default Play;
