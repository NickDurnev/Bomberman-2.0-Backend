import { v4 as uuidv4 } from "uuid";

export class Portal {
  id: string;
  row: number;
  col: number;

  constructor(row: number, col: number) {
    this.id = uuidv4();
    this.row = row;
    this.col = col;
  }
}
