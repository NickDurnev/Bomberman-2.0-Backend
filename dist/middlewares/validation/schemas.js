"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const joi_1 = __importDefault(require("joi"));
const userSchema = joi_1.default.object({
    name: joi_1.default.string().trim(true).required(),
    email: joi_1.default.string().trim(true).required(),
    socketID: joi_1.default.string(),
    locale: joi_1.default.string(),
    picture: joi_1.default.string(),
    leftReview: joi_1.default.bool(),
});
exports.default = {
    "/auth": userSchema,
};
