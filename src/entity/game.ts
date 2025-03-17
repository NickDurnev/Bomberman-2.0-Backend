import { v4 as uuidv4 } from "uuid";
import { getUserBySocketId } from "@services/socket";
import { User, NewGamePayload } from "@types";
import {
  TILE_SIZE,
  EMPTY_CELL,
  DESTRUCTIBLE_CELL,
  NON_DESTRUCTIBLE_CELL,
} from "../constants";
import Player from "./player";
import { Bomb } from "./bomb";
import { Spoil } from "./spoil";
import { Portal } from "./portal";

// Assuming the type structure of `layer_info` from the map JSON file
interface LayerInfo {
  data: number[];
  width: number;
  height: number;
  properties: {
    max_players: number;
    empty: number;
    wall: number;
    box: number;
    spawns: { row: number; col: number }[];
  };
}

export class Game {
  id: string;
  name: string;
  mapName: string;
  isPortalsEnabled: boolean;
  isDelaySpoilEnabled: boolean;
  layer_info: LayerInfo;
  max_players: number;
  players: Player[];
  playerSpawns: { row: number; col: number }[];
  shadow_map: number[][];
  spoils: Map<string, Spoil>;
  bombs: Map<string, Bomb>;
  portals: Map<string, Portal>;
  tombstones: Map<string, { row: number; col: number }>;
  createdAt: number;

  constructor({
    mapName,
    gameName,
    isPortalsEnabled,
    isDelaySpoilEnabled,
  }: NewGamePayload) {
    this.id = uuidv4();
    this.name = gameName;
    this.mapName = mapName;
    this.isPortalsEnabled = isPortalsEnabled;
    this.isDelaySpoilEnabled = isDelaySpoilEnabled;
    this.layer_info = require(`../maps/${this.mapName}.json`)
      .layers[0] as LayerInfo;
    this.max_players = this.layer_info.properties.max_players;
    this.players = [];
    this.playerSpawns = [...this.layer_info.properties.spawns];
    this.shadow_map = this.createMapData();
    this.spoils = new Map();
    this.bombs = new Map();
    this.portals = new Map();
    this.tombstones = new Map();
    this.createdAt = Date.now();
  }

  async addPlayer(id: string) {
    const user = await this.getUserInfo(id);

    const existPlayer = this.players.find(
      (player) => player.name === user?.name && player.skin === user?.picture
    );

    if (existPlayer) {
      this.playerSpawns.push(existPlayer.spawnOnGrid);
      this.players.splice(this.players.indexOf(existPlayer), 1);
    }

    const [spawn, spawnOnGrid] = this.getAndRemoveSpawn();
    const player = new Player({
      id,
      skin: user?.picture || "",
      name: user?.name || "",
      spawn,
      spawnOnGrid,
    });
    this.players.push(player);
  }

  async processGameStats(winnerId: string | null = null) {
    for (const player of this.players) {
      const isWin = player.id === winnerId;
      await player.processStats(isWin);
    }
  }

  removePlayer(id: string) {
    const player = this.players.find((player) => player.id === id);
    if (player) {
      this.playerSpawns.push(player.spawnOnGrid);
      this.players.splice(this.players.indexOf(player), 1);
    }
  }

  isEmpty(): boolean {
    return this.players.length === 0;
  }

  isFull(): boolean {
    return this.players.length === this.max_players;
  }

  private async getUserInfo(id: string): Promise<User> {
    const user = await getUserBySocketId(id);
    return user;
  }

  private getAndRemoveSpawn(): [
    { x: number; y: number },
    { row: number; col: number }
  ] {
    const index = Math.floor(Math.random() * this.playerSpawns.length);
    const spawnOnGrid = this.playerSpawns[index];
    this.playerSpawns.splice(index, 1);
    const spawn = {
      x: spawnOnGrid?.col * TILE_SIZE,
      y: spawnOnGrid?.row * TILE_SIZE,
    };
    return [spawn, spawnOnGrid];
  }

  private createMapData(): number[][] {
    const {
      data: tiles,
      width,
      height,
      properties: { empty, wall, box },
    } = this.layer_info;
    const mapMatrix: number[][] = [];
    let i = 0;

    for (let row = 0; row < height; row++) {
      mapMatrix.push([]);
      for (let col = 0; col < width; col++) {
        mapMatrix[row][col] = EMPTY_CELL;
        if (tiles[i] === box) {
          mapMatrix[row][col] = DESTRUCTIBLE_CELL;
        } else if (tiles[i] === wall) {
          mapMatrix[row][col] = NON_DESTRUCTIBLE_CELL;
        }
        i++;
      }
    }
    return mapMatrix;
  }

  addBomb({
    col,
    row,
    power,
    delay,
  }: {
    col: number;
    row: number;
    power: number;
    delay: number;
  }): Bomb | false {
    const bomb = new Bomb({ game: this, col, row, power, delay });
    if (this.bombs.has(bomb.id)) return false;
    this.bombs.set(bomb.id, bomb);
    return bomb;
  }

  getMapCell(row: number, col: number): number {
    return this.shadow_map[row][col];
  }

  nullifyMapCell(row: number, col: number) {
    this.shadow_map[row][col] = EMPTY_CELL;
  }

  findSpoil(spoil_id: string) {
    return this.spoils.get(spoil_id);
  }

  findPortal(portal_id: string) {
    return this.portals.get(portal_id);
  }

  getPortals() {
    return this.portals;
  }

  addSpoil(spoil: any) {
    this.spoils.set(spoil.id, spoil);
  }

  addPortal(portal: any) {
    this.portals.set(portal.id, portal);
  }

  addTombStone({
    tombId,
    row,
    col,
  }: {
    tombId: string;
    row: number;
    col: number;
  }) {
    this.tombstones.set(tombId, { row, col });
  }

  deleteSpoil(spoil_id: string) {
    this.spoils.delete(spoil_id);
  }

  deleteBomb(bomb_id: string) {
    this.bombs.delete(bomb_id);
  }
}
