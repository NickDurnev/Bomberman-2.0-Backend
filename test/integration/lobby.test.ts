import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestPlayer } from "../helpers/players";
import {
  connectPlayer,
  createUser,
  emitAck,
  uniqueName,
  waitFor,
} from "../helpers/players";
import { startTestServer, TestServer } from "../helpers/server";

type GameSummary = {
  id: string;
  name: string;
  players: { id: string; name: string }[];
};
type UpdateGame = { current_game: GameSummary };

describe("lobby and game start", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  async function newPlayer(prefix: string): Promise<TestPlayer> {
    const name = uniqueName(prefix);
    const identity = { name, email: `${name}@example.com` };
    await createUser(server.url, identity);
    return connectPlayer(server.url, identity);
  }

  function createGame(player: TestPlayer, gameName = uniqueName("game")) {
    return emitAck<{ game_id: string }>(player.socket, "create game", {
      mapName: "small_map",
      gameName,
      isPortalsEnabled: false,
      isDelaySpoilEnabled: false,
    });
  }

  it("enter lobby returns pending games", async () => {
    const creator = await newPlayer("creator");
    const gameName = uniqueName("game");
    const { game_id } = await createGame(creator, gameName);

    const viewer = await newPlayer("viewer");
    const games = await emitAck<GameSummary[]>(viewer.socket, "enter lobby");

    expect(Array.isArray(games)).toBe(true);
    expect(games.find(game => game.id === game_id)?.name).toBe(gameName);
  });

  it("create game returns a game_id and the lobby sees it", async () => {
    const creator = await newPlayer("creator");
    const watcher = await newPlayer("watcher");
    await emitAck(watcher.socket, "enter lobby");

    const gameName = uniqueName("game");
    const display = waitFor<GameSummary[]>(
      watcher.socket,
      "display pending games",
    );
    const { game_id } = await createGame(creator, gameName);
    const games = await display;

    expect(typeof game_id).toBe("string");
    expect(game_id).not.toBe("");
    expect(games.find(game => game.id === game_id)?.name).toBe(gameName);
  });

  it("check game name reports a taken name", async () => {
    const player = await newPlayer("namer");
    const gameName = uniqueName("game");

    const before = await emitAck<{ isAvailable: boolean }>(
      player.socket,
      "check game name",
      gameName,
    );
    expect(before.isAvailable).toBe(true);

    await createGame(player, gameName);
    const after = await emitAck<{ isAvailable: boolean }>(
      player.socket,
      "check game name",
      gameName,
    );
    expect(after.isAvailable).toBe(false);
  });

  it("a second player joins and both get the updated game with 2 players", async () => {
    const p1 = await newPlayer("p1");
    const p2 = await newPlayer("p2");
    const { game_id } = await createGame(p1);

    const p1Entered = waitFor<UpdateGame>(p1.socket, "update game");
    p1.socket.emit("enter pending game", game_id);
    const first = await p1Entered;
    expect(first.current_game.players).toHaveLength(1);

    const both = Promise.all([
      waitFor<UpdateGame>(p1.socket, "update game"),
      waitFor<UpdateGame>(p2.socket, "update game"),
    ]);
    p2.socket.emit("enter pending game", game_id);
    const [forP1, forP2] = await both;

    for (const update of [forP1, forP2]) {
      expect(update.current_game.id).toBe(game_id);
      expect(
        update.current_game.players.map(player => player.id).sort(),
      ).toEqual([p1.id, p2.id].sort());
    }
  });

  it("leave pending game removes the player", async () => {
    const p1 = await newPlayer("p1");
    const p2 = await newPlayer("p2");
    const { game_id } = await createGame(p1);

    const p1Entered = waitFor<UpdateGame>(p1.socket, "update game");
    p1.socket.emit("enter pending game", game_id);
    await p1Entered;
    const bothEntered = Promise.all([
      waitFor<UpdateGame>(p1.socket, "update game"),
      waitFor<UpdateGame>(p2.socket, "update game"),
    ]);
    p2.socket.emit("enter pending game", game_id);
    await bothEntered;

    const left = waitFor<UpdateGame>(p1.socket, "update game");
    p2.socket.emit("leave pending game");
    const update = await left;

    expect(update.current_game.players.map(player => player.id)).toEqual([
      p1.id,
    ]);
  });

  it("the DB fallback fills a missing handshake name", async () => {
    const dbName = uniqueName("dbname");
    const email = `${dbName}@example.com`;
    await createUser(server.url, { name: dbName, email });
    // The handshake carries an empty name, so Game.addPlayer reads the DB.
    const player = await connectPlayer(server.url, { name: "", email });
    // The server stores the socket id without awaiting it: poll the DB.
    const { default: User } = await import("@db/models/User");
    const deadline = Date.now() + 3000;
    for (;;) {
      const user = await User.findOne({ email });
      if (user?.socketID === player.id) {
        break;
      }
      if (Date.now() > deadline) {
        throw new Error(`timeout waiting for the stored socket id of ${email}`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const { game_id } = await createGame(player);

    const entered = waitFor<UpdateGame>(player.socket, "update game");
    player.socket.emit("enter pending game", game_id);
    const update = await entered;

    expect(update.current_game.players).toHaveLength(1);
    expect(update.current_game.players[0].name).toBe(dbName);
  });

  it("start timer reaches both players", async () => {
    const p1 = await newPlayer("p1");
    const p2 = await newPlayer("p2");
    const { game_id } = await createGame(p1);
    for (const player of [p1, p2]) {
      const entered = waitFor(player.socket, "update game");
      player.socket.emit("enter pending game", game_id);
      await entered;
    }

    const timer = Promise.all([
      waitFor(p1.socket, "start timer"),
      waitFor(p2.socket, "start timer"),
    ]);
    p1.socket.emit("start timer", game_id);
    await timer;
  });

  it("start game moves the game to running and get current game lists both players", async () => {
    const p1 = await newPlayer("p1");
    const p2 = await newPlayer("p2");
    const { game_id } = await createGame(p1);
    for (const player of [p1, p2]) {
      const entered = waitFor(player.socket, "update game");
      player.socket.emit("enter pending game", game_id);
      await entered;
    }

    const before = await emitAck<unknown>(
      p1.socket,
      "get current game",
      game_id,
    );
    // undefined travels as null in an acknowledgement.
    expect(before ?? undefined).toBeUndefined();

    const launched = Promise.all([
      waitFor<GameSummary>(p1.socket, "launch game"),
      waitFor<GameSummary>(p2.socket, "launch game"),
    ]);
    p1.socket.emit("start game", game_id);
    await launched;

    const game = await emitAck<GameSummary>(
      p1.socket,
      "get current game",
      game_id,
    );
    expect(game.id).toBe(game_id);
    expect(game.players.map(player => player.id).sort()).toEqual(
      [p1.id, p2.id].sort(),
    );
  });
});
