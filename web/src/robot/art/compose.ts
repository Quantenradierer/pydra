/**
 * The renderer: chassis + locomotion + gear -> one SVG. Pure string building (also used by tests); `robotEl`
 * parses it for the DOM. Every place that shows a robot or a part goes through here.
 */
import { svg } from '../../dom.ts';
import type { Build } from '../build.ts';
import { chassisArt, partArt } from './registry.ts';
import { anchorPoint, assignSockets, emptySockets, paintOrder, socketTransform } from './sockets.ts';
import { BODY_LAYER, type RobotSpec, type Socket, type SocketName, type Tier } from './types.ts';

export const specOf = (b: Build): RobotSpec => ({ chassis: b.chassis, locomotion: b.locomotion, gear: b.gear, mark: b.blasterMark, wide: b.addons.includes('wide'), scanner: b.addons.includes('scanner') });

export const tierOf = (s: RobotSpec): Tier => ({ mark: s.mark ?? 1, wide: s.wide ?? false, scanner: s.scanner ?? false });

export interface RenderOptions {
  /** Red palette. */
  enemy?: boolean;
  /** `empty`: plug outlines on free slots. `interactive`: also big tap targets on every socket and the wheels. */
  sockets?: 'none' | 'empty' | 'interactive';
  /** Part ids that were just plugged in: they play the snap-in animation. */
  snap?: readonly string[];
  /** Accessible names for sockets and parts (the screen supplies the translations). */
  label?: (kind: 'socket' | 'part' | 'robot', id: string) => string;
}

interface Placed {
  key: string;
  socket: Socket;
  name: SocketName;
  svg: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Unit vector pointing out of a socket, for the snap-in animation. */
const outward = (s: Socket) => ({ dx: Math.round(Math.cos((s.rot * Math.PI) / 180) * 16), dy: Math.round(Math.sin((s.rot * Math.PI) / 180) * 16) });

const plug = (name: SocketName, s: Socket, o: RenderOptions) => {
  const label = o.label?.('socket', name) ?? name;
  const attrs = o.sockets === 'interactive' ? ` role="button" tabindex="0" aria-label="${esc(label)}" data-testid="robot-socket-${name}"` : '';
  return `<g class="rb-plug" data-socket="${name}" data-empty="1" transform="translate(${s.x} ${s.y}) rotate(${s.rot})"${attrs}><rect x="-8.5" y="-8.5" width="17" height="17" rx="4"/><path d="M-3.5 0H3.5M0 -3.5V3.5"/>${o.sockets === 'interactive' ? '<circle class="rb-hit" r="13"/>' : ''}</g>`;
};

/** The robot as an SVG string, 100 x 100, facing east. */
export function robotSvg(spec: RobotSpec, o: RenderOptions = {}): string {
  const chassis = chassisArt(spec.chassis);
  const tier = tierOf(spec);
  const assigned = assignSockets(chassis, spec.gear, partArt);
  const snap = new Set(o.snap ?? []);
  const interactive = o.sockets === 'interactive';
  const placed: Placed[] = [{ key: 'body', socket: { x: 0, y: 0, rot: 0, scale: 1, layer: BODY_LAYER }, name: 'top', svg: `<g class="rb-body">${chassis.body}</g>` }];
  const add = (id: string, name: SocketName) => {
    const art = partArt(id);
    if (!art) return;
    const socket = chassis.sockets[name];
    const { dx, dy } = outward(socket);
    const label = o.label?.('part', id) ?? id;
    const attrs = interactive ? ` role="button" tabindex="0" aria-label="${esc(label)}" data-testid="robot-part-${id}"` : '';
    const inner = `<g class="rb-in${snap.has(id) ? ' rb-snap' : ''}" style="--dx:${dx}px;--dy:${dy}px">${art.draw(tier)}</g>`;
    const hit = interactive ? `<circle class="rb-hit" r="${art.kind === 'locomotion' ? 0 : 13}"/>` : '';
    placed.push({ key: id, socket, name, svg: `<g class="rb-sock rb-part rb-part-${id}${art.kind === 'locomotion' ? ' rb-loco' : ''}" data-socket="${name}" data-part="${id}" transform="${socketTransform(socket)}"${attrs}>${inner}${hit}</g>` });
  };
  add(spec.locomotion, 'underside');
  for (const [id, name] of assigned) add(id, name);
  const parts = paintOrder(placed).map((p) => p.svg).join('');
  const plugs = o.sockets && o.sockets !== 'none' ? emptySockets(chassis, assigned).map((n) => plug(n, chassis.sockets[n], o)).join('') : '';
  // Tap target for the locomotion: a strip along the lower hull edge (the wheels themselves are under the body).
  const loco = interactive ? `<g class="rb-lochit" role="button" tabindex="0" aria-label="${esc(o.label?.('socket', 'underside') ?? 'underside')}" data-socket="underside" data-testid="robot-socket-underside"><rect x="14" y="76" width="72" height="20" rx="10"/></g>` : '';
  const name = o.label?.('robot', spec.chassis) ?? `${spec.chassis} robot`;
  return `<svg class="rb${o.enemy ? ' rb-enemy' : ''}" viewBox="0 0 100 100" role="img" aria-label="${esc(name)}" data-chassis="${spec.chassis}" data-loco="${spec.locomotion}" data-gear="${spec.gear.join(' ')}"><circle class="rb-bubble" cx="50" cy="50" r="44"/>${parts}${plugs}${loco}</svg>`;
}

export const robotEl = (spec: RobotSpec, o: RenderOptions = {}): SVGSVGElement => svg(robotSvg(spec, o));

/** Where a weapon's tip is, in 100-box coordinates facing east (or undefined without a weapon of that id). */
export function muzzleOf(spec: RobotSpec, gearId: string): { x: number; y: number } | undefined {
  const chassis = chassisArt(spec.chassis);
  const art = partArt(gearId);
  const at = assignSockets(chassis, spec.gear, partArt).get(gearId);
  if (!art?.muzzle || !at) return undefined;
  return anchorPoint(chassis.sockets[at], art.muzzle);
}
