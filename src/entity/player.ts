import { POWER, INITIAL_POWER, STEP_POWER } from "../constants";
import { Spawn, SpawnOnGrid, Player as IPlayer } from "@types";
class Player {
  id: string;
  skin: string;
  name: string;
  spawn: Spawn;
  spawnOnGrid: SpawnOnGrid;
  isAlive: boolean;
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
    this.kills = [];
  }

  pickSpoil(spoil_type: number) {
    if (spoil_type === POWER) {
      this.power += STEP_POWER;
    }
  }

  kill(playerId: string) {
    this.kills.push(playerId);
  }

  dead() {
    this.isAlive = false;
  }

  top3() {
    this.isTop3 = true;
  }
}

export default Player;
