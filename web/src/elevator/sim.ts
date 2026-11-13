/**
 * The building of Hydra Lift (pure, deterministic): floors, elevator cars with
 * a list of floors to go to, passengers who appear on a floor and want to go
 * to another, and the buttons they press. Time runs in ticks of 0.1 s.
 *
 * Rules, kept simple for beginners (docs/elevator.md, "The building"):
 * - A car drives to the first floor of its list at one floor per second, stops,
 *   opens its doors for 1.5 s: riders for this floor get out, people waiting
 *   here get in (as many as fit), then it goes on to the next floor of the list.
 * - Everybody gets in, whichever way the car goes next.
 * - A car with an empty list stands still with closed doors: it is idle.
 * - `goToFloor` adds a floor to the end of the list; a floor that is already in
 *   the list is not added twice.
 * - A closed floor (a building site): a car stops there in front of barrier
 *   tape, nobody gets in or out.
 * - A floor that does not exist: the car drives past the top floor through the
 *   roof (or past floor 0 into the bottom of the shaft) and crashes. A crashed
 *   car never moves again (the runner ends the run).
 *
 * The simulation only reports events (`idle`, `floor_button`, `call`); the
 * runner turns them into calls of the learner's handlers.
 */

export const TICKS_PER_SECOND = 10;
/** Ticks a car needs from one floor to the next. */
export const FLOOR_TICKS = 10;
/** Ticks the doors stay open at a stop. */
export const STOP_TICKS = 15;
export const DEFAULT_CAPACITY = 4;
/** How far (in ticks of travel) past the top floor the roof is, and past floor 0 the bottom of the shaft. */
export const OVERRUN_TICKS = 6;

/** Someone who appears on floor `from` at `tick` and wants to go to `to`. */
export interface Spawn {
  tick: number;
  from: number;
  to: number;
}

export interface Passenger extends Spawn {
  id: number;
  /** The tick they got out on their floor. */
  arrived?: number;
}

export type CarState = 'idle' | 'moving' | 'stopped' | 'crashed';

export interface CarSnapshot {
  /** Height in floors (2.5 = half way between floor 2 and 3). */
  pos: number;
  state: CarState;
  /** Where the car drives next (its list), the first one first. */
  queue: number[];
  /** Passenger ids inside. */
  riders: number[];
  /** The floor buttons that are lit inside, sorted. */
  pressed: number[];
  /** Driving up (1), down (-1) or not (0). */
  dir: -1 | 0 | 1;
  /** Stopped at a closed floor (the building site). */
  site?: boolean;
}

export interface Stats {
  transported: number;
  /** Seconds since the start. */
  elapsed: number;
  /** Seconds from appearing to getting out, the mean over everybody who got out (0 when nobody did). */
  avgWait: number;
  /** ... and the longest. */
  maxWait: number;
  /** Trips: every time a car starts driving to another floor. */
  moves: number;
  /** Stops at a closed floor. */
  siteStops: number;
}

export interface BuildingSnapshot {
  tick: number;
  cars: CarSnapshot[];
  /** Passenger ids waiting on each floor, first come first. */
  waiting: number[][];
  /** The call button of each floor is lit. */
  calls: boolean[];
  stats: Stats;
}

export type BuildingEvent =
  /** A car has nothing to do any more (also once for every car at the start). */
  | { kind: 'idle'; car: number }
  /** Someone got into `car` and pressed the button for `floor`. */
  | { kind: 'floor_button'; car: number; floor: number }
  /** Someone on `floor` pressed the call button. */
  | { kind: 'call'; floor: number }
  /** `car` finished its stop at `floor` (its doors close); comes before an `idle` of the same tick. */
  | { kind: 'served'; car: number; floor: number }
  /** `car` drove towards `floor`, which does not exist, and crashed through the roof or into the bottom of the shaft. */
  | { kind: 'crash'; car: number; floor: number; where: 'roof' | 'pit' };

