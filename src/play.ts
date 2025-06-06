import { BroadcastOperator, DefaultEventsMap } from "socket.io";
import { v4 as uuidv4 } from "uuid";

import { Game } from "@entity/game";
import {
  BombDetails,
  NewGamePayload,
  PlayerPositionData,
  PortalDetails,
  SpoilDetails,
  UserDetails,
} from "@types";

import { serverSocket } from "./app";
import {
  DELETE_PENDING_GAMES_INTERVAL,
  GAME_DURATION,
  INITIAL_DELAY,
  INITIAL_POWER,
  NO_KILL_PHRASES,
  TILE_SIZE,
} from "./constants";
import Player from "./entity/player";
import Lobby from "./lobby";
import { getRandomItem } from "./utils";

type EndGameArgs = {
  game_id: string;
  gameData: NewGamePayload;
  delay: number;
  winnerId?: string | null;
  isProcessStats?: boolean;
};

const runningGames: Map<string, Game> = new Map();

// Add bomb queue system
type BombQueueItem = {
  bombId: string;
  playerId: string;
  gameId: string;
  detonationTime: number;
};

class Play {
  socket_game_id: string | null = null;
  id: string;
  leave: (gameId: string) => void;
  broadcast: BroadcastOperator<DefaultEventsMap, DefaultEventsMap>;
  private bombQueue: Map<string, BombQueueItem[]> = new Map();
  private bombQueueInterval: NodeJS.Timeout | null = null;

  constructor(
    id: string,
    leave: (gameId: string) => void,
    broadcast: BroadcastOperator<DefaultEventsMap, DefaultEventsMap>,
  ) {
    this.id = id;
    this.leave = leave;
    this.broadcast = broadcast;
    this.startBombQueueProcessor();
  }

  private startBombQueueProcessor() {
    // Process bomb queue every 100ms
    this.bombQueueInterval = setInterval(() => {
      const now = Date.now();
      this.bombQueue.forEach((queue, gameId) => {
        const detonations = queue.filter(item => item.detonationTime <= now);
        detonations.forEach(item => {
          this.detonateBomb({
            bomb_id: item.bombId,
            playerId: item.playerId,
            gameId: item.gameId,
          });
        });
        // Remove detonated bombs from queue
        this.bombQueue.set(
          gameId,
          queue.filter(item => item.detonationTime > now),
        );
      });
    }, 100);
  }

