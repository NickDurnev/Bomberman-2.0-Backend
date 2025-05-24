require("module-alias/register");
import http from "http";
import path from "path";
import cors from "cors";
import express from "express";
import cron from "node-cron";
import { Server } from "socket.io";

import { Game } from "@entity/game";
import { storeSocketID } from "@services/socket";
import { deleteAllStats } from "@services/stats";
import { CustomSocket } from "@types";

import { connection } from "./db";
import Lobby from "./lobby";
import Play from "./play";
import router from "./routes/index";

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://www.bomberman.click",
    "https://dev.bomberman.click",
  ],
  optionsSuccessStatus: 200,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
const server = http.createServer(app);
const PORT = process.env.PORT ?? 4000;
export const serverSocket = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Use static files from the client directory
app.use(express.static(path.join(__dirname, "..", "client")));

app.get("/", (_, res) => {
  res.sendStatus(200);
});

app.use("/api/v1", router);

// Schedule the cron job to run at 3 AM on the first day of every month
cron.schedule("0 3 1 * *", () => {
  console.log("Running deleteAllStats cron job...");
  deleteAllStats();
});

const start = async () => {
  try {
    await connection();

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

    serverSocket.sockets.on("connection", (client: CustomSocket) => {
      //update user socket id
      client.on("updateUserSocketId", async (req, callback) => {
        await storeSocketID(req.email, req.socket_id);

        client.customId = req.socket_id;

        callback({
          status: 200,
          message: "Socket id updated successfully",
        });
      });

      // Create a new Play instance and store it on the client object
      const playerPlayInstance = new Play(
        client.id,
        (gameId: string) => {
          client.leave(gameId);
        },
        serverSocket.to(client.id),
      );

      // Store the Play instance on the client object
      client.playInstance = playerPlayInstance;

      // Lobby event handlers
      client.on("enter lobby", Lobby.onEnterLobby);
      client.on("leave lobby", Lobby.onLeaveLobby);
      client.on("create game", Lobby.onCreateGame);
      client.on("enter pending game", Lobby.onEnterPendingGame);
      client.on("leave pending game", Lobby.onLeavePendingGame);
      client.on("check game name", Lobby.onCheckNameAvailable);

      // Play event handlers using the `Play` instance
      client.on(
        "get current game",
        (game_id: string, callback: (game: Game | undefined) => void) => {
          const game = playerPlayInstance.onGetCurrentGame(game_id);
          callback(game); // Send the game data back to the client
        },
      );
      client.on("start timer", (game_id: string) =>
        playerPlayInstance.onStartTimer(game_id),
      );
      client.on("start game", (game_id: string) =>
        playerPlayInstance.onStartGame(game_id),
      );
      client.on("update player position", data =>
        playerPlayInstance.updatePlayerPosition(data),
      );
      client.on("create bomb", bombDetails =>
        playerPlayInstance.createBomb(bombDetails),
      );
      client.on("detonate bomb by blast", bombDetails =>
        playerPlayInstance.onBlastVsBomb(bombDetails),
      );
      client.on("pick up spoil", spoilDetails =>
        playerPlayInstance.onPickUpSpoil(spoilDetails),
      );
      client.on("use portal", portalDetails =>
        playerPlayInstance.onUsePortal(portalDetails),
      );
      client.on("player died", data => playerPlayInstance.onPlayerDied(data));
      client.on("leave game", () => playerPlayInstance.onLeaveGame());

      client.on("player disconnect", data =>
        playerPlayInstance.onDisconnectFromGame(data.player_id),
      );

      client.on("joinRoom", data => {
        const { room_id } = data;
        client.join(room_id);
      });

      client.on("leaveRoom", data => {
        const { room_id } = data;
        client.leave(room_id);
      });

      // Handle disconnection
      client.on("disconnect", () => onClientDisconnect(client));
    });

    function onClientDisconnect(client: CustomSocket) {
      if (client.socket_game_id == null) {
        return;
      }

      // If the game is pending, use Lobby methods
      Lobby.onLeavePendingGame.call(client);

      // If the game is active, use the `Play` instance method
      if (client.playInstance) {
        client.playInstance.onDisconnectFromGame(client.customId || "");
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(`Server not running. Error message: ${error.message}`);
    } else {
      console.log("Server not running due to an unknown error");
    }
    process.exit(1);
  }
};

start();
