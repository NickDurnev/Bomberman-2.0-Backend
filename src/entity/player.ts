import { POWER, INITIAL_POWER, STEP_POWER } from "../constants";

interface Spawn {
  x: number;
  y: number;
}

interface SpawnOnGrid {
  row: number;
  col: number;
}

class Player {
  id: string;
  skin: string;
  spawn: Spawn;
  spawnOnGrid: SpawnOnGrid;
  isAlive: boolean;
  power: number;

  constructor({
    id,
    skin,
    spawn,
    spawnOnGrid,
  }: {
    id: string;
    skin: string;
    spawn: Spawn;
    spawnOnGrid: SpawnOnGrid;
  }) {
    this.id = id;
    this.skin = skin;
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