  onLeaveGame() {
    if (this.socket_game_id) {
      // Clear bomb queue for this game
      this.bombQueue.delete(this.socket_game_id);
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
    if (!game) {
      return;
    }
    runningGames.set(game.id, game);

    this.endGame({
      game_id: game.id,
      gameData: {
        mapName: game.mapName,
        gameName: game.name,
        isPortalsEnabled: game.isPortalsEnabled,
        isDelaySpoilEnabled: game.isDelaySpoilEnabled,
      },
      delay: GAME_DURATION,
      isProcessStats: false,
    });
    serverSocket.sockets.in(game.id).emit("launch game", game);
  }

  onGetCurrentGame(game_id: string) {
    return runningGames.get(game_id);
  }

  async endGame({
    game_id,
    gameData,
    winnerId = null,
    isProcessStats = true,
    delay,
  }: EndGameArgs) {
    const currentGame = runningGames.get(game_id);
    if (!currentGame) {
      return;
    }

    if (isProcessStats) {
      await currentGame.processGameStats(winnerId);
    }

    const prevGameInfo = this.addKillPhrases(currentGame);

    setTimeout(() => {
      const newGame = Lobby.createPendingGame(gameData);
      runningGames.delete(game_id);

      serverSocket.sockets.to(game_id).emit("end game", {
        game_id: game_id,
        new_game_id: newGame.id,
        prevGameInfo,
      });
    }, delay * 1000);
  }

  updatePlayerPosition({ x, y, playerId, gameId }: PlayerPositionData) {
    const coordinates = { x, y };

    this.broadcast
      .to(gameId)
      .emit("move player", { player_id: playerId, ...coordinates });
  }

  onDisconnectFromGame(playerId: string) {
    if (this.socket_game_id) {
      const currentGame = runningGames.get(this.socket_game_id);

      currentGame?.removePlayer(playerId);

      if (currentGame?.players.length === 1) {
        this.endGame({
          game_id: this.socket_game_id,
          gameData: {
            mapName: currentGame.mapName,
            gameName: currentGame.name,
            isPortalsEnabled: currentGame.isPortalsEnabled,
            isDelaySpoilEnabled: currentGame.isDelaySpoilEnabled,
          },
          delay: 0,
          isProcessStats: false,
        });
      } else {
        serverSocket.sockets
          .in(this.socket_game_id)
          .emit("player disconnect", { player_id: playerId });
      }
    }
  }

  createBomb({ col, row, playerId, gameId }: UserDetails) {
    const currentGame = runningGames.get(gameId);
    if (!currentGame) {
      return;
    }

    const currentPlayer = currentGame.players.find(
      player => player.id === playerId,
    );
    const bomb = currentGame.addBomb({
      col,
      row,
      power: currentPlayer?.power ?? INITIAL_POWER,
      delay: currentPlayer?.delay ?? INITIAL_DELAY,
    });

    if (bomb) {
      // Add bomb to queue instead of using setTimeout
      const detonationTime = Date.now() + bomb.delay;
      const queue = this.bombQueue.get(gameId) || [];
      queue.push({
        bombId: bomb.id,
        playerId,
        gameId,
        detonationTime,
      });
      this.bombQueue.set(gameId, queue);

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
    if (!currentGame) {
      return;
    }

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

  addKillPhrases(currentGame: Game) {
    const players = currentGame.players.map(player => {
      if (player.kills.length > 0) {
        return player;
      } else {
        return {
          ...player,
          noKillPhrase: getRandomItem(NO_KILL_PHRASES),
        };
      }
    });

    const prevGameInfo = {
      ...currentGame,
      players,
    };

    return prevGameInfo;
  }

  onBlastVsBomb({ bomb_id, playerId, gameId }: BombDetails) {
    this.detonateBomb({ bomb_id, playerId, gameId });
  }

  onPickUpSpoil({ spoil_id, playerId, gameId }: SpoilDetails) {
    const currentGame = runningGames.get(gameId);
    if (!currentGame) {
      return;
    }

    const currentPlayer = currentGame.players.find(
      player => player.id === playerId,
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

  onUsePortal({ portal_id, playerId, gameId }: PortalDetails) {
    const currentGame = runningGames.get(gameId);
    if (!currentGame) {
      return;
    }

    const currentPlayer = currentGame.players.find(
      player => player.id === playerId,
    );
    const portals = Array.from(currentGame.getPortals().values());
    if (portals.length <= 1) {
      return;
    }

    const currentPortal = currentGame.findPortal(portal_id);
    if (!currentPortal) {
      return;
    }

    // Filter out the current portal
    const otherPortals = portals.filter(portal => portal.id !== portal_id);

    // Randomly select another portal
    const randomIndex = Math.floor(Math.random() * otherPortals.length);
    const randomPortal = otherPortals[randomIndex];

    // Get the coordinates of the selected portal
    const { row, col } = randomPortal;

    if (randomPortal) {
      //Update player position
      serverSocket.sockets.to(gameId).emit("teleport player", {
        player_id: currentPlayer?.id,
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: row * TILE_SIZE + TILE_SIZE / 2,
      });
    }
  }

  onPlayerDied({ col, row, playerId, gameId, killerId }: UserDetails) {
    const currentGame = runningGames.get(gameId);
    if (!currentGame) {
      return;
    }

    const tombId = uuidv4();

    currentGame.addTombStone({ tombId, row, col });

    serverSocket.sockets
      .to(gameId)
      .emit("show tombstone", { player_id: playerId, tombId, col, row });

    const currentPlayer = currentGame.players.find(
      player => player.id === playerId,
    );
    currentPlayer?.dead();

    const currentKiller = currentGame.players.find(
      player => player.id === killerId,
    );
    currentKiller?.kill(playerId);

    let alivePlayersCount = 0;
    let alivePlayer: Player | null = null;

    for (const player of Object.values(currentGame.players)) {
      if (player.isAlive) {
        alivePlayersCount += 1;
        alivePlayer = player;
      }
    }

    if (alivePlayersCount === 3) {
      currentGame.players.forEach(player => {
        player.top3();
      });
    }

    const currentGameData = {
      mapName: currentGame.mapName,
      gameName: currentGame.name,
      isPortalsEnabled: currentGame.isPortalsEnabled,
      isDelaySpoilEnabled: currentGame.isDelaySpoilEnabled,
    };

    const prevGameInfo = this.addKillPhrases(currentGame);

    if (alivePlayersCount < 2 && alivePlayer) {
      serverSocket.sockets
        .to(gameId)
        .emit("player win", { winner: alivePlayer, prevGameInfo });
      this.endGame({
        game_id: gameId,
        gameData: currentGameData,
        winnerId: alivePlayer.id,
        delay: 5,
      });
    }

    if (!alivePlayersCount) {
      this.endGame({
        game_id: gameId,
        gameData: currentGameData,
        delay: 2,
      });
    }
  }
}

// Cleanup job: Runs every 1 minute to remove stale running games
setInterval(() => {
  const now = Date.now();
  runningGames.forEach((game, gameId) => {
    if (now - game.createdAt >= GAME_DURATION * 1000) {
      if (game.isEmpty()) {
        Lobby.deletePendingGame(gameId);
      }
    }
    if (now - game.createdAt >= DELETE_PENDING_GAMES_INTERVAL * 1000) {
      Lobby.deletePendingGame(gameId);
    }
  });
}, 60 * 1000);

export default Play;
