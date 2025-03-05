import {
  POWER,
  INITIAL_POWER,
  STEP_POWER,
  DELAY,
  INITIAL_DELAY,
  STEP_DELAY,
  MIN_DELAY,
  POINTS_PER_KILL,
  POINTS_PER_WIN,
  POINTS_PER_TOP3,
} from "../constants";
import { Spawn, SpawnOnGrid, Player as IPlayer } from "@types";
import { updatePlayerStats } from "@services/stats";
class Player {
  id: string;
  skin: string;
  name: string;
  spawn: Spawn;
  spawnOnGrid: SpawnOnGrid;
  isAlive: boolean;
  delay: number;
  power: number;
  isTop3: boolean;
  kills: string[];

  constructor({ id, skin, name, spawn, spawnOnGrid }: IPlayer) {
    this.id = id;
    this.skin = skin;
    this.name = name;
    this.spawn = spawn;
    this.spawnOnGrid = spawnOnGrid;

    this.isAlive = true;
    this.isTop3 = false;
    this.power = INITIAL_POWER;
    this.delay = INITIAL_DELAY;
    this.kills = [];
  }

  pickSpoil(spoil_type: number) {
    if (spoil_type === POWER) {
      this.power += STEP_POWER;
    }

    if (spoil_type === DELAY && this.delay > MIN_DELAY) {
      this.delay -= STEP_DELAY;
    }
  }

  kill(playerId: string) {
    if (this.id === playerId) return;
    this.kills.push(playerId);
  }

  dead() {
    this.isAlive = false;
  }

  top3() {
    this.isTop3 = true;
  }

  async processStats(isWin: boolean) {
    const pointsPerTop3 = this.isTop3 ? POINTS_PER_TOP3 : 0;
    const pointsPerWin = isWin ? POINTS_PER_WIN : 0;
    const points =
      this.kills.length * POINTS_PER_KILL + pointsPerTop3 + pointsPerWin;
    await updatePlayerStats({
      userId: this.id,
      points,
      isWin,
      kills: this.kills.length,
      isTop3: this.isTop3,
    });
  }
}

export default Player;
