import { v4 as uuidv4 } from "uuid";
import { Game } from "@entity/game";
import {
  UserDetails,
  SpoilDetails,
  PlayerPositionData,
  BombDetails,
} from "@types";
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
    if (this.socket_game_id) {
      runningGames.delete(this.socket_game_id);

      this.leave(this.socket_game_id);
      this.socket_game_id = null;
    }
  }

  onStartTimer(game_id: string) {
    this.socket_game_id = game_id;
    serverSocket.sockets.in(game_id).emit("start timer");
  }

  onStartGame(game_id: string) {
    this.socket_game_id = game_id;

    const game = Lobby.deletePendingGame(this.socket_game_id);
    if (!game) return; // Type check to ensure `game` is defined
    runningGames.set(game.id, game);
    console.log(`Game ${game.id} has started...`);

    this.endGame({
      game_id: game.id,
      mapName: game.mapName,
      gameName: game.name,
      delay: GAME_DURATION,
    });
    serverSocket.sockets.in(game.id).emit("launch game", game);
  }

  onGetCurrentGame(game_id: string) {
    return runningGames.get(game_id);
  }

  endGame({
    game_id,
    mapName,
    gameName,
    delay,
  }: {
    game_id: string;
    mapName: string;
    gameName: string;
    delay: number;
  }) {
    setTimeout(() => {
      const newGame = Lobby.createPendingGame({ mapName, gameName });
      const prevGameInfo = runningGames.get(game_id);
      runningGames.delete(game_id);

      serverSocket.sockets.to(game_id).emit("end game", {
        game_id: game_id,
        new_game_id: newGame.id,
        prevGameInfo,
      });

      console.log(`Game ${game_id} has finished...`);
    }, delay * 1000);
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
        this.detonateBomb({ bomb_id: bomb.id, playerId, gameId });
      }, bomb.explosion_time);

      serverSocket.sockets.to(gameId).emit("show bomb", {
        bomb_id: bomb.id,
        playerId,
        col: bomb.col,
        row: bomb.row,
      });
    }
  }

  detonateBomb({ bomb_id, playerId, gameId }: BombDetails) {
    const currentGame = runningGames.get(gameId);
    if (!currentGame) return;

    const bomb = currentGame.bombs.get(bomb_id);
    if (bomb) {
      const blastedCells = bomb.detonate();
      currentGame.deleteBomb(bomb_id);

      serverSocket.sockets.to(gameId).emit("detonate bomb", {
        bomb_id: bomb.id,
        playerId,
        blastedCells,
      });
    }
  }

  onBlastVsBomb({ bomb_id, playerId, gameId }: BombDetails) {
    this.detonateBomb({ bomb_id, playerId, gameId });
  }

  onPickUpSpoil({ spoil_id, playerId, gameId }: SpoilDetails) {
    const currentGame = runningGames.get(gameId);
    if (!currentGame) return;

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

  onPlayerDied({ col, row, playerId, gameId, killerId }: UserDetails) {
    const currentGame = runningGames.get(gameId);
    if (!currentGame) return;

    const tombId = uuidv4();

    currentGame.addTombStone({ tombId, row, col });

    serverSocket.sockets
      .to(gameId)
      .emit("show tombstone", { player_id: playerId, tombId, col, row });

    const currentPlayer = currentGame.players.find(
      (player) => player.id === playerId
    );
    currentPlayer?.dead();

    const currentKiller = currentGame.players.find(
      (player) => player.id === killerId
    );
    currentKiller?.kill();

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
      }, 1000);
      this.endGame({
        game_id: gameId,
        mapName: currentGame.mapName,
        gameName: currentGame.name,
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

export default Play;
