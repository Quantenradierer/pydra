/**
 * Parts as host objects. A robot's build decides which Python names exist:
 * wheels add forward(), the blaster adds fire() and the `blaster` object, and
 * so on. Action methods return a list of steps (one per tick) that pauses the
 * script; status methods answer at once. Using an action that is not charged
 * costs the tick but does not crash.
 */
import { addonsFor, CHASSIS, type Build, type GearId } from './build.ts';
import { DIRS, opposite, step as stepPos, turnLeft, turnRight, type Dir, type Intent, type World } from './engine.ts';
import { RbError } from './py/errors.ts';
import { ActionRequest, PyTuple, repr, type HostFunction, type HostObject, type Value } from './py/values.ts';

/** One tick of an action; a function is looked at when its tick comes (cooldowns may have changed). */
export type Step = Intent | (() => Intent);

export const MAX_SAY = 40;
export const RANGE = 5;

/** What the parts need from the battle. */
export interface RobotContext {
  world: World;
  id: string;
  build: Build;
  /** Sensor values read this tick, for the replay ("see() → wall"). */
  sensorLog: string[];
  say: (text: string) => void;
}

export interface Env {
  globals: Record<string, Value>;
  /** Every name the game has but this build lacks: name -> error parameters. */
  notEquipped: Map<string, Record<string, string | number>>;
  /** Names that work, for the checker. */
  known: string[];
  /** Called at the start of every tick: cooldowns count down. */
  tickStart(): void;
  /** Cooldown / heat of a part, for tests and the viewer. */
  state(part: GearId): { cooldown: number; heat: number } | undefined;
}

const DIR_NAMES: Record<string, Dir> = { north: 'N', east: 'E', south: 'S', west: 'W' };

const badArg = (name: string, expected: string, given: Value): never => {
  throw new RbError('ValueError', 'bad-arg', { name, expected, given: repr(given) }, 0, `${name}() got a bad value: ${repr(given)}`);
};

const action = (name: string, steps: Step[]): ActionRequest | null => (steps.length === 0 ? null : new ActionRequest(steps, 0));

const fn = (name: string, call: (args: Value[], kwargs: Record<string, Value>) => Value | ActionRequest): HostFunction => ({ kind: 'host', name, call });

function obj(name: string, methods: Record<string, HostFunction>): HostObject {
  return { kind: 'object', name, get: (a) => (Object.prototype.hasOwnProperty.call(methods, a) ? methods[a] : undefined), names: () => Object.keys(methods) };
}

/** An optional whole number argument (a count of steps, or the shots of a burst). */
function count(name: string, args: Value[], dflt: number, min: number, max: number, hint: string): number {
  const v = args[0];
  if (v === undefined) return dflt;
  if (typeof v !== 'number' || v < min || v > max) return badArg(name, hint, v);
  return v;
}

