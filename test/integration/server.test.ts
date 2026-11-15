import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connectPlayer, emitAck, uniqueName } from "../helpers/players";
import { TestServer, startTestServer } from "../helpers/server";

describe("test server", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  it("answers GET / with 200", async () => {
    const response = await fetch(`${server.url}/`);
    expect(response.status).toBe(200);
  });

  it("uses the in-memory database", () => {
    expect(process.env.DB_HOST).toMatch(/^mongodb:\/\/127\.0\.0\.1/);
    expect(mongoose.connection.readyState).toBe(1);
    expect(mongoose.connection.host).toBe("127.0.0.1");
  });

  it("connects a player with handshake auth", async () => {
    const name = uniqueName("player");
    const player = await connectPlayer(server.url, {
      name,
      email: `${name}@example.com`,
    });
    expect(player.socket.connected).toBe(true);

    const games = await emitAck<unknown[]>(player.socket, "enter lobby");
    expect(Array.isArray(games)).toBe(true);
  });
});
