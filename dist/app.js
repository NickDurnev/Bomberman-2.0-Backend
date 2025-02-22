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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverSocket = void 0;
require("module-alias/register");
const express_1 = __importDefault(require("express"));
const node_cron_1 = __importDefault(require("node-cron"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const socket_1 = require("@services/socket");
const stats_1 = require("@services/stats");
const index_1 = __importDefault(require("./routes/index"));
const db_1 = require("./db");
const lobby_1 = __importDefault(require("./lobby"));
const play_1 = __importDefault(require("./play"));
const corsOptions = {
    origin: "http://localhost:3000", // Replace with your frontend URL
    optionsSuccessStatus: 200,
};
const app = (0, express_1.default)();
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
const PORT = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : 4000;
exports.serverSocket = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
    },
});
// Use static files from the client directory
app.use(express_1.default.static(path_1.default.join(__dirname, "..", "client")));
app.get("/", (req, res) => {
    res.sendStatus(200);
});
app.use("/api/v1", index_1.default);
// Schedule the cron job to run at 3 AM on the first day of every month
node_cron_1.default.schedule("0 3 1 * *", () => {
    console.log("Running deleteAllStats cron job...");
    (0, stats_1.deleteAllStats)();
});
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, db_1.connection)();
        server.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
        exports.serverSocket.sockets.on("connection", (client) => {
            console.log(`New player has connected: ${client.id}`);
            //update user socket id
            client.on("updateUserSocketId", (req, callback) => __awaiter(void 0, void 0, void 0, function* () {
                console.log("updateUserSocketId:");
                console.log("req:", req);
                yield (0, socket_1.storeSocketID)(req.email, req.socket_id);
                client.customId = req.socket_id;
                callback({
                    status: 200,
                    message: "Socket id updated successfully",
                });
                console.log("doneeee");
            }));
            // Create a new Play instance and store it on the client object
            const playerPlayInstance = new play_1.default(client.id, (gameId) => {
                client.leave(gameId);
            }, exports.serverSocket.to(client.id));
            // Store the Play instance on the client object
            client.playInstance = playerPlayInstance;
            // Lobby event handlers
            client.on("enter lobby", lobby_1.default.onEnterLobby);
            client.on("leave lobby", lobby_1.default.onLeaveLobby);
            client.on("create game", lobby_1.default.onCreateGame);
            client.on("enter pending game", lobby_1.default.onEnterPendingGame);
            client.on("leave pending game", lobby_1.default.onLeavePendingGame);
            client.on("check game name", lobby_1.default.onCheckNameAvailable);
            // Play event handlers using the `Play` instance
            client.on("get current game", (game_id, callback) => {
                const game = playerPlayInstance.onGetCurrentGame(game_id);
                console.log("Game fetched:", game);
                callback(game); // Send the game data back to the client
            });
            client.on("start timer", (game_id) => playerPlayInstance.onStartTimer(game_id));
            client.on("start game", (game_id) => playerPlayInstance.onStartGame(game_id));
            client.on("update player position", (data) => playerPlayInstance.updatePlayerPosition(data));
            client.on("create bomb", (bombDetails) => playerPlayInstance.createBomb(bombDetails));
            client.on("detonate bomb by blast", (bombDetails) => playerPlayInstance.onBlastVsBomb(bombDetails));
            client.on("pick up spoil", (spoilDetails) => playerPlayInstance.onPickUpSpoil(spoilDetails));
            client.on("player died", (data) => playerPlayInstance.onPlayerDied(data));
            client.on("leave game", () => playerPlayInstance.onLeaveGame());
            client.on("joinRoom", (data) => {
                const { room_id } = data;
                client.join(room_id);
            });
            client.on("leaveRoom", (data) => {
                const { room_id } = data;
                client.leave(room_id);
            });
            // Handle disconnection
            client.on("disconnect", () => onClientDisconnect(client));
        });
        function onClientDisconnect(client) {
            if (client.socket_game_id == null) {
                console.log("Player was not inside any game...");
                return;
            }
            console.log("Player was inside game...");
            // If the game is pending, use Lobby methods
            lobby_1.default.onLeavePendingGame.call(client);
            // If the game is active, use the `Play` instance method
            if (client.playInstance) {
                client.playInstance.onDisconnectFromGame();
            }
        }
    }
    catch (error) {
        console.log(`Server not running. Error message: ${error.message}`);
        process.exit(1);
    }
});
start();
