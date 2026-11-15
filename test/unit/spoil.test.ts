import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BOMBS,
  DELAY,
  EMPTY_CELL,
  POWER,
  SMALL_MAP_PORTAL_SPAWNS,
  SPEED,
} from "@constants";
import { Bomb } from "@entity/bomb";
import { Game } from "@entity/game";
import { Spoil } from "@entity/spoil";

function newGame(isPortalsEnabled = false, isDelaySpoilEnabled = false) {
  return new Game({
    mapName: "small_map",
    gameName: "spoil-unit",
    isPortalsEnabled,
    isDelaySpoilEnabled,
  });
}

function openArea(game: Game, row: number, col: number, radius: number) {
  for (let r = row - radius; r <= row + radius; r++) {
    for (let c = col - radius; c <= col + radius; c++) {
      game.shadow_map[r][c] = EMPTY_CELL;
    }
  }
}

describe("spoils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a blasted cell gets a spoil when the roll is below SPOIL_CHANCE", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = newGame();
    openArea(game, 9, 15, 2);
    const blasted = new Bomb({
      game,
      row: 9,
      col: 15,
      power: 1,
      delay: 2000,
    }).detonate();

    expect(blasted).toHaveLength(5);
    for (const cell of blasted) {
      expect(cell.spoil).not.toBeNull();
      expect(game.spoils.get(cell.spoil?.id ?? "")).toBe(cell.spoil);
    }
    expect(game.spoils.size).toBe(5);
  });

  it("no spoil when the roll is at or above SPOIL_CHANCE", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const game = newGame();
    openArea(game, 9, 15, 2);
    const blasted = new Bomb({
      game,
      row: 9,
      col: 15,
      power: 1,
      delay: 2000,
    }).detonate();

    expect(blasted.every(cell => cell.spoil === null)).toBe(true);
    expect(game.spoils.size).toBe(0);
  });

  it("spoil types without DELAY", () => {
    const random = vi.spyOn(Math, "random");
    const types: number[] = [];
    for (const value of [0, 0.34, 0.67, 0.99]) {
      random.mockReturnValue(value);
      types.push(new Spoil(1, 1, false).spoil_type);
    }
    expect(types).toEqual([SPEED, POWER, BOMBS, BOMBS]);
    expect(types).not.toContain(DELAY);
  });

  it("DELAY appears only when the delay spoil is enabled", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(new Spoil(1, 1, true).spoil_type).toBe(DELAY);
    expect(new Spoil(1, 1, false).spoil_type).not.toBe(DELAY);
  });

  it("a portal cell gets a portal and no spoil when portals are enabled", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = newGame(true);
    const { row, col } = SMALL_MAP_PORTAL_SPAWNS[0];
    openArea(game, row, col + 1, 1);
    const blasted = new Bomb({
      game,
      row,
      col: col + 1,
      power: 1,
      delay: 2000,
    }).detonate();

    const portalCell = blasted.find(c => c.row === row && c.col === col);
    expect(portalCell?.portal).not.toBeNull();
    expect(portalCell?.spoil).toBeNull();
    expect(game.portals.size).toBe(1);
  });

  it("no portal when portals are disabled", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = newGame(false);
    const { row, col } = SMALL_MAP_PORTAL_SPAWNS[0];
    openArea(game, row, col + 1, 1);
    const blasted = new Bomb({
      game,
      row,
      col: col + 1,
      power: 1,
      delay: 2000,
    }).detonate();

    const cell = blasted.find(c => c.row === row && c.col === col);
    expect(cell?.portal).toBeNull();
    expect(cell?.spoil).not.toBeNull();
    expect(game.portals.size).toBe(0);
  });
});
