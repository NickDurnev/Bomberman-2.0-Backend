import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BIG_MAP_PORTAL_SPAWNS,
  DEFAULT_MAP_PORTAL_SPAWNS,
  DESTRUCTIBLE_CELL,
  EMPTY_CELL,
  portalSpawnsFor,
  SMALL_MAP_PORTAL_SPAWNS,
} from "@/constants";
import { Bomb } from "@/entity/bomb";
import { Game } from "@/entity/game";

function bigGame(isPortalsEnabled = false): Game {
  return new Game({
    mapName: "big_map",
    gameName: "big-unit",
    isPortalsEnabled,
    isDelaySpoilEnabled: false,
  });
}

describe("portal cells per map", () => {
  it("returns the list of each map", () => {
    expect(portalSpawnsFor("big_map")).toBe(BIG_MAP_PORTAL_SPAWNS);
    expect(portalSpawnsFor("small_map")).toBe(SMALL_MAP_PORTAL_SPAWNS);
    expect(portalSpawnsFor("default_map")).toBe(DEFAULT_MAP_PORTAL_SPAWNS);
  });

  it("falls back to default for an unknown map", () => {
    expect(portalSpawnsFor("no_such_map")).toBe(DEFAULT_MAP_PORTAL_SPAWNS);
  });
});

describe("big_map", () => {
  it("has 18 players on a 40 x 24 grid", () => {
    const game = bigGame();
    expect(game.max_players).toBe(18);
    expect(game.shadow_map).toHaveLength(24);
    expect(game.shadow_map[0]).toHaveLength(40);
  });

  it("has at least 20 spawns, each on an empty cell", () => {
    const game = bigGame();
    expect(game.playerSpawns.length).toBeGreaterThanOrEqual(20);
    for (const { row, col } of game.playerSpawns) {
      // Spawn offset: the player stands in (row - 1, col - 1).
      expect(game.shadow_map[row - 1][col - 1]).toBe(EMPTY_CELL);
    }
  });

  it("has its portal cells under boxes", () => {
    const game = bigGame();
    for (const { row, col } of BIG_MAP_PORTAL_SPAWNS) {
      expect(game.shadow_map[row][col]).toBe(DESTRUCTIBLE_CELL);
    }
  });

  it("is full at 18 players, each on its own spawn", async () => {
    const game = bigGame();
    for (let i = 0; i < 18; i++) {
      await game.addPlayer(`p${i}`, { name: `P${i}`, picture: "skin" });
    }
    expect(game.isFull()).toBe(true);
    const spawns = new Set(
      game.players.map(p => `${p.spawnOnGrid.row},${p.spawnOnGrid.col}`),
    );
    expect(spawns.size).toBe(18);
  });
});

describe("big_map portals", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a blast on a big_map portal cell creates a portal", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const game = bigGame(true);
    const portal = BIG_MAP_PORTAL_SPAWNS[0];
    // The cell next to the portal box, inside the map.
    const col = portal.col + 1;
    game.shadow_map[portal.row][col] = EMPTY_CELL;
    const cell = new Bomb({ game, row: portal.row, col, power: 1, delay: 2000 })
      .detonate()
      .find(c => c.row === portal.row && c.col === portal.col);
    expect(cell?.destroyed).toBe(true);
    expect(cell?.portal).not.toBeNull();
  });
});
