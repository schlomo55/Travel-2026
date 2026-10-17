/* The traveller's walk / taxi / metro choice per leg (demo). Shared by the
   Day view and the Map tab so a leg reads the same on both; kept for the
   session only — nothing is written to the vault. */
import { legKey, nextMode, type Leg, type LegMode } from '../logic/dayroute';

class LegModes {
  chosen = $state<Record<string, LegMode>>({});

  /** Switch a leg to the next mode (walk → taxi → metro → walk). */
  cycle(leg: Leg): void {
    this.chosen = { ...this.chosen, [legKey(leg.fromId, leg.toId)]: nextMode(leg.mode) };
  }
}

export const legModes = new LegModes();
