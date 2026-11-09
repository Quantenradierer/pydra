import type { BattleResult, Frame } from './battle.ts';
import type { Pos, Tile } from './engine.ts';
import type { MessageKey, Params } from '../i18n.ts';
import { muzzleOf, specOf } from './art/compose.ts';
import { turnedPoint } from './art/sockets.ts';

export const CELL = 40;

const COLORS: Record<Tile, string> = { floor: '#22324a', wall: '#6f7f95', rubble: '#8a6d3b', pit: '#070b11' };
const FACING_ANGLE = { N: -Math.PI / 2, E: 0, S: Math.PI / 2, W: Math.PI } as const;

/** Where a shot leaves the robot: its weapon's muzzle (cannon for strong shots), turned with the robot. */
function muzzleStart(battle: BattleResult, frame: Frame, by: string, from: Pos): { x: number; y: number } {
  const c = center(from);
  const build = battle.builds?.[by];
  const robot = frame.robots.find((r) => r.id === by);
  if (!build || !robot) return c;
  const weapon = build.gear.includes('cannon') ? 'cannon' : 'blaster';
  const m = muzzleOf(specOf(build), weapon);
  if (!m) return c;
  const p = turnedPoint(m, robot.facing);
  return { x: c.x + ((p.x - 50) / 100) * CELL * 0.9, y: c.y + ((p.y - 50) / 100) * CELL * 0.9 };
}

const center = (p: Pos, cell = CELL) => ({ x: p.x * cell + cell / 2, y: p.y * cell + cell / 2 });

/** A call shown on the arena next to the robot: the command or sensor that just ran, with its result. */
export interface Callout {
  kind: 'action' | 'sensor' | 'say';
  text: string;
}

export interface DrawExtras {
  /** The frame before: the robot's old place is drawn as a ghost with an arrow to the new one. */
  prev?: Frame;
  callouts?: readonly Callout[];
  /** Show the positions only: the shots and bubbles of this frame belong to the tick that has not resolved yet. */
  quiet?: boolean;
  /** A canvas above the robot layer for bubbles and calls (without it they go on the board canvas). */
  over?: HTMLCanvasElement;
}

const CALLOUT_COLORS = { action: '#4fc3f7', sensor: '#7bd88f', say: '#ffffff' } as const;

