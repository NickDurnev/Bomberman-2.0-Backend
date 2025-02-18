"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validationMiddleware_1 = __importDefault(require("@middlewares/validationMiddleware"));
const auth_1 = require("../controllers/auth");
const stats_1 = require("../controllers/stats");
const router = (0, express_1.Router)();
router.get("/", (req, res) => {
    res.send("Hello!");
});
router.post("/auth", (0, validationMiddleware_1.default)("/auth"), auth_1.login);
router.get("/stats", stats_1.getStats);
exports.default = router;
