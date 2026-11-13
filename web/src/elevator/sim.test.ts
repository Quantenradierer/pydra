import { describe, expect, it } from 'vitest';
import { Building, FLOOR_TICKS, OVERRUN_TICKS, STOP_TICKS, type BuildingEvent } from './sim.ts';

/** Steps until `done` holds, collecting the events; fails after `max` ticks. */
function until(b: Building, done: (b: Building) => boolean, max = 1000): BuildingEvent[] {
  const events: BuildingEvent[] = [];
  for (let i = 0; i < max && !done(b); i++) events.push(...b.step());
  expect(done(b)).toBe(true);
  return events;
}

describe('the building', () => {
  it('starts with every car idle on floor 0', () => {
    const b = new Building({ floors: 3, cars: 2, spawns: [] });
    expect(b.begin()).toEqual([
      { kind: 'idle', car: 0 },
      { kind: 'idle', car: 1 },
    ]);
    expect(b.snapshot().cars.map((c) => [c.pos, c.state])).toEqual([
      [0, 'idle'],
      [0, 'idle'],
    ]);
  });

  it('drives one floor per second, stops 1.5 s, then is idle again', () => {
    const b = new Building({ floors: 3, cars: 1, spawns: [] });
    b.goToFloor(0, 2);
    const events = until(b, (x) => x.snapshot().cars[0]!.state === 'stopped');
    expect(events).toEqual([]);
    // One tick to set off, then two floors.
    expect(b.tick).toBe(1 + 2 * FLOOR_TICKS);
    expect(b.snapshot().cars[0]!.pos).toBe(2);
    expect(b.stats().moves).toBe(1);
    const later = until(b, (x) => x.snapshot().cars[0]!.state === 'idle');
    // The stop is over (a waiting program goes on), then the car has nothing to do.
    expect(later).toEqual([
      { kind: 'served', car: 0, floor: 2 },
      { kind: 'idle', car: 0 },
    ]);
    expect(b.tick).toBe(1 + 2 * FLOOR_TICKS + STOP_TICKS);
  });

  it('does not put a floor on the list twice', () => {
    const b = new Building({ floors: 3, cars: 1, spawns: [] });
    b.goToFloor(0, 1);
    b.goToFloor(0, 2);
    b.goToFloor(0, 1);
    expect(b.queueOf(0)).toEqual([1, 2]);
  });

  it('stops right where it is for its own floor, without a trip', () => {
    const b = new Building({ floors: 2, cars: 1, spawns: [{ tick: 1, from: 0, to: 1 }] });
    const first = b.step();
    expect(first).toEqual([{ kind: 'call', floor: 0 }]);
    b.goToFloor(0, 0);
    const events = b.step();
    expect(b.snapshot().cars[0]!.state).toBe('stopped');
    expect(b.stats().moves).toBe(0);
    // In, and the button for floor 1 lights up.
    expect(events).toEqual([{ kind: 'floor_button', car: 0, floor: 1 }]);
    expect(b.snapshot().cars[0]!.riders).toEqual([0]);
    expect(b.snapshot().calls).toEqual([false, false]);
  });

  it('lets riders out on their floor and counts how long they took', () => {
    const b = new Building({ floors: 2, cars: 1, spawns: [{ tick: 1, from: 0, to: 1 }] });
    b.step();
    b.goToFloor(0, 0);
    b.step();
    b.goToFloor(0, 1);
    until(b, (x) => x.stats().transported === 1);
    const s = b.stats();
    expect(s.moves).toBe(1);
    // Appeared at tick 1, out at tick 2 + 15 (doors) + 10 (one floor).
    expect(s.maxWait).toBeCloseTo((2 + STOP_TICKS + FLOOR_TICKS - 1) / 10);
    expect(s.avgWait).toBe(s.maxWait);
    expect(b.snapshot().cars[0]!.pressed).toEqual([]);
    expect(b.passengers[0]!.arrived).toBe(b.tick);
  });

  it('takes no more than fit; who is left presses the call button again', () => {
    const spawns = Array.from({ length: 5 }, () => ({ tick: 1, from: 1, to: 0 }));
    const b = new Building({ floors: 2, cars: 1, capacity: 4, spawns });
    expect(b.step()).toEqual([{ kind: 'call', floor: 1 }]);
    b.goToFloor(0, 1);
    const events = until(b, (x) => x.snapshot().cars[0]!.state === 'stopped');
    expect(b.snapshot().cars[0]!.riders).toHaveLength(4);
    expect(b.snapshot().waiting[1]).toHaveLength(1);
    expect(events).toEqual([
      { kind: 'floor_button', car: 0, floor: 0 },
      { kind: 'call', floor: 1 },
    ]);
  });

  it('takes people in at once who turn up while its doors are open', () => {
    const b = new Building({ floors: 2, cars: 1, spawns: [{ tick: 3, from: 0, to: 1 }] });
    b.goToFloor(0, 0);
    b.step();
    expect(b.snapshot().cars[0]!.state).toBe('stopped');
    b.step();
    const events = b.step();
    expect(events).toEqual([{ kind: 'floor_button', car: 0, floor: 1 }]);
    expect(b.snapshot().waiting[0]).toEqual([]);
  });

  it('is empty once everybody has arrived', () => {
    const b = new Building({ floors: 2, cars: 1, spawns: [{ tick: 1, from: 1, to: 0 }] });
    expect(b.empty).toBe(false);
    b.goToFloor(0, 1);
    b.goToFloor(0, 0);
    until(b, (x) => x.empty);
  });

  it('stops at a closed floor in front of the barrier: nobody gets in or out, but it costs the stop', () => {
    const b = new Building({ floors: 3, cars: 1, closed: [1], spawns: [] });
    b.goToFloor(0, 1);
    until(b, (x) => x.snapshot().cars[0]!.state === 'stopped');
    expect(b.snapshot().cars[0]).toMatchObject({ pos: 1, site: true });
    expect(b.stats().siteStops).toBe(1);
    const events = until(b, (x) => x.snapshot().cars[0]!.state === 'idle');
    expect(events).toEqual([
      { kind: 'served', car: 0, floor: 1 },
      { kind: 'idle', car: 0 },
    ]);
    expect(b.snapshot().cars[0]!.site).toBeUndefined();
  });

  it('drives past the top floor to a floor that does not exist and crashes through the roof', () => {
    const b = new Building({ floors: 2, cars: 1, spawns: [] });
    b.goToFloor(0, 7);
    const events = until(b, (x) => x.snapshot().cars[0]!.state === 'crashed');
    expect(events).toEqual([{ kind: 'crash', car: 0, floor: 7, where: 'roof' }]);
    expect(b.snapshot().cars[0]!.pos).toBeCloseTo(1 + (OVERRUN_TICKS + 1) / FLOOR_TICKS);
    // A crashed car never moves again.
    const pos = b.snapshot().cars[0]!.pos;
    b.step();
    expect(b.snapshot().cars[0]!.pos).toBe(pos);
  });

  it('crashes into the bottom of the shaft below floor 0', () => {
    const b = new Building({ floors: 2, cars: 1, spawns: [] });
    b.goToFloor(0, -1);
    expect(until(b, (x) => x.snapshot().cars[0]!.state === 'crashed')).toEqual([{ kind: 'crash', car: 0, floor: -1, where: 'pit' }]);
  });
});
