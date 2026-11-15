import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { uniqueName } from "../helpers/players";
import { startTestServer, TestServer } from "../helpers/server";

type StatsRow = { userId: string; userName: string; points: number };
type StatsBody = {
  status: string;
  code: number;
  data: { stats: StatsRow[]; total: number };
};

describe("play stats", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  function getStats(query: string): Promise<Response> {
    return fetch(`${server.url}/api/v1/stats?${query}`);
  }

  it("updatePlayerStats creates a row, then adds to it", async () => {
    const { default: PlayStats } = await import("@db/models/PlayStats");
    const { updatePlayerStats } = await import("@services/stats");
    const userId = uniqueName("stats-user");

    await updatePlayerStats({
      userId,
      kills: 2,
      isWin: true,
      points: 10,
      isTop3: true,
    });
    await updatePlayerStats({
      userId,
      kills: 1,
      isWin: false,
      points: 3,
      isTop3: false,
    });

    const rows = await PlayStats.find({ userId }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId,
      userName: "Unknown",
      games: 2,
      kills: 3,
      wins: 1,
      points: 13,
      top3: 1,
    });
  });

  it("GET /api/v1/stats applies sort, skip and limit", async () => {
    const { default: PlayStats } = await import("@db/models/PlayStats");
    const prefix = uniqueName("sorted");
    await PlayStats.create([
      {
        userId: `${prefix}-a`,
        userName: `${prefix}-a`,
        points: 5000,
        kills: 3000,
      },
      {
        userId: `${prefix}-b`,
        userName: `${prefix}-b`,
        points: 50000,
        kills: 1000,
      },
      {
        userId: `${prefix}-c`,
        userName: `${prefix}-c`,
        points: 20000,
        kills: 2000,
      },
    ]);

    // Other tests in this file add rows too. The values here are far above
    // theirs, so these rows are the first ones in each sort order.
    const total = await PlayStats.countDocuments();

    const byPoints = await getStats("skip=1&limit=1");
    expect(byPoints.status).toBe(200);
    const pointsBody = (await byPoints.json()) as StatsBody;
    expect(pointsBody.status).toBe("success");
    expect(pointsBody.data.total).toBe(total);
    expect(pointsBody.data.stats.map(row => row.userId)).toEqual([
      `${prefix}-c`,
    ]);

    const byKills = (await (
      await getStats("sort=kills&limit=2")
    ).json()) as StatsBody;
    expect(byKills.data.stats.map(row => row.userId)).toEqual([
      `${prefix}-a`,
      `${prefix}-c`,
    ]);
  });

  it("GET /api/v1/stats?name= filters by user name", async () => {
    const { default: PlayStats } = await import("@db/models/PlayStats");
    const prefix = uniqueName("named");
    await PlayStats.create([
      { userId: `${prefix}-1`, userName: `${prefix}-Alice` },
      { userId: `${prefix}-2`, userName: `${prefix}-alicia` },
      { userId: `${prefix}-3`, userName: `${prefix}-Bob` },
    ]);

    const response = await getStats(`name=${prefix}-ALI&limit=10`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as StatsBody;
    expect(body.data.total).toBe(2);
    expect(body.data.stats.map(row => row.userId).sort()).toEqual([
      `${prefix}-1`,
      `${prefix}-2`,
    ]);
  });

  it("GET /api/v1/stats?name= matches regex characters literally", async () => {
    const { default: PlayStats } = await import("@db/models/PlayStats");
    const prefix = uniqueName("literal");
    await PlayStats.create([
      { userId: `${prefix}-dot`, userName: `${prefix}-a.c` },
      { userId: `${prefix}-abc`, userName: `${prefix}-abc` },
    ]);

    const dot = await getStats(`name=${encodeURIComponent(`${prefix}-a.c`)}`);
    expect(dot.status).toBe(200);
    const dotBody = (await dot.json()) as StatsBody;
    expect(dotBody.data.stats.map(row => row.userId)).toEqual([
      `${prefix}-dot`,
    ]);

    const paren = await getStats(`name=${encodeURIComponent("(")}`);
    expect(paren.status).toBe(200);
    const parenBody = (await paren.json()) as StatsBody;
    expect(parenBody.data).toEqual({ stats: [], total: 0 });
  });

  it("GET /api/v1/stats?name= orders the matches by user name", async () => {
    const { default: PlayStats } = await import("@db/models/PlayStats");
    const prefix = uniqueName("ordered");
    await PlayStats.create([
      { userId: `${prefix}-c`, userName: `${prefix}-c` },
      { userId: `${prefix}-a`, userName: `${prefix}-a` },
      { userId: `${prefix}-b`, userName: `${prefix}-b` },
    ]);

    const response = await getStats(`name=${prefix}&limit=10`);

    const body = (await response.json()) as StatsBody;
    expect(body.data.stats.map(row => row.userId)).toEqual([
      `${prefix}-a`,
      `${prefix}-b`,
      `${prefix}-c`,
    ]);
  });
});
