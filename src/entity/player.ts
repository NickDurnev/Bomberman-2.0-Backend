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

  constructor({ id, skin, name, spawn, spawnOnGrid }: IPlayer) {
    this.id = id;
    this.skin = skin;
    this.name = name;
    this.spawn = spawn;
    this.spawnOnGrid = spawnOnGrid;

    this.isAlive = true;
    this.power = INITIAL_POWER;
  }

  pickSpoil(spoil_type: number) {
    if (spoil_type === POWER) {
      this.power += STEP_POWER;
    }
  }

  dead() {
    this.isAlive = false;
  }
}

export default Player;
