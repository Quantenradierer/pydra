/**
 * The block of the Hydra Works factory as a pure simulation: a belt in the west,
 * a grabber in the middle, the coal bunker in the north and the smelter in the
 * east (with its ore heap, the coal heap fed by the bunker's chute, and the
 * plate stack). No Python here: `run.ts` turns the learner's calls into `act()`.
 *
 * Two rules for a command that does not fit (docs/factory.md):
 * - wasted motion is harmless: it is shown, nothing else happens (`idle`);
 * - wrong or missing material is an error: the run stops, nothing changes.
 */

export type Item = 'ore' | 'coal';

/** Where the grabber faces: west = belt, north = coal bunker, east = smelter's ore hatch, south = floor. */
export type Facing = 'W' | 'N' | 'E' | 'S';
const CLOCKWISE: Record<Facing, Facing> = { W: 'N', N: 'E', E: 'S', S: 'W' };

/** What lies on each side of the grabber. */
export type Place = 'belt' | 'bunker' | 'ore-hatch' | 'floor';
export const PLACE_AT: Record<Facing, Place> = { W: 'belt', N: 'bunker', E: 'ore-hatch', S: 'floor' };

/** An item with an identity, so a viewer can follow it from the belt into a heap. */
export interface BeltItem {
  id: number;
  kind: Item;
}

/** The commands that move a machine (each is one visible movement, one frame). `is_coal()` is a question, not a command. */
export type Command = 'grab' | 'turn' | 'drop' | 'smelt';

/** The five given words of the first layer. In the block lessons only "Your machines" may use them. */
export const MACHINE_WORDS = ['grab', 'turn', 'drop', 'is_coal', 'smelt'] as const;
export type MachineWord = (typeof MACHINE_WORDS)[number];

/** Iron ore and coal a plate needs. */
export const ORE_PER_PLATE = 2;
export const COAL_PER_PLATE = 1;

/** Everything a viewer needs to draw the block at one moment. Plain data, JSON safe. */
export interface WorldSnapshot {
  /** Front first. In the smelter lessons: the items the grey factory grabber has not delivered yet. */
  belt: BeltItem[];
  facing: Facing;
  holding: BeltItem | null;
  /** The smelter's ore heap (the label `ore`). */
  ore: number;
  /** The coal heap under the bunker's chute (the label `coal`). */
  coal: number;
  plates: number;
}

/** Harmless wasted motion: shown, nothing else happens. */
export type IdleReason =
  /** grab() while not facing the belt. */
  | 'not-facing-belt'
  /** grab() at the belt, but the belt is empty. */
  | 'belt-empty'
  /** grab() while already holding something. */
  | 'hand-full'
  /** drop() with an empty hand. */
  | 'hand-empty';

/** Wrong or missing material: the run stops here. */
export type WorldErrorCode = 'coal-in-ore-hatch' | 'ore-in-bunker' | 'nothing-there' | 'need-ore' | 'need-coal';

export type ActResult =
  /** The command did its work. `item` / `place`: what was grabbed or dropped, and where to. */
  | { ok: true; idle?: undefined; item?: Item; place?: Place }
  | { ok: true; idle: IdleReason }
  /** `params`: need-ore / need-coal `{ need, have }`, nothing-there `{ place }`. */
  | { ok: false; code: WorldErrorCode; params: Record<string, string | number> };

export interface WorldStart {
  belt?: readonly Item[];
  ore?: number;
  coal?: number;
}

export class World {
  belt: BeltItem[];
  facing: Facing = 'W';
  holding: BeltItem | null = null;
  ore: number;
  coal: number;
  plates = 0;

  constructor(start: WorldStart = {}) {
    this.belt = (start.belt ?? []).map((kind, i) => ({ id: i + 1, kind }));
    this.ore = start.ore ?? 0;
    this.coal = start.coal ?? 0;
  }

  /** The place the grabber faces. */
  get facingPlace(): Place {
    return PLACE_AT[this.facing];
  }

  /** `is_coal()`: True only while the grabber holds coal. */
  isCoal(): boolean {
    return this.holding?.kind === 'coal';
  }

  act(command: Command): ActResult {
    switch (command) {
      case 'grab':
        return this.grab();
      case 'turn':
        this.facing = CLOCKWISE[this.facing];
        return { ok: true };
      case 'drop':
        return this.drop();
      case 'smelt':
        return this.smelt();
    }
  }

  private grab(): ActResult {
    if (this.holding) return { ok: true, idle: 'hand-full' };
    if (this.facing !== 'W') return { ok: true, idle: 'not-facing-belt' };
    const item = this.belt.shift();
    if (!item) return { ok: true, idle: 'belt-empty' };
    this.holding = item;
    return { ok: true, item: item.kind, place: 'belt' };
  }

  private drop(): ActResult {
    const item = this.holding;
    if (!item) return { ok: true, idle: 'hand-empty' };
    const place = this.facingPlace;
    if (place === 'ore-hatch') {
      if (item.kind !== 'ore') return { ok: false, code: 'coal-in-ore-hatch', params: {} };
      this.ore++;
    } else if (place === 'bunker') {
      if (item.kind !== 'coal') return { ok: false, code: 'ore-in-bunker', params: {} };
      this.coal++;
    } else {
      return { ok: false, code: 'nothing-there', params: { place } };
    }
    this.holding = null;
    return { ok: true, item: item.kind, place };
  }

  private smelt(): ActResult {
    if (this.ore < ORE_PER_PLATE) return { ok: false, code: 'need-ore', params: { need: ORE_PER_PLATE, have: this.ore } };
    if (this.coal < COAL_PER_PLATE) return { ok: false, code: 'need-coal', params: { need: COAL_PER_PLATE, have: this.coal } };
    this.ore -= ORE_PER_PLATE;
    this.coal -= COAL_PER_PLATE;
    this.plates++;
    return { ok: true };
  }

  /** The grey factory grabber of the smelter lessons: the next item from the belt lands on its heap. */
  land(): BeltItem | undefined {
    const item = this.belt.shift();
    if (item?.kind === 'ore') this.ore++;
    if (item?.kind === 'coal') this.coal++;
    return item;
  }

  snapshot(): WorldSnapshot {
    return {
      belt: this.belt.map((b) => ({ ...b })),
      facing: this.facing,
      holding: this.holding ? { ...this.holding } : null,
      ore: this.ore,
      coal: this.coal,
      plates: this.plates,
    };
  }
}
