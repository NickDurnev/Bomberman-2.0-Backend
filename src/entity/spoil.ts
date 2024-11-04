import { SPEED, POWER, DELAY } from "../constants";
import { v4 as uuidv4 } from "uuid";

export class Spoil {
  id: string;
  row: number;
  col: number;
  spoil_type: number;

  constructor(row: number, col: number) {
    this.id = uuidv4();
    this.row = row;
    this.col = col;
    this.spoil_type = this.spoilType();
  }

  private spoilType(): number {
    const spoilTypes = [SPEED, POWER, DELAY];
    return spoilTypes[Math.floor(Math.random() * spoilTypes.length)];
  }
}
