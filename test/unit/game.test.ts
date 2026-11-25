import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DELETE_PENDING_GAMES_INTERVAL,
  GAME_DURATION,
  MAP_NAMES,
} from "@/constants";
import { Game } from "@/entity/game";
import Player from "@/entity/player";
import { cleanupRunningGames } from "@/play";

function newGame(): Game {
  return new Game({
    mapName: "small_map",
    gameName: "game-unit",
    isPortalsEnabled: false,
    isDelaySpoilEnabled: false,
  });
}

function addPlayers(game: Game, count: number) {
  for (let i = 0; i < count; i++) {
    game.players.push(
      new Player({
        id: `p${i}`,
        skin: "",
        name: `P${i}`,
        spawn: { x: 0, y: 0 },
        spawnOnGrid: { row: 1, col: 1 },
      } as ConstructorParameters<typeof Player>[0]),
    );
  }
}

describe("Game.markTop3", () => {
  it("marks only the players still alive", () => {
    const game = newGame();
    addPlayers(game, 4);
    game.players[0].dead();
    game.markTop3();

    expect(game.players.map(player => player.isTop3)).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });
});

describe("Game.texturePack", () => {
  function gameWithPack(texturePack: unknown): Game {
    return new Game({
      mapName: "small_map",
      gameName: "game-unit",
      isPortalsEnabled: false,
      isDelaySpoilEnabled: false,
      texturePack: texturePack as string | undefined,
    });
  }

  it("keeps a known pack", () => {
    expect(gameWithPack("classic").texturePack).toBe("classic");
  });

  it("uses the default pack when the payload has no pack", () => {
    expect(newGame().texturePack).toBe("default");
  });

  it("uses the default pack for an unknown pack id", () => {
    expect(gameWithPack("nope").texturePack).toBe("default");
  });

  it("uses the default pack for a pack that is not a string", () => {
    expect(gameWithPack(42).texturePack).toBe("default");
  });
});

describe("Game.mapName", () => {
  const gameOn = (mapName: string) =>
    new Game({
      mapName,
      gameName: "map-name-unit",
      isPortalsEnabled: false,
      isDelaySpoilEnabled: false,
    });

  it("keeps a map the server has", () => {
    expect(gameOn("arena_map").mapName).toBe("arena_map");
  });

  // A client one deploy ahead can name a map this server does not have yet.
  it("uses default_map for a map the server does not have", () => {
    const game = gameOn("no_such_map");
    expect(game.mapName).toBe("default_map");
    expect(game.max_players).toBe(14);
  });

  it("lists exactly the maps in src/maps", () => {
    const files = readdirSync(join(__dirname, "../../src/maps"))
      .filter(file => file.endsWith(".json"))
      .map(file => file.replace(/\.json$/, ""));
    expect([...MAP_NAMES].sort()).toEqual(files.sort());
  });
});

describe("cleanupRunningGames", () => {
  it("removes an empty game older than the match length", () => {
    const game = newGame();
    game.start();
    const games = new Map([[game.id, game]]);
    cleanupRunningGames(games, game.startedAt + GAME_DURATION * 1000);

    expect(games.has(game.id)).toBe(false);
  });

  it("keeps a game with players until the stale interval", () => {
    const game = newGame();
    addPlayers(game, 2);
    game.start();
    const games = new Map([[game.id, game]]);
    cleanupRunningGames(games, game.startedAt + GAME_DURATION * 1000);
    expect(games.has(game.id)).toBe(true);

    cleanupRunningGames(
      games,
      game.startedAt + DELETE_PENDING_GAMES_INTERVAL * 1000,
    );
    expect(games.has(game.id)).toBe(false);
  });

  it("measures the age from the start, not from the pending game", () => {
    const game = newGame();
    addPlayers(game, 2);
    // The room waited in the lobby for longer than the stale interval.
    game.createdAt -= DELETE_PENDING_GAMES_INTERVAL * 1000;
    game.start();
    const games = new Map([[game.id, game]]);
    cleanupRunningGames(games, game.startedAt + 60 * 1000);

    expect(games.has(game.id)).toBe(true);
  });
});
