import express from "express";
import cors from "cors";
import { Server, Socket } from "socket.io";
import http from "http";
import path from "path";

import router from "./routes/index";
import { connection } from "./db";
import Lobby from "./lobby";
import Play from "./play";

// Extend the Socket type to include `playInstance`
interface CustomSocket extends Socket {
  playInstance?: Play;
  socket_game_id?: string | null;
}

const corsOptions = {
  origin: "http://localhost:8080", // Replace with your frontend URL
  optionsSuccessStatus: 200,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
export const serverSocket = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Use static files from the client directory
app.use(express.static(path.join(__dirname, "..", "client")));

app.get("/", (req, res) => {
  console.log("Socket listening on :4000");
  res.sendStatus(200);
});

app.use("/api/v1", router);

server.listen(4000, () => {
  console.log("Socket listening on :4000");
  console.log(process.env.APP_URL);
});

const start = async () => {
  try {
    await connection();

    app.listen(PORT, () => console.log("Database connection successful"));

    serverSocket.sockets.on("connection", (client: CustomSocket) => {
      console.log(`New player has connected: ${client.id}`);

      // Create a new Play instance and store it on the client object
      const playerPlayInstance = new Play(
        client.id,
        (gameId: string) => {
          client.leave(gameId); // Logic for leaving the game
        },
        serverSocket.to(client.id) // Logic for broadcasting events
      );

      // Store the Play instance on the client object
      client.playInstance = playerPlayInstance;

      // Lobby event handlers
      client.on("enter lobby", Lobby.onEnterLobby);
      client.on("leave lobby", Lobby.onLeaveLobby);
      client.on("create game", Lobby.onCreateGame);
      client.on("enter pending game", Lobby.onEnterPendingGame);
      client.on("leave pending game", Lobby.onLeavePendingGame);

      // Play event handlers using the `Play` instance
      client.on("start game", () => playerPlayInstance.onStartGame());
      client.on("update player position", (coordinates) =>
        playerPlayInstance.updatePlayerPosition(coordinates)
      );
      client.on("create bomb", (bombDetails) =>
        playerPlayInstance.createBomb(bombDetails)
      );
      client.on("pick up spoil", (spoilDetails) =>
        playerPlayInstance.onPickUpSpoil(spoilDetails)
      );
      client.on("player died", (deathCoordinates) =>
        playerPlayInstance.onPlayerDied(deathCoordinates)
      );
      client.on("leave game", () => playerPlayInstance.onLeaveGame());

      client.on("joinRoom", (req) => {
        const { room_id } = req;
        client.join(room_id);
      });

      client.on("leaveRoom", async (req) => {
        const { room_id } = req;
        client.leave(room_id);
      });

      // Handle disconnection
      client.on("disconnect", () => onClientDisconnect(client));
    });

    // Refactor the `onClientDisconnect` function
    function onClientDisconnect(client: CustomSocket) {
      if (client.socket_game_id == null) {
        console.log("Player was not inside any game...");
        return;
      }
      console.log("Player was inside game...");

      // If the game is pending, use Lobby methods
      Lobby.onLeavePendingGame.call(client);

      // If the game is active, use the `Play` instance method
      if (client.playInstance) {
        client.playInstance.onDisconnectFromGame();
      }
    }
  } catch (error: any) {
    console.log(`Server not running. Error message: ${error.message}`);
    process.exit(1);
  }
};

start();
