"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: [true, "Set name for user"] },
    email: {
        type: String,
        required: [true, "Set email for user"],
        unique: true,
    },
    socketID: String,
    locale: String,
    picture: String,
}, { versionKey: false });
const User = mongoose_1.models.users || (0, mongoose_1.model)("users", UserSchema);
exports.default = User;
