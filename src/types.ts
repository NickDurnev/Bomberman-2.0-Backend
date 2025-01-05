import { Socket } from "socket.io";
import Play from "./play";

export type Coordinates = { x: number; y: number };
export type BombDetails = {
  col: number;
  row: number;
  playerId: string;
  gameId: string;
};
export type SpoilDetails = {
  spoil_id: string;
  playerId: string;
  gameId: string;
};
export type PlayerPositionData = Coordinates & {
  playerId: string;
  gameId: string;
};

export type Spawn = {
  x: number;
  y: number;
};

export type SpawnOnGrid = {
  row: number;
  col: number;
};

export type NewGamePayload = {
  mapName: string;
  gameName: string;
};

export type User = {
  name: string;
  email: string;
  socketID: string;
  locale: string;
  picture: string;
};

export type Player = {
  id: string;
  name: string;
  skin: string;
  spawn: Spawn;
  spawnOnGrid: SpawnOnGrid;
};

// Extend the Socket type to include `playInstance`
export interface CustomSocket extends Socket {
  customId?: string;
  playInstance?: Play;
  socket_game_id?: string | null;
}
