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
