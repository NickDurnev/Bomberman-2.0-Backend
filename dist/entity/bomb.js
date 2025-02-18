"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bomb = void 0;
const constants_1 = require("../constants");
const spoil_1 = require("./spoil");
const uuid_1 = require("uuid");
class Bomb {
    constructor({ game, col, row, power }) {
        this.id = (0, uuid_1.v4)();
        this.game = game;
        this.power = power;
        this.explosion_time = constants_1.EXPLOSION_TIME;
        this.col = col;
        this.row = row;
        this.blastedCells = [];
    }
    detonate() {
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
                const isWall = cell === constants_1.NON_DESTRUCTIBLE_CELL;
                const isBox = cell === constants_1.DESTRUCTIBLE_CELL;
                const isLast = i === power;
                if (cell === constants_1.DESTRUCTIBLE_CELL) {
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
    addToBlasted(row, col, direction, destroyed) {
        const spoil = this.craftSpoil(row, col);
        this.blastedCells.push({
            row,
            col,
            type: `explosion_${direction}`,
            destroyed,
            spoil,
        });
    }
    craftSpoil(row, col) {
        const randomNumber = Math.floor(Math.random() * 100);
        if (randomNumber < constants_1.SPOIL_CHANCE) {
            const spoil = new spoil_1.Spoil(row, col);
            this.game.addSpoil(spoil);
            return spoil;
        }
        return null;
    }
}
exports.Bomb = Bomb;
