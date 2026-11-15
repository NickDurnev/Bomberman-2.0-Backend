import { Server } from "socket.io";

// The socket.io server shared by Lobby and Play. createServer() sets it.
let io: Server | undefined;

export function setIo(server: Server): void {
  io = server;
}

export function getIo(): Server {
  if (!io) {
    throw new Error("socket.io server not created");
  }
  return io;
}
