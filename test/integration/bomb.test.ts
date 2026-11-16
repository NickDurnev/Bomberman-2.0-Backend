import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DESTRUCTIBLE_CELL, EMPTY_CELL, INITIAL_DELAY } from "@/constants";
import type { ClientSocket, TestPlayer } from "../helpers/players";
import { startTwoPlayerGame, waitFor } from "../helpers/players";
import { startTestServer, TestServer } from "../helpers/server";

type Cell = { row: number; col: number };
type CurrentGame = {
  players: { id: string; spawnOnGrid: Cell }[];
  shadow_map: number[][];
};
type ShowBomb = {
  bomb_id: string;
  playerId: string;
  col: number;
  row: number;
  delay: number;
};
type BlastedCell = {
  row: number;
  col: number;
  type: string;
  destroyed: boolean;
};
type DetonateBomb = {
  bomb_id: string;
  playerId: string;
  blastedCells: BlastedCell[];
};

// The fuse plus the 100 ms queue tick, with room for a slow machine.
const FUSE_TIMEOUT_MS = INITIAL_DELAY + 1500;

describe("bombs", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  function spawnOf(game: CurrentGame, player: TestPlayer): Cell {
    const found = game.players.find(entry => entry.id === player.id);
    if (!found) {
      throw new Error(`player ${player.id} is not in the game`);
    }
    return found.spawnOnGrid;
  }

  function placeBomb(
    socket: ClientSocket,
    player: TestPlayer,
    gameId: string,
    { col, row }: Cell,
  ) {
    socket.emit("create bomb", { playerId: player.id, gameId, col, row });
  }

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

  it("create bomb makes both players get show bomb", async () => {
    const { p1, p2, gameId, game } = await startTwoPlayerGame(server.url);
    const cell = spawnOf(game as CurrentGame, p1);

    const shown = Promise.all([
      waitFor<ShowBomb>(p1.socket, "show bomb"),
      waitFor<ShowBomb>(p2.socket, "show bomb"),
    ]);
    placeBomb(p1.socket, p1, gameId, cell);
    const [own, other] = await shown;

    expect(own.bomb_id).toEqual(expect.any(String));
    expect(own).toEqual({
      bomb_id: own.bomb_id,
      playerId: p1.id,
      col: cell.col,
      row: cell.row,
      delay: own.delay,
    });
    expect(other).toEqual(own);
  });

  it("show bomb carries the bomb's fuse delay", async () => {
    const { p1, p2, gameId, game } = await startTwoPlayerGame(server.url);
    const cell = spawnOf(game as CurrentGame, p1);

    const shown = Promise.all([
      waitFor<ShowBomb>(p1.socket, "show bomb"),
      waitFor<ShowBomb>(p2.socket, "show bomb"),
    ]);
    placeBomb(p1.socket, p1, gameId, cell);
    const [own, other] = await shown;

    expect(own.delay).toBe(2000);
    expect(other.delay).toBe(2000);
  });

  it("the server detonates the bomb after the player's delay", async () => {
    const { p1, p2, gameId, game } = await startTwoPlayerGame(server.url);
    const cell = spawnOf(game as CurrentGame, p1);

    const shown = waitFor<ShowBomb>(p1.socket, "show bomb");
    const detonated = waitFor<DetonateBomb>(
      p2.socket,
      "detonate bomb",
      FUSE_TIMEOUT_MS,
    );
    const startedAt = Date.now();
    placeBomb(p1.socket, p1, gameId, cell);
    const { bomb_id } = await shown;
    const blast = await detonated;
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(INITIAL_DELAY - 300);
    expect(blast.bomb_id).toBe(bomb_id);
    expect(blast.playerId).toBe(p1.id);
    const center = blast.blastedCells.find(
      blasted => blasted.row === cell.row && blasted.col === cell.col,
    );
    expect(center).toMatchObject({
      type: "explosion_center",
      destroyed: false,
    });
  });

  it("a blasted box is reported destroyed", async () => {
    const { p1, gameId, game } = await startTwoPlayerGame(server.url);
    const { bomb, box } = emptyCellBesideBox(game as CurrentGame);

    const detonated = waitFor<DetonateBomb>(
      p1.socket,
      "detonate bomb",
      FUSE_TIMEOUT_MS,
    );
    placeBomb(p1.socket, p1, gameId, bomb);
    const blast = await detonated;

    const boxCell = blast.blastedCells.find(
      blasted => blasted.row === box.row && blasted.col === box.col,
    );
    expect(boxCell?.destroyed).toBe(true);
  });

  it("detonate bomb by blast detonates a second bomb at once", async () => {
    const { p1, p2, gameId, game } = await startTwoPlayerGame(server.url);
    const first = spawnOf(game as CurrentGame, p1);
    const second = spawnOf(game as CurrentGame, p2);

    const detonations: DetonateBomb[] = [];
    p2.socket.on("detonate bomb", (payload: DetonateBomb) => {
      detonations.push(payload);
    });

    const shownFirst = waitFor<ShowBomb>(p1.socket, "show bomb");
    placeBomb(p1.socket, p1, gameId, first);
    const { bomb_id: firstId } = await shownFirst;
    const shownSecond = waitFor<ShowBomb>(p1.socket, "show bomb");
    placeBomb(p1.socket, p1, gameId, second);
    const { bomb_id: secondId } = await shownSecond;

    const chained = waitFor<DetonateBomb>(p2.socket, "detonate bomb", 1000);
    const startedAt = Date.now();
    p2.socket.emit("detonate bomb by blast", {
      bomb_id: secondId,
      gameId,
      playerId: p1.id,
    });
    const blast = await chained;

    expect(blast.bomb_id).toBe(secondId);
    expect(Date.now() - startedAt).toBeLessThan(1000);

    // The first bomb keeps its fuse; the second one is detonated only once.
    await waitFor<DetonateBomb>(p2.socket, "detonate bomb", FUSE_TIMEOUT_MS);
    expect(detonations.map(entry => entry.bomb_id)).toEqual([
      secondId,
      firstId,
    ]);
  });
});
