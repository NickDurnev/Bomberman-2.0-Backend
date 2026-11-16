import { BroadcastOperator, DefaultEventsMap } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import {
  DELETE_PENDING_GAMES_INTERVAL,
  GAME_DURATION,
  INITIAL_DELAY,
  INITIAL_POWER,
  NO_KILL_PHRASES,
  TILE_SIZE,
} from "@/constants";
import { Game } from "@/entity/game";
import Player from "@/entity/player";
import { getIo } from "@/io";
import Lobby from "@/lobby";
import {
  BombDetails,
  EndReason,
  NewGamePayload,
  PlayerPositionData,
  PortalDetails,
  SpoilDetails,
  UserDetails,
} from "@/types";
import { getRandomItem } from "@/utils";

type EndGameArgs = {
  game_id: string;
  gameData: NewGamePayload;
  delay: number;
  reason: EndReason;
  winnerId?: string | null;
  isProcessStats?: boolean;
};

const runningGames: Map<string, Game> = new Map();

// The prevGameInfo sent with "player win", per game. Every "end game" of that
// game reuses it, so the stats show the same no-kill phrases as the win modal.
const winGameInfos: Map<string, ReturnType<Play["addKillPhrases"]>> = new Map();

// Games with an end already scheduled. A game ends once: a later end (the
// winner dies or a player leaves during the win delay, the time limit) is
// skipped.
const endingGames: Set<string> = new Set();

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

  // Release the per-connection bomb-queue interval. Must be called when the
  // socket disconnects, otherwise every connection leaks a 100ms timer forever.
  destroy() {
    if (this.bombQueueInterval) {
      clearInterval(this.bombQueueInterval);
      this.bombQueueInterval = null;
    }
    this.bombQueue.clear();
  }

  // A leave during a running match removes only that player, exactly like a
  // disconnect. Otherwise (the match already ended, or the game is pending)
  // only this socket's game state is cleared.
  onLeaveGame(playerId: string) {
    const gameId = this.socket_game_id;
    if (!gameId) {
      return;
    }
    const currentGame = runningGames.get(gameId);
    const isRunning =
      currentGame !== undefined &&
      !endingGames.has(gameId) &&
      currentGame.players.some(player => player.id === playerId);

    if (isRunning) {
      this.bombQueue.delete(gameId);
      this.leave(gameId);
      this.onDisconnectFromGame(playerId);
      this.socket_game_id = null;
      return;
    }

    // Clear bomb queue for this game
    this.bombQueue.delete(gameId);
    this.leave(gameId);
    this.socket_game_id = null;
  }

  onStartTimer(game_id: string) {
    this.socket_game_id = game_id;
    getIo().sockets.in(game_id).emit("start timer");
  }

  onStartGame(game_id: string) {
    this.socket_game_id = game_id;

    const game = Lobby.deletePendingGame(this.socket_game_id);
    if (!game) {
      return;
    }
    runningGames.set(game.id, game);

    // Time limit. endGame skips the game if it already ended.
    setTimeout(() => {
      this.endGame({
        game_id: game.id,
        gameData: {
          mapName: game.mapName,
          gameName: game.name,
          isPortalsEnabled: game.isPortalsEnabled,
          isDelaySpoilEnabled: game.isDelaySpoilEnabled,
        },
        delay: 0,
        reason: "timeout",
        isProcessStats: false,
      });
    }, GAME_DURATION * 1000);
    getIo().sockets.in(game.id).emit("launch game", game);
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
    reason,
  }: EndGameArgs) {
    const currentGame = runningGames.get(game_id);
    if (!currentGame || endingGames.has(game_id)) {
      return;
    }
    endingGames.add(game_id);

    if (isProcessStats) {
      // A stats failure must not block the end: the game is already in
      // endingGames, so no other end can run for it.
      try {
        await currentGame.processGameStats(winnerId);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(error.message);
        }
      }
    }

    const prevGameInfo =
      winGameInfos.get(game_id) ?? this.addKillPhrases(currentGame);

    setTimeout(() => {
      const newGame = Lobby.createPendingGame(gameData);
      runningGames.delete(game_id);
      winGameInfos.delete(game_id);
      endingGames.delete(game_id);

      getIo().sockets.to(game_id).emit("end game", {
        game_id: game_id,
        new_game_id: newGame.id,
        prevGameInfo,
        reason,
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

      // Dead players stay in the game, so count only the living ones. One
      // living player wins by forfeit; none left is a draw.
      const livingCount =
        currentGame?.players.filter(player => player.isAlive).length ?? 0;

      // A match that is already ending keeps its own reason.
      if (
        currentGame &&
        livingCount <= 1 &&
        !endingGames.has(this.socket_game_id)
      ) {
        this.endGame({
          game_id: this.socket_game_id,
          gameData: {
            mapName: currentGame.mapName,
            gameName: currentGame.name,
            isPortalsEnabled: currentGame.isPortalsEnabled,
            isDelaySpoilEnabled: currentGame.isDelaySpoilEnabled,
          },
          delay: 0,
          reason: livingCount === 1 ? "disconnect" : "draw",
          isProcessStats: false,
        });
      } else {
        getIo()
          .sockets.in(this.socket_game_id)
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

      getIo().sockets.to(gameId).emit("show bomb", {
        bomb_id: bomb.id,
        playerId,
        col: bomb.col,
        row: bomb.row,
        delay: bomb.delay,
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

      getIo().sockets.to(gameId).emit("detonate bomb", {
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

      getIo().sockets.to(gameId).emit("spoil was picked", {
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
      getIo()
        .sockets.to(gameId)
        .emit("teleport player", {
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

    getIo()
      .sockets.to(gameId)
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
      currentGame.markTop3();
    }

    const currentGameData = {
      mapName: currentGame.mapName,
      gameName: currentGame.name,
      isPortalsEnabled: currentGame.isPortalsEnabled,
      isDelaySpoilEnabled: currentGame.isDelaySpoilEnabled,
    };

    const prevGameInfo = this.addKillPhrases(currentGame);

    if (alivePlayersCount < 2 && alivePlayer) {
      winGameInfos.set(gameId, prevGameInfo);
      getIo()
        .sockets.to(gameId)
        .emit("player win", { winner: alivePlayer, prevGameInfo });
      this.endGame({
        game_id: gameId,
        gameData: currentGameData,
        winnerId: alivePlayer.id,
        delay: 5,
        reason: "win",
      });
    }

    if (!alivePlayersCount) {
      this.endGame({
        game_id: gameId,
        gameData: currentGameData,
        delay: 2,
        reason: "draw",
      });
    }
  }
}

// Removes running games that are empty after the match length, or older than
// DELETE_PENDING_GAMES_INTERVAL.
export function cleanupRunningGames(games: Map<string, Game>, now: number) {
  for (const [gameId, game] of games) {
    const age = now - game.createdAt;
    if (
      (age >= GAME_DURATION * 1000 && game.isEmpty()) ||
      age >= DELETE_PENDING_GAMES_INTERVAL * 1000
    ) {
      games.delete(gameId);
    }
  }
}

// Cleanup job: Runs every 1 minute to remove stale running games
setInterval(() => {
  cleanupRunningGames(runningGames, Date.now());
}, 60 * 1000).unref();

export default Play;
