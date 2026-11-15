import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startTwoPlayerGame, waitFor } from "../helpers/players";
import { startTestServer, TestServer } from "../helpers/server";

type MovePlayer = { player_id: string; x: number; y: number };

describe("movement", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  it("update player position reaches the other player as move player", async () => {
    const { p1, p2, gameId } = await startTwoPlayerGame(server.url);

    const moved = waitFor<MovePlayer>(p2.socket, "move player");
    p1.socket.emit("update player position", {
      playerId: p1.id,
      gameId,
      x: 123,
      y: 456,
    });

    expect(await moved).toEqual({ player_id: p1.id, x: 123, y: 456 });
  });

  it("the sender also gets its own move player", async () => {
    // docs/socket-contract.md: the sender receives it too and ignores it.
    const { p1, gameId } = await startTwoPlayerGame(server.url);

    const own = waitFor<MovePlayer>(p1.socket, "move player");
    p1.socket.emit("update player position", {
      playerId: p1.id,
      gameId,
      x: 10,
      y: 20,
    });

    expect(await own).toEqual({ player_id: p1.id, x: 10, y: 20 });
  });
});
