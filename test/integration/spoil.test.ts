import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  DESTRUCTIBLE_CELL,
  EMPTY_CELL,
  INITIAL_DELAY,
  POWER,
  SPEED,
} from "../../src/constants";
import {
  emitAck,
  expectNoEvent,
  startTwoPlayerGame,
  waitFor,
} from "../helpers/players";
import { TestServer, startTestServer } from "../helpers/server";

type Spoil = { id: string; row: number; col: number; spoil_type: number };
type Cell = { row: number; col: number };
type BlastedCell = Cell & { destroyed: boolean; spoil: Spoil | null };
type DetonateBomb = { bomb_id: string; blastedCells: BlastedCell[] };
type SpoilPicked = { player_id: string; spoil_id: string; spoil_type: number };
type CurrentGame = {
  players: { id: string; power: number }[];
  shadow_map: number[][];
};

const FUSE_TIMEOUT_MS = INITIAL_DELAY + 1500;

describe("spoils", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await server?.stop();
  });

  // An empty cell with a box on one side, found from the map the server sent.
  function emptyCellBesideBox(game: CurrentGame): { bomb: Cell; box: Cell } {
    const { shadow_map: map } = game;
    const sides = [
      { row: -1, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
    ];
    for (let row = 0; row < map.length; row++) {
      for (let col = 0; col < map[row].length; col++) {
        if (map[row][col] !== EMPTY_CELL) {
          continue;
        }
        for (const side of sides) {
          const box = { row: row + side.row, col: col + side.col };
          if (map[box.row]?.[box.col] === DESTRUCTIBLE_CELL) {
            return { bomb: { row, col }, box };
          }
        }
      }
    }
    throw new Error("the map has no box beside an empty cell");
  }

  // Starts a game, then forces the spoil roll and type, bombs a cell next to a
  // box and returns the spoil that the destroyed box leaves.
  // The mock starts after the game starts, so spawns stay random.
  async function dropSpoil(randomValue: number) {
    const { p1, p2, gameId, game } = await startTwoPlayerGame(server.url);
    const { bomb, box } = emptyCellBesideBox(game as CurrentGame);

    // 0.34 passes the 50 % roll and picks index 1 of [SPEED, POWER, BOMBS];
    // 0 passes the roll and picks index 0 (SPEED).
    vi.spyOn(Math, "random").mockReturnValue(randomValue);
    const detonated = waitFor<DetonateBomb>(
      p1.socket,
      "detonate bomb",
      FUSE_TIMEOUT_MS,
    );
    p1.socket.emit("create bomb", {
      playerId: p1.id,
      gameId,
      col: bomb.col,
      row: bomb.row,
    });
    const blast = await detonated;
    vi.restoreAllMocks();

    const boxCell = blast.blastedCells.find(
      cell => cell.row === box.row && cell.col === box.col,
    );
    if (!boxCell?.destroyed || !boxCell.spoil) {
      throw new Error("the forced roll left no spoil on the destroyed box");
    }
    return { p1, p2, gameId, spoil: boxCell.spoil };
  }

  async function powerOf(
    socket: Parameters<typeof emitAck>[0],
    gameId: string,
    playerId: string,
  ) {
    const game = await emitAck<CurrentGame>(socket, "get current game", gameId);
    return game.players.find(player => player.id === playerId)?.power;
  }

  it("pick up spoil applies and is announced", async () => {
    const { p1, p2, gameId, spoil } = await dropSpoil(0.34);
    expect(spoil.spoil_type).toBe(POWER);
    expect(await powerOf(p1.socket, gameId, p1.id)).toBe(1);

    const announced = waitFor<SpoilPicked>(p2.socket, "spoil was picked");
    p1.socket.emit("pick up spoil", {
      spoil_id: spoil.id,
      playerId: p1.id,
      gameId,
    });

    expect(await announced).toEqual({
      player_id: p1.id,
      spoil_id: spoil.id,
      spoil_type: POWER,
    });
    expect(await powerOf(p1.socket, gameId, p1.id)).toBe(2);
  });

  it("a picked spoil cannot be picked again", async () => {
    const { p1, p2, gameId, spoil } = await dropSpoil(0.34);

    const announced = waitFor<SpoilPicked>(p2.socket, "spoil was picked");
    p1.socket.emit("pick up spoil", {
      spoil_id: spoil.id,
      playerId: p1.id,
      gameId,
    });
    await announced;

    const second = expectNoEvent(p1.socket, "spoil was picked");
    p2.socket.emit("pick up spoil", {
      spoil_id: spoil.id,
      playerId: p2.id,
      gameId,
    });
    await second;
    expect(await powerOf(p1.socket, gameId, p1.id)).toBe(2);
    expect(await powerOf(p2.socket, gameId, p2.id)).toBe(1);
  });

  it("a spoil of another type is announced and leaves power unchanged", async () => {
    const { p1, p2, gameId, spoil } = await dropSpoil(0);
    expect(spoil.spoil_type).toBe(SPEED);

    const announced = waitFor<SpoilPicked>(p2.socket, "spoil was picked");
    p1.socket.emit("pick up spoil", {
      spoil_id: spoil.id,
      playerId: p1.id,
      gameId,
    });

    expect((await announced).spoil_type).toBe(SPEED);
    expect(await powerOf(p1.socket, gameId, p1.id)).toBe(1);
  });
});