export function createEnv(rc: RobotContext): Env {
  const { world, id, build } = rc;
  const me = () => world.robot(id);
  const globals: Record<string, Value> = {};
  const notEquipped = new Map<string, Record<string, string | number>>();
  const gearState = new Map<GearId, { cooldown: number; heat: number; lock: number }>();
  const has = (g: GearId) => build.gear.includes(g);
  const st = (g: GearId) => gearState.get(g)!;
  for (const g of build.gear) gearState.set(g, { cooldown: 0, heat: 0, lock: 0 });

  // ---- always there: wait, say, hp, alive, clock
  globals.wait = fn('wait', () => new ActionRequest([{ type: 'wait' } satisfies Intent], 0));
  const say = fn('say', (args) => {
    rc.say(args.map((a) => (typeof a === 'string' ? a : repr(a))).join(' ').slice(0, MAX_SAY));
    return null;
  });
  globals.say = say;
  globals.hp = fn('hp', () => me().hp);
  globals.alive = fn('alive', () => me().hp > 0);
  globals.clock = obj('clock', { tick: fn('tick', () => world.tick) });

  // ---- locomotion
  const move = (dir: Dir): Step => ({ type: 'move', dir });
  const times = (n: number, s: Step) => Array.from({ length: n }, () => s);
  if (build.locomotion === 'wheels') {
    globals.forward = fn('forward', (a) => action('forward', times(count('forward', a, 1, 0, 20, 'a number from 0 to 20'), () => move(me().facing) as Intent)));
    globals.backward = fn('backward', (a) => action('backward', times(count('backward', a, 1, 0, 20, 'a number from 0 to 20'), () => move(opposite(me().facing)) as Intent)));
    globals.turn_left = fn('turn_left', () => action('turn_left', [{ type: 'turn', side: 'left' }]));
    globals.turn_right = fn('turn_right', () => action('turn_right', [{ type: 'turn', side: 'right' }]));
    for (const [name, dir] of Object.entries(DIR_NAMES)) notEquipped.set(`move_${name}`, { kind: 'move-absolute', dir: name });
    for (const name of ['rotate_left', 'rotate_right']) notEquipped.set(name, { kind: 'move-absolute', dir: 'north' });
  } else {
    for (const [name, dir] of Object.entries(DIR_NAMES)) {
      globals[`move_${name}`] = fn(`move_${name}`, (a) => action(`move_${name}`, times(count(`move_${name}`, a, 1, 0, 20, 'a number from 0 to 20'), { type: 'move', dir })));
    }
    globals.rotate_left = fn('rotate_left', () => action('rotate_left', [{ type: 'turn', side: 'left' }]));
    globals.rotate_right = fn('rotate_right', () => action('rotate_right', [{ type: 'turn', side: 'right' }]));
    for (const name of ['forward', 'backward', 'turn_left', 'turn_right']) notEquipped.set(name, { kind: 'move-relative' });
  }
  // ---- status checks every gear item has
  const common = (g: GearId): Record<string, HostFunction> => ({
    is_charged: fn('is_charged', () => st(g).cooldown === 0 && st(g).lock === 0),
    cooldown: fn('cooldown', () => Math.max(st(g).cooldown, st(g).lock)),
    mark: fn('mark', () => (g === 'blaster' ? build.blasterMark : 1)),
  });

  /** A tick that spends the gear's cooldown, or is lost if it is not charged. */
  const use = (g: GearId, cooldown: number, intent: Intent, after?: () => void): Step => () => {
    const s = st(g);
    if (s.lock > 0) return { type: 'fizzle', part: g, reason: 'overheated', ticks: s.lock };
    if (s.cooldown > 0) return { type: 'fizzle', part: g, reason: 'charging', ticks: s.cooldown };
    s.cooldown = cooldown;
    after?.();
    return intent;
  };

  // ---- weapons
  if (has('blaster')) {
    const burst = build.blasterMark === 2;
    const shoot = (): Intent => ({ type: 'shoot', damage: 1, range: RANGE });
    const fireOnce = use('blaster', 0, shoot());
    const methods: Record<string, HostFunction> = {
      ...common('blaster'),
      fire: fn('fire', (a) => {
        if (!burst) {
          if (a.length > 0) throw new RbError('TypeError', 'arg-count', { name: 'fire', expected: 0, given: a.length }, 0, 'fire() takes no arguments');
          return action('fire', [fireOnce]);
        }
        const shots = count('fire', a, 1, 1, 3, 'a number of shots from 1 to 3');
        const steps: Step[] = Array.from({ length: shots }, () =>
          use('blaster', 0, shoot(), () => {
            const s = st('blaster');
            s.heat += 3;
            if (s.heat >= 10) {
              s.heat = 10;
              s.lock = 3;
            }
          }),
        );
        return action('fire', steps);
      }),
    };
    if (burst) methods.heat = fn('heat', () => st('blaster').heat);
    methods.is_charged = fn('is_charged', () => st('blaster').lock === 0);
    methods.cooldown = fn('cooldown', () => st('blaster').lock);
    globals.blaster = obj('blaster', methods);
    globals.fire = methods.fire!;
  } else notEquipped.set('blaster', { kind: 'part', need: 'blaster' });
  if (has('cannon')) {
    const methods: Record<string, HostFunction> = {
      ...common('cannon'),
      fire: fn('fire', (a) => {
        if (a.length === 0) throw new RbError('TypeError', 'bad-arg', { name: 'fire', expected: 'a power from 1 to 3, like fire(2)', given: 'nothing' }, 0, 'fire() missing power');
        const power = count('fire', a, 1, 1, 3, 'a power from 1 to 3');
        return action('fire', [use('cannon', power, { type: 'shoot', damage: power, range: RANGE })]);
      }),
    };
    globals.cannon = obj('cannon', methods);
    if (!has('blaster')) globals.fire = methods.fire!;
  } else notEquipped.set('cannon', { kind: 'part', need: 'cannon' });
  if (!has('blaster') && !has('cannon')) notEquipped.set('fire', { kind: 'part', need: 'blaster' });
  if (has('hammer')) {
    const methods: Record<string, HostFunction> = {
      ...common('hammer'),
      smash: fn('smash', () => action('smash', [use('hammer', 2, { type: 'melee', damage: 3 })])),
    };
    globals.hammer = obj('hammer', methods);
    globals.smash = methods.smash!;
  } else {
    notEquipped.set('hammer', { kind: 'part', need: 'hammer' });
    notEquipped.set('smash', { kind: 'part', need: 'hammer' });
  }

  // ---- utility
  if (has('shield')) {
    const methods: Record<string, HostFunction> = {
      ...common('shield'),
      activate: fn('activate', () => action('activate', [use('shield', 2, { type: 'shield' })])),
      is_up: fn('is_up', () => me().shieldUp),
    };
    globals.shield = obj('shield', methods);
  } else notEquipped.set('shield', { kind: 'part', need: 'shield' });
  if (has('gps')) {
    globals.gps = obj('gps', {
      ...common('gps'),
      position: fn('position', () => new PyTuple([me().pos.x, me().pos.y])),
      facing: fn('facing', () => me().facing),
    });
  } else notEquipped.set('gps', { kind: 'part', need: 'gps' });

  // ---- eyes
  const log = (call: string, v: Value) => {
    rc.sensorLog.push(`${call} → ${repr(v)}`);
    return v;
  };
  const look = (dir: Dir) => {
    const found = world.ahead(me().pos, dir, RANGE, me());
    return { what: found ? (found.what === 'robot' ? 'enemy' : found.what) : 'empty', distance: found ? found.distance : 0, robot: found?.robot };
  };
  if (has('eyes')) {
    const wide = build.addons.includes('wide');
    const scanner = build.addons.includes('scanner');
    const methods: Record<string, HostFunction> = {
      ...common('eyes'),
      see: fn('see', () => log('see()', look(me().facing).what)),
      distance: fn('distance', () => log('distance()', look(me().facing).distance)),
    };
    globals.see = methods.see!;
    globals.distance = methods.distance!;
    if (wide) {
      methods.see_left = fn('see_left', () => log('see_left()', look(turnLeft(me().facing)).what));
      methods.see_right = fn('see_right', () => log('see_right()', look(turnRight(me().facing)).what));
      globals.see_left = methods.see_left;
      globals.see_right = methods.see_right;
    } else for (const n of ['see_left', 'see_right']) notEquipped.set(n, { kind: 'part', need: 'wide' });
    if (scanner) {
      methods.enemy_shielded = fn('enemy_shielded', () => log('enemy_shielded()', Boolean(look(me().facing).robot?.shieldUp)));
      globals.enemy_shielded = methods.enemy_shielded;
    } else notEquipped.set('enemy_shielded', { kind: 'part', need: 'scanner' });
    globals.eyes = obj('eyes', methods);
  } else {
    notEquipped.set('eyes', { kind: 'part', need: 'eyes' });
    for (const n of ['see', 'distance', 'see_left', 'see_right', 'enemy_shielded']) notEquipped.set(n, { kind: 'part', need: 'eyes' });
  }

  for (const name of Object.keys(globals)) notEquipped.delete(name);
  return {
    globals,
    notEquipped,
    known: Object.keys(globals),
    tickStart() {
      for (const s of gearState.values()) {
        if (s.cooldown > 0) s.cooldown--;
        if (s.lock > 0) {
          s.lock--;
          if (s.lock === 0) s.heat = 0;
        } else if (s.heat > 0) s.heat--;
      }
    },
    state: (g) => gearState.get(g),
  };
}

/** The hit points a build starts with. */
export const buildHp = (build: Build): number => CHASSIS[build.chassis].hp;

export { addonsFor, DIRS, stepPos };
