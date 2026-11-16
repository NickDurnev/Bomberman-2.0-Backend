import { describe, expect, it } from "vitest";
import { Game } from "@/entity/game";
import Player from "@/entity/player";

function newGame(): Game {
  return new Game({
    mapName: "small_map",
    gameName: "game-unit",
    isPortalsEnabled: false,
    isDelaySpoilEnabled: false,
  });
}

function addPlayers(game: Game, count: number) {
  for (let i = 0; i < count; i++) {
    game.players.push(
      new Player({
        id: `p${i}`,
        skin: "",
        name: `P${i}`,
        spawn: { x: 0, y: 0 },
        spawnOnGrid: { row: 1, col: 1 },
      } as ConstructorParameters<typeof Player>[0]),
    );
  }
}

describe("Game.markTop3", () => {
  it("marks only the players still alive", () => {
    const game = newGame();
    addPlayers(game, 4);
    game.players[0].dead();
    game.markTop3();

    expect(game.players.map(player => player.isTop3)).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });
});