export interface BuildingConfig {
  floors: number;
  cars: number;
  capacity?: number;
  /** Closed floors (building sites). */
  closed?: readonly number[];
  /** Everybody who will appear, sorted by tick. */
  spawns: readonly Spawn[];
}

interface Car {
  /** Height in ticks (floor * FLOOR_TICKS). */
  pos: number;
  state: CarState;
  timer: number;
  queue: number[];
  riders: number[];
  pressed: Set<number>;
  dir: -1 | 0 | 1;
  site: boolean;
}

export class Building {
  readonly floors: number;
  readonly capacity: number;
  tick = 0;
  readonly passengers: Passenger[] = [];
  private cars: Car[];
  private waiting: number[][];
  private calls: boolean[];
  private next = 0;
  private moves = 0;
  private transported = 0;
  private waitSum = 0;
  private maxWait = 0;
  private siteStops = 0;
  private closed: ReadonlySet<number>;

  constructor(private config: BuildingConfig) {
    this.floors = config.floors;
    this.capacity = config.capacity ?? DEFAULT_CAPACITY;
    this.cars = Array.from({ length: config.cars }, () => ({ pos: 0, state: 'idle' as CarState, timer: 0, queue: [], riders: [], pressed: new Set<number>(), dir: 0 as const, site: false }));
    this.closed = new Set(config.closed ?? []);
    this.waiting = Array.from({ length: config.floors }, () => []);
    this.calls = Array.from({ length: config.floors }, () => false);
  }

  get carCount(): number {
    return this.cars.length;
  }

  /** The events at the start: every car is idle. */
  begin(): BuildingEvent[] {
    return this.cars.map((_, car) => ({ kind: 'idle', car }));
  }

  /** The floor a car is at, or the nearest one while it drives. */
  currentFloor(car: number): number {
    return Math.round(this.cars[car]!.pos / FLOOR_TICKS);
  }

  /** The car stands still with an empty list (not crashed). */
  isIdle(car: number): boolean {
    const c = this.cars[car]!;
    return c.state === 'idle' && c.queue.length === 0;
  }

  /** How many people wait on `floor` (0 for a floor that does not exist). */
  waitingAt(floor: number): number {
    return this.waiting[floor]?.length ?? 0;
  }

  pressedFloors(car: number): number[] {
    return [...this.cars[car]!.pressed].sort((a, b) => a - b);
  }

  queueOf(car: number): number[] {
    return [...this.cars[car]!.queue];
  }

  /** Adds `floor` to the end of the car's list, unless it is in the list already. Any whole number: one that is no floor crashes the car in its turn. */
  goToFloor(car: number, floor: number) {
    const c = this.cars[car]!;
    if (!c.queue.includes(floor)) c.queue.push(floor);
  }

  /** Everybody has appeared and nobody waits or rides any more. */
  get empty(): boolean {
    return this.next >= this.config.spawns.length && this.waiting.every((w) => w.length === 0) && this.cars.every((c) => c.riders.length === 0);
  }

  /** Advances 0.1 s and returns what happened, in order. */
  step(): BuildingEvent[] {
    const events: BuildingEvent[] = [];
    this.tick++;
    // People appear (on the tick they are planned for).
    while (this.next < this.config.spawns.length && this.config.spawns[this.next]!.tick <= this.tick) {
      const s = this.config.spawns[this.next]!;
      const p: Passenger = { id: this.passengers.length, tick: s.tick, from: s.from, to: s.to };
      this.passengers.push(p);
      this.next++;
      // A car standing here with open doors takes them at once.
      const open = this.cars.findIndex((c) => c.state === 'stopped' && !c.site && c.pos === s.from * FLOOR_TICKS && c.riders.length < this.capacity);
      if (open >= 0) this.board(open, p, events);
      else {
        this.waiting[s.from]!.push(p.id);
        this.press(s.from, events);
      }
    }
    this.cars.forEach((c, i) => {
      if (c.state === 'crashed') return;
      if (c.state === 'stopped') {
        if (--c.timer > 0) return;
        events.push({ kind: 'served', car: i, floor: Math.round(c.pos / FLOOR_TICKS) });
        if (c.queue.length === 0) {
          c.state = 'idle';
          events.push({ kind: 'idle', car: i });
          return;
        }
        this.depart(i, events);
      } else if (c.state === 'idle') {
        if (c.queue.length > 0) this.depart(i, events);
      } else {
        c.pos += c.dir;
        if (c.pos === c.queue[0]! * FLOOR_TICKS) this.arrive(i, events);
        else if (c.pos > (this.floors - 1) * FLOOR_TICKS + OVERRUN_TICKS || c.pos < -OVERRUN_TICKS) {
          c.state = 'crashed';
          events.push({ kind: 'crash', car: i, floor: c.queue[0]!, where: c.dir > 0 ? 'roof' : 'pit' });
          c.dir = 0;
        }
      }
    });
    return events;
  }

