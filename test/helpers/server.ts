import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { AddressInfo } from "net";
import type { Server } from "socket.io";

import { disconnectAllPlayers } from "./players";

export type TestServer = {
  url: string;
  io: Server;
  stop(): Promise<void>;
};

// Starts an in-memory MongoDB and the app server on a random port.
// Start one server per test file: createServer() replaces the shared io.
export async function startTestServer(): Promise<TestServer> {
  const mongod = await MongoMemoryServer.create();
  // Set before any src module loads: src/db/connection.ts reads DB_HOST once,
  // when it is first imported.
  process.env.DB_HOST = mongod.getUri("bomberman-test");

  const { connection } = await import("@/db");
  const { createServer } = await import("@/server");

  await connection();
  const { httpServer, io } = createServer();
  await new Promise<void>(resolve => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;

  const stop = async () => {
    disconnectAllPlayers();
    io.disconnectSockets(true);
    // io.close() also closes the HTTP server.
    await new Promise<void>(resolve => {
      io.close(() => resolve());
    });
    if (httpServer.listening) {
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
    await mongoose.disconnect();
    await mongod.stop();
  };

  return { url: `http://127.0.0.1:${port}`, io, stop };
}
