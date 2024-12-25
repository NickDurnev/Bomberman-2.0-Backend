import {
  EXPLOSION_TIME,
  DESTRUCTIBLE_CELL,
  NON_DESTRUCTIBLE_CELL,
  SPOIL_CHANCE,
} from "../constants";
import { Spoil } from "./spoil";
import { v4 as uuidv4 } from "uuid";

type BombConfig = {
  game: any;
  col: number;
  row: number;
  power: number;
};

type BlastedCell = {
  row: number;
  col: number;
  type: string;
  destroyed: boolean;
  spoil: Spoil | null;
};

export class Bomb {
  id: string;
  game: any;
  power: number;
  explosion_time: number;
  col: number;
  row: number;
  blastedCells: BlastedCell[];

  constructor({ game, col, row, power }: BombConfig) {
    this.id = uuidv4();
    this.game = game;
    this.power = power;
    this.explosion_time = EXPLOSION_TIME;
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
        console.log("cell:", cell);
        const isWall = cell === NON_DESTRUCTIBLE_CELL;
        const isBox = cell === DESTRUCTIBLE_CELL;
        const isLast = i === power;

        if (cell === DESTRUCTIBLE_CELL) {
          this.game.nullifyMapCell(currentRow, currentCol);
        }

        if (isBox || isWall || isLast) {
          this.addToBlasted(currentRow, currentCol, direction.end, isBox);
          break;
        }

        this.addToBlasted(currentRow, currentCol, direction.plumb, isBox);
      }
    }

    return this.blastedCells;
  }

  private addToBlasted(
    row: number,
    col: number,
    direction: string,
    destroyed: boolean
  ) {
    const spoil = this.craftSpoil(row, col);

    this.blastedCells.push({
      row,
      col,
      type: `explosion_${direction}`,
      destroyed,
      spoil,
    });
  }

  private craftSpoil(row: number, col: number): Spoil | null {
    const randomNumber = Math.floor(Math.random() * 100);

    if (randomNumber < SPOIL_CHANCE) {
      const spoil = new Spoil(row, col);
      this.game.addSpoil(spoil);
      return spoil;
    }

    return null;
  }
}
