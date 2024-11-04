import express from "express";
import { Server } from "socket.io";
import http from "http";
import path from "path";

import { connection } from "../db";
import Lobby from "./lobby";
import Play from "./play";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
export const serverSocket = new Server(server);

// Use static files from the client directory
app.use(express.static(path.join(__dirname, "..", "client")));

app.get("/", (req, res) => {
  console.log("Socket listening on :4000");
});

server.listen(4000, () => {
  console.log("Socket listening on :4000");
  console.log(process.env.APP_URL);
});

const start = async () => {
  try {
    await connection();

    app.listen(PORT, () => console.log("Database connection successful"));

    // Inside your socket connection handler
    serverSocket.sockets.on("connection", (client) => {
      console.log(`New player has connected: ${client.id}`);

      // Create a new Play instance for this client
      const playerPlayInstance = new Play(
        client.id,
        (gameId: string) => {
          client.leave(gameId); // Logic for leaving the game
        },
        serverSocket.to(client.id) // Logic for broadcasting events
      );

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

      // Handle disconnection
      client.on("disconnect", () => {
        playerPlayInstance.onDisconnectFromGame();
        onClientDisconnect(client);
      });
    });

    // Handle client disconnection
    function onClientDisconnect(client: any) {
      if (client.socket_game_id == null) {
        console.log("Player was not inside any game...");
        return;
      }
      console.log("Player was inside game...");

      // If the game is pending, use Lobby methods
      Lobby.onLeavePendingGame.call(client);

      // If the game is active, use Play methods
      Play.onDisconnectFromGame.call(client);
    }
  } catch (error: any) {
    console.log(`Server not running. Error message: ${error.message}`);
    process.exit(1);
  }
};

start();
