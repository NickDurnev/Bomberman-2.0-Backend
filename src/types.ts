import { Socket } from "socket.io";
import Play from "./play";

type PlayerId = string;
type GameId = string;

type GameAndPlayer = {
  gameId: GameId;
  playerId: PlayerId;
};

export type Coordinates = { x: number; y: number };

export interface UserDetails extends GameAndPlayer {
  col: number;
  row: number;
  killerId?: string;
}

export interface PortalDetails extends GameAndPlayer {
  portal_id: string;
}

export interface SpoilDetails extends GameAndPlayer {
  spoil_id: string;
}

export interface BombDetails extends GameAndPlayer {
  bomb_id: string;
}

export type PlayerPositionData = GameAndPlayer & Coordinates;

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
  isPortalsEnabled: boolean;
  isDelaySpoilEnabled: boolean;
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

export interface CustomSocket extends Socket {
  customId?: string;
  playInstance?: Play;
  socket_game_id?: string | null;
}

export interface CustomError extends Error {
  status?: number;
}
