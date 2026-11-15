import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DESTRUCTIBLE_CELL,
  EMPTY_CELL,
  NON_DESTRUCTIBLE_CELL,
} from "@constants";
import { Bomb } from "@entity/bomb";
import { Game } from "@entity/game";

const ROW = 9;
const COL = 15;

function newGame(): Game {
  return new Game({
    mapName: "small_map",
    gameName: "bomb-unit",
    isPortalsEnabled: false,
    isDelaySpoilEnabled: false,
  });
}

function openArea(game: Game, row: number, col: number, radius: number) {
  for (let r = row - radius; r <= row + radius; r++) {
    for (let c = col - radius; c <= col + radius; c++) {
      game.shadow_map[r][c] = EMPTY_CELL;
    }
  }
}

function cellsOf(
  blasted: { row: number; col: number; type: string }[],
  predicate: (cell: { row: number; col: number }) => boolean,
) {
  return blasted.filter(predicate);
}

describe("Bomb.detonate", () => {
  beforeEach(() => {
    // No spoil drops: the roll is always at or above SPOIL_CHANCE.
    vi.spyOn(Math, "random").mockReturnValue(0.99);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("power 1 blasts the centre and one cell each way", () => {
    const game = newGame();
    openArea(game, ROW, COL, 3);
    const blasted = new Bomb({
      game,
      row: ROW,
      col: COL,
      power: 1,
      delay: 2000,
    }).detonate();

    expect(blasted).toHaveLength(5);
    const byPos = (r: number, c: number) =>
      blasted.find(cell => cell.row === r && cell.col === c);
    expect(byPos(ROW, COL)?.type).toBe("explosion_center");
    expect(byPos(ROW - 1, COL)?.type).toBe("explosion_vertical");
    expect(byPos(ROW + 1, COL)?.type).toBe("explosion_vertical");
    expect(byPos(ROW, COL - 1)?.type).toBe("explosion_horizontal");
    expect(byPos(ROW, COL + 1)?.type).toBe("explosion_horizontal");
  });

  it("power 3 in open space reaches 3 cells each way", () => {
    const game = newGame();
    openArea(game, ROW, COL, 4);
    const blasted = new Bomb({
      game,
      row: ROW,
      col: COL,
      power: 3,
      delay: 2000,
    }).detonate();

    expect(blasted).toHaveLength(13);
    expect(blasted.every(cell => cell.destroyed === false)).toBe(true);
    const vertical = cellsOf(blasted, cell => cell.col === COL);
    const horizontal = cellsOf(blasted, cell => cell.row === ROW);
    for (const cell of vertical.filter(c => c.row !== ROW)) {
      expect(cell.type).toBe("explosion_vertical");
      expect(Math.abs(cell.row - ROW)).toBeLessThanOrEqual(3);
    }
    for (const cell of horizontal.filter(c => c.col !== COL)) {
      expect(cell.type).toBe("explosion_horizontal");
      expect(Math.abs(cell.col - COL)).toBeLessThanOrEqual(3);
    }
    expect(blasted.some(c => c.row === ROW - 3 && c.col === COL)).toBe(true);
    expect(blasted.some(c => c.row === ROW + 3 && c.col === COL)).toBe(true);
    expect(blasted.some(c => c.row === ROW && c.col === COL - 3)).toBe(true);
    expect(blasted.some(c => c.row === ROW && c.col === COL + 3)).toBe(true);
  });

  it("a box stops the blast and is destroyed", () => {
    const game = newGame();
    openArea(game, ROW, COL, 4);
    game.shadow_map[ROW][COL + 2] = DESTRUCTIBLE_CELL;
    const blasted = new Bomb({
      game,
      row: ROW,
      col: COL,
      power: 4,
      delay: 2000,
    }).detonate();

    const box = blasted.find(c => c.row === ROW && c.col === COL + 2);
    expect(box?.destroyed).toBe(true);
    expect(box?.type).toBe("explosion_right");
    expect(blasted.some(c => c.row === ROW && c.col > COL + 2)).toBe(false);
    expect(game.getMapCell(ROW, COL + 2)).toBe(EMPTY_CELL);
  });

  it("a wall stops the blast and stays", () => {
    const game = newGame();
    openArea(game, ROW, COL, 4);
    game.shadow_map[ROW - 2][COL] = NON_DESTRUCTIBLE_CELL;
    const blasted = new Bomb({
      game,
      row: ROW,
      col: COL,
      power: 4,
      delay: 2000,
    }).detonate();

    const wall = blasted.find(c => c.row === ROW - 2 && c.col === COL);
    expect(wall?.destroyed).toBe(false);
    expect(wall?.type).toBe("explosion_up");
    expect(blasted.some(c => c.col === COL && c.row < ROW - 2)).toBe(false);
    expect(game.getMapCell(ROW - 2, COL)).toBe(NON_DESTRUCTIBLE_CELL);
  });

  it("the bomb cell becomes empty", () => {
    const game = newGame();
    openArea(game, ROW, COL, 2);
    game.shadow_map[ROW][COL] = DESTRUCTIBLE_CELL;
    new Bomb({ game, row: ROW, col: COL, power: 1, delay: 2000 }).detonate();
    expect(game.getMapCell(ROW, COL)).toBe(EMPTY_CELL);
  });
});
