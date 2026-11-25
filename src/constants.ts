export const TILE_SIZE = 35;

export const SPOIL_CHANCE = 50;
export const SPEED = 0;
export const POWER = 1;
export const BOMBS = 2;
export const DELAY = 3;

export const EMPTY_CELL = 6;
export const DESTRUCTIBLE_CELL = 5;
export const NON_DESTRUCTIBLE_CELL = 1;

export const INITIAL_POWER = 1;
export const STEP_POWER = 1;

export const INITIAL_DELAY = 2000;
export const STEP_DELAY = 200;
export const MIN_DELAY = 200;

export const LOBBY_TIMEOUT = 180; // 3 minutes

export const GAME_DURATION = 180; // 3 minutes

export const DELETE_PENDING_GAMES_INTERVAL = 3600; // 1 hour

export const POINTS_PER_KILL = 1;
export const POINTS_PER_WIN = 3;
export const POINTS_PER_TOP3 = 1;

export const SMALL_MAP_PORTAL_SPAWNS = [
  { row: 3, col: 3 },
  { row: 15, col: 3 },
  { row: 3, col: 28 },
  { row: 15, col: 28 },
];

export const DEFAULT_MAP_PORTAL_SPAWNS = [
  { row: 1, col: 1 },
  { row: 19, col: 1 },
  { row: 1, col: 30 },
  { row: 19, col: 30 },
];

// Real (row, col) of each cell, no spawn offset. Each is a box in the map.
export const ARENA_MAP_PORTAL_SPAWNS = [
  { row: 1, col: 1 },
  { row: 1, col: 25 },
  { row: 15, col: 2 },
  { row: 16, col: 26 },
];

// Real (row, col) of each cell, no spawn offset. Each is a box in the map.
export const BIG_MAP_PORTAL_SPAWNS = [
  { row: 1, col: 1 },
  { row: 1, col: 38 },
  { row: 21, col: 1 },
  { row: 21, col: 38 },
];

const PORTAL_SPAWNS_BY_MAP: Record<string, { row: number; col: number }[]> = {
  default_map: DEFAULT_MAP_PORTAL_SPAWNS,
  arena_map: ARENA_MAP_PORTAL_SPAWNS,
  small_map: SMALL_MAP_PORTAL_SPAWNS,
  big_map: BIG_MAP_PORTAL_SPAWNS,
};

// Portal cells of a map; an unknown map uses the default_map cells.
export function portalSpawnsFor(mapName: string) {
  return PORTAL_SPAWNS_BY_MAP[mapName] ?? DEFAULT_MAP_PORTAL_SPAWNS;
}

// Texture pack ids. Keep equal to TEXTURE_PACKS in the client
// (Bomberman-2.0 src/utils/texturePacks.ts).
export const TEXTURE_PACKS = ["default", "classic"];
export const DEFAULT_TEXTURE_PACK = "default";

// The texture pack of a room; a missing or unknown pack uses the default pack.
export function toTexturePack(value: unknown): string {
  return typeof value === "string" && TEXTURE_PACKS.includes(value)
    ? value
    : DEFAULT_TEXTURE_PACK;
}

export const NO_KILL_PHRASES = [
  "I just tried to survive 🏃‍♂️",
  "Just pacifist mode ☮️",
  "I was busy looting 📦",
  "Stealth is my playstyle 🕵️‍♂️",
  "They all ran away from me! 😭",
  "I spared them... for now 😈",
  "Violence isn't always the answer 🤷‍♂️",
  "I let my teammates handle it 💪",
  "My aim is... a work in progress 🎯",
];
