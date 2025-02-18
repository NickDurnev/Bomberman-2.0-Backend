"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const db_1 = require("../db");
const User_1 = __importDefault(require("@db/models/User"));
function login(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { email, picture } = req.body;
        yield (0, db_1.connection)();
        try {
            const user = yield User_1.default.findOne({ email });
            if (user) {
                yield User_1.default.findOneAndUpdate({ email }, { picture });
                res.json({
                    status: "success",
                    code: 200,
                    data: {
                        user,
                    },
                });
                return;
            }
            const newUser = yield User_1.default.create(req.body);
            res.status(201).json({
                status: "success",
                code: 201,
                data: {
                    newUser,
                },
            });
        }
        catch (error) {
            res.status(error.status).json({ success: false, message: error.message });
        }
    });
}