/** Calls as pills above the player's robot, move ghost + arrow, and floating damage numbers. */
function drawOverlay(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, frame: Frame, extras: DrawExtras) {
  const me = frame.robots.find((r) => r.id === 'player');
  const before = extras.prev?.robots.find((r) => r.id === 'player');
  if (me && before && (before.pos.x !== me.pos.x || before.pos.y !== me.pos.y)) {
    const a = center(before.pos);
    const b = center(me.pos);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.x, a.y, CELL * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
  ctx.font = 'bold 12px sans-serif';
  ctx.textBaseline = 'middle';
  for (const e of frame.events) {
    if (e.type !== 'damage') continue;
    const r = frame.robots.find((x) => x.id === e.robot);
    if (!r) continue;
    const c = center(r.pos);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText(`-${e.amount}`, c.x + CELL * 0.1, c.y - CELL * 0.45);
  }
  if (me && extras.callouts?.length) {
    const c = center(me.pos);
    const below = me.pos.y <= 1;
    extras.callouts.forEach((callout, i) => {
      const text = callout.text.length > 26 ? `${callout.text.slice(0, 25)}…` : callout.text;
      const w = ctx.measureText(text).width + 14;
      const x = Math.min(Math.max(c.x - w / 2, 2), canvas.width - w - 2);
      const y = below ? c.y + CELL * 0.45 + i * 21 : c.y - CELL * 0.45 - 20 - i * 21;
      ctx.fillStyle = CALLOUT_COLORS[callout.kind];
      ctx.beginPath();
      ctx.roundRect(x, Math.min(Math.max(y, 2), canvas.height - 20), w, 19, 9);
      ctx.fill();
      ctx.fillStyle = '#14202e';
      ctx.fillText(text, x + 7, Math.min(Math.max(y, 2), canvas.height - 20) + 10);
    });
  }
}

/** Draws one frame of a battle on a canvas: tiles, robots with HP, shots, hits and speech bubbles. */
export function drawFrame(canvas: HTMLCanvasElement, battle: BattleResult, index: number, trail: ReadonlySet<string> = new Set(), extras: DrawExtras = {}): void {
  const shown = battle.frames[Math.min(index, battle.frames.length - 1)]!;
  const frame: Frame = extras.quiet ? { ...shown, events: [], bubbles: [] } : shown;
  const rows = battle.tiles.length;
  const cols = battle.tiles[0]?.length ?? 0;
  canvas.width = cols * CELL;
  canvas.height = rows * CELL;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = battle.tiles[y]![x]!;
      ctx.fillStyle = COLORS[tile];
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      ctx.strokeStyle = '#2d405c';
      ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
      if (tile === 'rubble') {
        ctx.fillStyle = '#b89452';
        for (const [dx, dy] of [[0.25, 0.3], [0.6, 0.25], [0.4, 0.65], [0.75, 0.7]] as const) ctx.fillRect(x * CELL + dx * CELL, y * CELL + dy * CELL, 5, 5);
      }
      if (trail.has(`${x},${y}`)) {
        ctx.fillStyle = 'rgba(120, 220, 140, 0.55)';
        ctx.fillRect(x * CELL + 6, y * CELL + 6, CELL - 12, CELL - 12);
      }
    }
  }
  // Shots and hits first, so robots draw on top.
  for (const e of frame.events) {
    if (e.type === 'shot') {
      const a = muzzleStart(battle, frame, e.by, e.from);
      const b = center(e.to);
      ctx.strokeStyle = e.blocked ? '#9fb4cc' : '#ffd43b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (e.type === 'smash') {
      const c = center(e.at);
      ctx.fillStyle = e.blocked ? 'rgba(159,180,204,0.7)' : 'rgba(255,140,40,0.8)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, CELL * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Speech bubbles and calls go on the canvas above the robots when there is one.
  const top = extras.over;
  if (top) {
    top.width = canvas.width;
    top.height = canvas.height;
  }
  const ctx2 = (top ?? canvas).getContext('2d');
  if (!ctx2) return;
  ctx2.font = 'bold 12px sans-serif';
  ctx2.textBaseline = 'middle';
  for (const b of frame.bubbles) {
    const r = frame.robots.find((x) => x.id === b.robot);
    if (!r) continue;
    const c = center(r.pos);
    const text = b.text.length > 18 ? `${b.text.slice(0, 17)}…` : b.text;
    const w = ctx2.measureText(text).width + 12;
    const x = Math.min(Math.max(c.x - w / 2, 2), canvas.width - w - 2);
    const y = Math.max(r.pos.y * CELL - 12, 2);
    ctx2.fillStyle = '#ffffff';
    ctx2.fillRect(x, y, w, 18);
    ctx2.fillStyle = '#14202e';
    ctx2.fillText(text, x + 6, y + 9);
  }
  drawOverlay(ctx2, canvas, frame, extras);
}

type T = (key: MessageKey, params?: Params) => string;

/** What happened in a frame, as sentences (also for screen readers). */
export function describeFrame(frame: Frame, t: T): string[] {
  const enemies = frame.robots.filter((r) => r.id !== 'player').length;
  const who = (id: string) => (id === 'player' ? t('robot.you') : enemies > 1 ? `${t('robot.enemy')} ${id.replace('enemy', '')}` : t('robot.enemy'));
  const out: string[] = [];
  for (const e of frame.events) {
    switch (e.type) {
      case 'shot':
        out.push(t(e.hit ? (e.blocked ? 'robot.ev.shot.blocked' : 'robot.ev.shot.hit') : 'robot.ev.shot.miss', { who: who(e.by) }));
        break;
      case 'smash':
        out.push(t(e.hit ? (e.blocked ? 'robot.ev.smash.blocked' : 'robot.ev.smash.hit') : 'robot.ev.smash.miss', { who: who(e.by) }));
        break;
      case 'damage':
        out.push(t('robot.ev.damage', { who: who(e.robot), amount: e.amount }));
        break;
      case 'push':
        out.push(t('robot.ev.push', { who: who(e.by), target: who(e.target) }));
        break;
      case 'heal':
        out.push(t('robot.ev.heal', { who: who(e.robot), amount: e.amount }));
        break;
      case 'death':
        out.push(t('robot.ev.death', { who: who(e.robot) }));
        break;
      case 'shield':
        out.push(t('robot.ev.shield', { who: who(e.robot) }));
        break;
      case 'bump':
        out.push(t(`robot.ev.bump.${e.reason}` as MessageKey, { who: who(e.robot) }));
        break;
      case 'fizzle':
        out.push(t(`robot.ev.fizzle.${e.reason}` as MessageKey, { part: t(`robot.part.${e.part}` as MessageKey), ticks: e.ticks }));
        break;
    }
  }
  for (const b of frame.bubbles) out.push(t('robot.ev.said', { who: who(b.robot), text: b.text }));
  return out;
}
