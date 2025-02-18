"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Spoil = void 0;
const constants_1 = require("../constants");
const uuid_1 = require("uuid");
class Spoil {
    constructor(row, col) {
        this.id = (0, uuid_1.v4)();
        this.row = row;
        this.col = col;
        this.spoil_type = this.spoilType();
    }
    spoilType() {
        const spoilTypes = [constants_1.SPEED, constants_1.POWER, constants_1.BOMBS];
        return spoilTypes[Math.floor(Math.random() * spoilTypes.length)];
    }
}
exports.Spoil = Spoil;
