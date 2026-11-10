/**
 * The robot layer of the arena: one DOM unit per robot, drawn by the same renderer as the build screen, placed in
 * percent of the board (so it scales with the canvas under it). `update` turns a replay frame into positions,
 * facing, HP, shield, destroyed state and the one-tick effects (fire, smash, hit, move).
 */
import type { Build } from '../build.ts';
import { START_BUILD } from '../build.ts';
import type { BattleResult, Frame } from '../battle.ts';
import { robotEl, specOf } from './compose.ts';
import { FACING_DEG } from './sockets.ts';

const FX = ['fx-fire', 'fx-smash', 'fx-hit', 'fx-move'] as const;
const FALLBACK: Build = { ...START_BUILD, chassis: 'medium' };

export interface RobotLayer {
  el: HTMLElement;
  update(frame: Frame, prev?: Frame, quiet?: boolean): void;
}

/** The effects a frame's events cause, by robot id. */
export function effectsOf(frame: Frame, prev?: Frame): Map<string, Set<(typeof FX)[number]>> {
  const out = new Map<string, Set<(typeof FX)[number]>>();
  const add = (id: string, fx: (typeof FX)[number]) => (out.get(id) ?? out.set(id, new Set()).get(id)!).add(fx);
  for (const e of frame.events) {
    if (e.type === 'shot') add(e.by, 'fx-fire');
    else if (e.type === 'smash') add(e.by, 'fx-smash');
    else if (e.type === 'damage') add(e.robot, 'fx-hit');
  }
  if (prev) for (const r of frame.robots) {
    const before = prev.robots.find((x) => x.id === r.id);
    if (before && (before.pos.x !== r.pos.x || before.pos.y !== r.pos.y)) add(r.id, 'fx-move');
  }
  return out;
}

/** The HP bar: one segment per hit point; `true` = still there. A 1-HP enemy has 1 segment, a 5-HP enemy 5. */
export const hpSegments = (hp: number, maxHp: number): boolean[] => Array.from({ length: Math.max(1, Math.round(maxHp)) }, (_, i) => i < hp);

export function createRobotLayer(battle: BattleResult, cols: number, rows: number, label: (id: string) => string): RobotLayer {
  const el = document.createElement('div');
  el.className = 'rb-layer';
  el.setAttribute('data-testid', 'robot-layer');
  const units = new Map<string, { root: HTMLElement; turn: HTMLElement; hp: HTMLElement; segs: HTMLElement[]; deg: number }>();
  for (const r of battle.frames[0]?.robots ?? []) {
    const build = battle.builds?.[r.id] ?? (r.id === 'player' ? START_BUILD : FALLBACK);
    const enemy = r.id !== 'player';
    const root = document.createElement('div');
    root.className = `rb-unit${enemy ? ' enemy' : ''}`;
    root.dataset.robot = r.id;
    root.style.width = `${100 / cols}%`;
    root.style.height = `${100 / rows}%`;
    const turn = document.createElement('div');
    turn.className = 'rb-turn';
    turn.append(robotEl(specOf(build), { enemy, label: () => label(r.id) }));
    const hp = document.createElement('div');
    const bar = document.createElement('div');
    bar.className = 'rb-hp';
    bar.dataset.max = String(r.maxHp);
    const segs = hpSegments(r.hp, r.maxHp).map(() => document.createElement('i'));
    hp.append(...segs);
    bar.append(hp);
    root.append(turn, bar);
    el.append(root);
    units.set(r.id, { root, turn, hp, segs, deg: FACING_DEG[r.facing] });
  }
  const update = (frame: Frame, prev?: Frame, quiet = false) => {
    const fx = quiet ? new Map() : effectsOf(frame, prev);
    for (const r of frame.robots) {
      const u = units.get(r.id);
      if (!u) continue;
      u.root.style.left = `${(r.pos.x * 100) / cols}%`;
      u.root.style.top = `${(r.pos.y * 100) / rows}%`;
      const target = FACING_DEG[r.facing];
      u.deg += ((((target - u.deg) % 360) + 540) % 360) - 180;
      u.turn.style.transform = `rotate(${u.deg}deg) scale(1.2)`;
      u.root.style.setProperty('--rb-deg', `${u.deg}deg`);
      hpSegments(r.hp, r.maxHp).forEach((on, i) => u.segs[i]?.classList.toggle('off', !on));
      u.hp.className = r.hp / r.maxHp > 0.4 ? '' : 'low';
      const dead = r.hp <= 0;
      u.root.classList.toggle('dead', dead);
      u.root.classList.toggle('shield-up', r.shieldUp && !dead);
      const now = fx.get(r.id) as Set<string> | undefined;
      for (const c of FX) u.root.classList.remove(c);
      if (now && now.size > 0) {
        void u.root.offsetWidth;
        for (const c of now) u.root.classList.add(c);
      }
    }
  };
  return { el, update };
}
