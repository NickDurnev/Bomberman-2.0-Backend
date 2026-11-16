import { describe, expect, it } from "vitest";
import { DELETE_PENDING_GAMES_INTERVAL, GAME_DURATION } from "@/constants";
import { Game } from "@/entity/game";
import Player from "@/entity/player";
import { cleanupRunningGames } from "@/play";

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

describe("cleanupRunningGames", () => {
  it("removes an empty game older than the match length", () => {
    const game = newGame();
    const games = new Map([[game.id, game]]);
    cleanupRunningGames(games, game.createdAt + GAME_DURATION * 1000);

    expect(games.has(game.id)).toBe(false);
  });

  it("keeps a game with players until the stale interval", () => {
    const game = newGame();
    addPlayers(game, 2);
    const games = new Map([[game.id, game]]);
    cleanupRunningGames(games, game.createdAt + GAME_DURATION * 1000);
    expect(games.has(game.id)).toBe(true);

    cleanupRunningGames(
      games,
      game.createdAt + DELETE_PENDING_GAMES_INTERVAL * 1000,
    );
    expect(games.has(game.id)).toBe(false);
  });
});
