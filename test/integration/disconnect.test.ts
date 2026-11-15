import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TestPlayer } from "../helpers/players";
import {
  connectPlayer,
  createUser,
  emitAck,
  startTwoPlayerGame,
  uniqueName,
  waitFor,
} from "../helpers/players";
import { startTestServer, TestServer } from "../helpers/server";

type CurrentGame = { players: { id: string }[] };
type UpdateGame = { current_game: { players: { id: string }[] } };
type PlayerDisconnect = { player_id: string };

describe("disconnect and re-join", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  async function newPlayer(
    prefix: string,
    socketId?: string,
  ): Promise<TestPlayer> {
    const name = uniqueName(prefix);
    const identity = { name, email: `${name}@example.com` };
    await createUser(server.url, identity);
    return connectPlayer(server.url, { ...identity, socketId });
  }

  async function createGame(player: TestPlayer): Promise<string> {
    const { game_id } = await emitAck<{ game_id: string }>(
      player.socket,
      "create game",
      {
        mapName: "small_map",
        gameName: uniqueName("game"),
        isPortalsEnabled: false,
        isDelaySpoilEnabled: false,
      },
    );
    return game_id;
  }

  // Enters the pending game and waits until every listed player got the update.
  async function enterPendingGame(
    entering: TestPlayer,
    watchers: TestPlayer[],
    gameId: string,
  ): Promise<UpdateGame> {
    const updates = Promise.all(
      [entering, ...watchers].map(player =>
        waitFor<UpdateGame>(player.socket, "update game"),
      ),
    );
    entering.socket.emit("enter pending game", gameId);
    return (await updates)[0];
  }

  // A running game with three players: one disconnect leaves two.
  async function startThreePlayerGame() {
    const [p1, p2, p3] = [
      await newPlayer("p1"),
      await newPlayer("p2"),
      await newPlayer("p3"),
    ];
    const gameId = await createGame(p1);
    await enterPendingGame(p1, [], gameId);
    await enterPendingGame(p2, [p1], gameId);
    await enterPendingGame(p3, [p1, p2], gameId);

    const timerStarted = [p1, p2, p3].map(player =>
      waitFor(player.socket, "start timer"),
    );
    p1.socket.emit("start timer", gameId);
    await Promise.all(timerStarted);

    const launched = [p1, p2, p3].map(player =>
      waitFor(player.socket, "launch game"),
    );
    for (const player of [p1, p2, p3]) {
      player.socket.emit("start game", gameId);
    }
    await Promise.all(launched);
    return { p1, p2, p3, gameId };
  }

  it("closing a socket tells the other player", async () => {
    const { p1, p2, p3, gameId } = await startThreePlayerGame();

    const told = waitFor<PlayerDisconnect>(p1.socket, "player disconnect");
    p2.socket.disconnect();

    expect((await told).player_id).toBe(p2.id);
    const game = await emitAck<CurrentGame>(
      p1.socket,
      "get current game",
      gameId,
    );
    expect(game.players.map(player => player.id).sort()).toEqual(
      [p1.id, p3.id].sort(),
    );
  });

  it("a disconnect that leaves one player ends the match", async () => {
    const { p1, p2, gameId } = await startTwoPlayerGame(server.url);

    const ended = waitFor<{ game_id: string }>(p1.socket, "end game");
    p2.socket.disconnect();

    expect((await ended).game_id).toBe(gameId);
  });

  it("a disconnect clears the Play bomb-queue interval", async () => {
    const { p1, p2, p3 } = await startThreePlayerGame();
    // The Play instance of p2's server-side socket keeps the interval handle.
    const serverSocket = server.io.sockets.sockets.get(p2.socket.id ?? "") as
      | { playInstance?: { bombQueueInterval: unknown } }
      | undefined;
    const interval = serverSocket?.playInstance?.bombQueueInterval;
    expect(interval).toBeTruthy();

    const spy = vi.spyOn(global, "clearInterval");
    try {
      const told = waitFor(p1.socket, "player disconnect");
      p2.socket.disconnect();
      await told;

      expect(spy).toHaveBeenCalledWith(interval);
    } finally {
      spy.mockRestore();
    }
    expect(p3.socket.connected).toBe(true);
  });

  it("the same socketId reconnecting is the same player", async () => {
    const p1 = await newPlayer("p1");
    const p2 = await newPlayer("p2");
    const gameId = await createGame(p1);
    await enterPendingGame(p1, [], gameId);
    await enterPendingGame(p2, [p1], gameId);

    // The server removes p2 from the pending game and updates p1.
    const left = waitFor<UpdateGame>(p1.socket, "update game");
    p2.socket.disconnect();
    expect((await left).current_game.players).toHaveLength(1);

    const again = await connectPlayer(server.url, {
      name: p2.name,
      email: p2.email,
      socketId: p2.id,
    });
    const update = await enterPendingGame(again, [p1], gameId);

    expect(update.current_game.players.map(player => player.id).sort()).toEqual(
      [p1.id, p2.id].sort(),
    );
  });
});
