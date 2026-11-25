import { describe, expect, it } from "vitest";
import {
  ARENA_MAP_PORTAL_SPAWNS,
  DESTRUCTIBLE_CELL,
  EMPTY_CELL,
} from "@/constants";
import { Game } from "@/entity/game";

function game(mapName: string): Game {
  return new Game({
    mapName,
    gameName: "map-unit",
    isPortalsEnabled: false,
    isDelaySpoilEnabled: false,
  });
}

describe("arena_map", () => {
  it("has 12 players on a 28 x 18 grid", () => {
    const g = game("arena_map");
    expect(g.max_players).toBe(12);
    expect(g.shadow_map).toHaveLength(18);
    expect(g.shadow_map[0]).toHaveLength(28);
  });

  it("has 12 spawns, each on an empty cell", () => {
    const g = game("arena_map");
    expect(g.playerSpawns).toHaveLength(12);
    for (const { row, col } of g.playerSpawns) {
      // Spawn offset: the player stands in (row - 1, col - 1).
      expect(g.shadow_map[row - 1][col - 1]).toBe(EMPTY_CELL);
    }
  });

  it("has its portal cells under boxes", () => {
    const g = game("arena_map");
    for (const { row, col } of ARENA_MAP_PORTAL_SPAWNS) {
      expect(g.shadow_map[row][col]).toBe(DESTRUCTIBLE_CELL);
    }
  });
});

// A map id is part of the wire contract: a client that is one deploy behind
// still sends "default_map" and draws its own 32 x 21 copy. A new layout gets
// a new id instead (docs/known-traps.md).
describe("default_map", () => {
  it("keeps its 32 x 21 grid for 14 players", () => {
    const g = game("default_map");
    expect(g.max_players).toBe(14);
    expect(g.shadow_map).toHaveLength(21);
    expect(g.shadow_map[0]).toHaveLength(32);
  });
});
