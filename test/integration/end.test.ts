import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POINTS_PER_WIN } from "@/constants";
import type { EndReason } from "@/types";
import type { TestPlayer } from "../helpers/players";
import { expectNoEvent, startTwoPlayerGame, waitFor } from "../helpers/players";
import { startTestServer, TestServer } from "../helpers/server";

type ShowTombstone = { player_id: string; col: number; row: number };
type PlayerWin = { winner: { id: string } };
type EndGame = { game_id: string; new_game_id: string; reason: EndReason };

// The server sends "end game" 5 s after a win.
const END_GAME_TIMEOUT_MS = 8000;
const TEST_TIMEOUT_MS = 20000;

describe("match end", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  // p2's client reports its own death, killed by p1.
  function killP2(p1: TestPlayer, p2: TestPlayer, gameId: string) {
    p2.socket.emit("player died", {
      playerId: p2.id,
      gameId,
      killerId: p1.id,
      col: 3,
      row: 4,
    });
  }

  it("player died → show tombstone for both", async () => {
    const { p1, p2, gameId } = await startTwoPlayerGame(server.url);

    const tombstones = Promise.all([
      waitFor<ShowTombstone>(p1.socket, "show tombstone"),
      waitFor<ShowTombstone>(p2.socket, "show tombstone"),
    ]);
    killP2(p1, p2, gameId);

    for (const tombstone of await tombstones) {
      expect(tombstone.player_id).toBe(p2.id);
      expect(tombstone.col).toBe(3);
      expect(tombstone.row).toBe(4);
    }
  });

  it(
    "the last player alive wins: player win, then end game once",
    async () => {
      const { p1, p2, gameId } = await startTwoPlayerGame(server.url);

      const won = waitFor<PlayerWin>(p1.socket, "player win");
      const ended = waitFor<EndGame>(
        p1.socket,
        "end game",
        END_GAME_TIMEOUT_MS,
      );
      killP2(p1, p2, gameId);

      expect((await won).winner.id).toBe(p1.id);
      const end = await ended;
      expect(end.game_id).toBe(gameId);
      expect(typeof end.new_game_id).toBe("string");
      expect(end.reason).toBe("win");

      await expectNoEvent(p1.socket, "end game", 2000);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "end of match writes play stats",
    async () => {
      const { p1, p2, gameId } = await startTwoPlayerGame(server.url);
      const { default: PlayStats } = await import("@/db/models/PlayStats");

      const ended = waitFor(p1.socket, "end game", END_GAME_TIMEOUT_MS);
      killP2(p1, p2, gameId);
      await ended;

      // Stats are written before the server sends "end game".
      const winnerStats = await PlayStats.findOne({ userId: p1.id });
      const loserStats = await PlayStats.findOne({ userId: p2.id });
      expect(winnerStats?.games).toBe(1);
      expect(winnerStats?.wins).toBe(1);
      expect(winnerStats?.points).toBeGreaterThanOrEqual(POINTS_PER_WIN);
      expect(loserStats?.games).toBe(1);
      expect(loserStats?.wins).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );
});
