import { describe, expect, it } from "vitest";

import {
  BOMBS,
  DELAY,
  INITIAL_DELAY,
  INITIAL_POWER,
  MIN_DELAY,
  POWER,
  SPEED,
  STEP_DELAY,
  STEP_POWER,
} from "@constants";
import Player from "@entity/player";

function newPlayer() {
  return new Player({
    id: "p1",
    skin: "",
    name: "P1",
    spawn: { x: 0, y: 0 },
    spawnOnGrid: { row: 1, col: 1 },
  } as ConstructorParameters<typeof Player>[0]);
}

describe("Player", () => {
  it("POWER adds STEP_POWER", () => {
    const player = newPlayer();
    player.pickSpoil(POWER);
    expect(player.power).toBe(INITIAL_POWER + STEP_POWER);
  });

  it("DELAY lowers the fuse by STEP_DELAY down to MIN_DELAY", () => {
    const player = newPlayer();
    player.pickSpoil(DELAY);
    expect(player.delay).toBe(INITIAL_DELAY - STEP_DELAY);
    for (let i = 0; i < 30; i++) {
      player.pickSpoil(DELAY);
    }
    expect(player.delay).toBe(MIN_DELAY);
  });

  it("SPEED and BOMBS do not change power or delay on the server", () => {
    const player = newPlayer();
    player.pickSpoil(SPEED);
    player.pickSpoil(BOMBS);
    expect(player.power).toBe(INITIAL_POWER);
    expect(player.delay).toBe(INITIAL_DELAY);
  });

  it("kill ignores the player's own id", () => {
    const player = newPlayer();
    player.kill("p1");
    expect(player.kills).toEqual([]);
  });

  it("kill records another player", () => {
    const player = newPlayer();
    player.kill("p2");
    expect(player.kills).toEqual(["p2"]);
  });
});
