import { v4 as uuidv4 } from "uuid";

import {
  DEFAULT_MAP_PORTAL_SPAWNS,
  DESTRUCTIBLE_CELL,
  NON_DESTRUCTIBLE_CELL,
  SMALL_MAP_PORTAL_SPAWNS,
  SPOIL_CHANCE,
} from "@constants";
import { Game } from "@entity/game";
import { Portal } from "@entity/portal";
import { Spoil } from "@entity/spoil";

type BombConfig = {
  game: Game;
  col: number;
  row: number;
  power: number;
  delay: number;
};

type BlastedCell = {
  row: number;
  col: number;
  type: string;
  destroyed: boolean;
  spoil: Spoil | null;
  portal: Portal | null;
};

export class Bomb {
  id: string;
  game: Game;
  power: number;
  delay: number;
  col: number;
  row: number;
  blastedCells: BlastedCell[];

  constructor({ game, col, row, power, delay }: BombConfig) {
    this.id = uuidv4();
    this.game = game;
    this.power = power;
    this.delay = delay;
    this.col = col;
    this.row = row;
    this.blastedCells = [];
  }

  detonate(): BlastedCell[] {
    const { row, col, power } = this;

    this.game.nullifyMapCell(row, col);
    this.addToBlasted(row, col, "center", false);

    const explosionDirections = [
      { x: 0, y: -1, end: "up", plumb: "vertical" },
      { x: 1, y: 0, end: "right", plumb: "horizontal" },
      { x: 0, y: 1, end: "down", plumb: "vertical" },
      { x: -1, y: 0, end: "left", plumb: "horizontal" },
    ];

    for (const direction of explosionDirections) {
      for (let i = 1; i <= power; i++) {
        const currentRow = row + direction.y * i;
        const currentCol = col + direction.x * i;

        const cell = this.game.getMapCell(currentRow, currentCol);
        const isWall = cell === NON_DESTRUCTIBLE_CELL;
        const isBox = cell === DESTRUCTIBLE_CELL;

        if (isBox) {
          this.game.nullifyMapCell(currentRow, currentCol);
          this.addToBlasted(currentRow, currentCol, direction.end, true);
          break; // Stop further explosions in this direction
        }

        if (isWall) {
          this.addToBlasted(currentRow, currentCol, direction.end, false);
          break; // Stop further explosions in this direction
        }

        // Only add to blasted if it's not a box or wall
        this.addToBlasted(currentRow, currentCol, direction.plumb, false);
      }
    }

    return this.blastedCells;
  }

  private addToBlasted(
    row: number,
    col: number,
    direction: string,
    destroyed: boolean,
  ) {
    let isPortal = false;
    let portalSpawns = DEFAULT_MAP_PORTAL_SPAWNS;
    if (this.game.mapName === "small_map") {
      portalSpawns = SMALL_MAP_PORTAL_SPAWNS;
    }
    if (this.game.isPortalsEnabled) {
      isPortal = portalSpawns.some(
        portal => portal.row === row && portal.col === col,
      );
    }

    let spoil: Spoil | null = null;
    let portal: Portal | null = null;

    if (isPortal) {
      portal = new Portal(row, col);
      this.game.addPortal(portal);
    } else {
      spoil = this.craftSpoil(row, col);
    }

    this.blastedCells.push({
      row,
      col,
      type: `explosion_${direction}`,
      destroyed,
      spoil,
      portal,
    });
  }

  private craftSpoil(row: number, col: number): Spoil | null {
    const randomNumber = Math.floor(Math.random() * 100);

    const isDelaySpoilEnabled = this.game.isDelaySpoilEnabled;

    if (randomNumber < SPOIL_CHANCE) {
      const spoil = new Spoil(row, col, isDelaySpoilEnabled);
      this.game.addSpoil(spoil);
      return spoil;
    }

    return null;
  }
}