  private press(floor: number, events: BuildingEvent[]) {
    if (this.calls[floor]) return;
    this.calls[floor] = true;
    events.push({ kind: 'call', floor });
  }

  /** Starts towards the first floor of the list, or stops right here if that is this floor. */
  private depart(i: number, events: BuildingEvent[]) {
    const c = this.cars[i]!;
    c.site = false;
    const target = c.queue[0]! * FLOOR_TICKS;
    if (target === c.pos) return this.arrive(i, events);
    c.state = 'moving';
    c.dir = target > c.pos ? 1 : -1;
    this.moves++;
  }

  private board(i: number, p: Passenger, events: BuildingEvent[]) {
    const c = this.cars[i]!;
    c.riders.push(p.id);
    if (!c.pressed.has(p.to)) {
      c.pressed.add(p.to);
      events.push({ kind: 'floor_button', car: i, floor: p.to });
    }
  }

  /** The car stops at the first floor of its list: out, in, doors open for STOP_TICKS. */
  private arrive(i: number, events: BuildingEvent[]) {
    const c = this.cars[i]!;
    const floor = c.queue.shift()!;
    c.state = 'stopped';
    c.dir = 0;
    c.timer = STOP_TICKS;
    c.site = this.closed.has(floor);
    if (c.site) {
      // The building site: barrier tape, nobody gets in or out.
      this.siteStops++;
      return;
    }
    c.pressed.delete(floor);
    c.riders = c.riders.filter((id) => {
      const p = this.passengers[id]!;
      if (p.to !== floor) return true;
      p.arrived = this.tick;
      const wait = (this.tick - p.tick) / TICKS_PER_SECOND;
      this.transported++;
      this.waitSum += wait;
      this.maxWait = Math.max(this.maxWait, wait);
      return false;
    });
    const queue = this.waiting[floor]!;
    while (queue.length > 0 && c.riders.length < this.capacity) this.board(i, this.passengers[queue.shift()!]!, events);
    // The call button goes out; whoever could not get in presses it again.
    this.calls[floor] = false;
    if (queue.length > 0) this.press(floor, events);
  }

  /** Crashes cars (a Python error in the code that runs them). */
  crash(cars: readonly number[]) {
    for (const i of cars) {
      const c = this.cars[i]!;
      c.state = 'crashed';
      c.dir = 0;
    }
  }

  stats(): Stats {
    return {
      transported: this.transported,
      elapsed: this.tick / TICKS_PER_SECOND,
      avgWait: this.transported === 0 ? 0 : this.waitSum / this.transported,
      maxWait: this.maxWait,
      moves: this.moves,
      siteStops: this.siteStops,
    };
  }

  snapshot(): BuildingSnapshot {
    return {
      tick: this.tick,
      cars: this.cars.map((c) => ({ pos: c.pos / FLOOR_TICKS, state: c.state, queue: [...c.queue], riders: [...c.riders], pressed: [...c.pressed].sort((a, b) => a - b), dir: c.dir, ...(c.site && c.state === 'stopped' ? { site: true } : {}) })),
      waiting: this.waiting.map((w) => [...w]),
      calls: [...this.calls],
      stats: this.stats(),
    };
  }
}
