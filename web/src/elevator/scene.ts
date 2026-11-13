/**
 * The building as an SVG, redrawn from a snapshot. It is kept plain, like Elevator Saga: the building's name as a
 * small label, the floors as flat bands with their number and an up and a down call button (lit while somebody on
 * that floor wants to go that way), the people waiting there (each shows the floor they want to go to, red once
 * they waited too long), closed floors behind barrier tape, one shaft per car with the car on its cable (sliding
 * doors, the floor and the direction in its head, the riders inside), a lamp per floor at the shaft's edge for the
 * pressed floor buttons, and under each shaft the car's name and list of floors. A shaft reaches a little above the
 * top floor and below floor 0, so a car sent to a floor that does not exist can be seen overshooting.
 *
 * `crash()` draws the crash at a progress of 0 to 1: shaking, the alarm, a hole and debris at the top (or the
 * bottom) of the shaft, the cable snaps, sparks at the rails while the car drops to the bottom of its shaft, dust,
 * and the car lying crooked with its doors open. The riders stay in.
 *
 * Everything that moves is one innerHTML string per frame; the rest is drawn once.
 */
import type { BuildingSnapshot } from './sim.ts';

const NS = 'http://www.w3.org/2000/svg';
/** How far the scene may be scaled up on a wide screen. */
const MAX_ZOOM = 1.45;
/** The row with the building's name (and the alarm lamp) above the shafts. */
const LABEL_H = 18;
/** Where the people start: right of the floor number and the call buttons. */
const PEOPLE_X = 46;
const SHAFT_GAP = 4;
/** The car's head with the display. */
const HEAD = 10;
/** Below the shafts: the car's name and its list of floors. */
const FOOT_H = 38;
const SHIRTS = 5;
const SKINS = 3;
/** How much of an overshoot past the top or the bottom floor is drawn (the bands there are thin). */
const OVERSHOOT = 0.75;
/** Ticks the doors take to open (and to close). */
export const DOOR_TICKS = 4;

export interface LiftScene {
  el: SVGSVGElement;
  /**
   * Draws a snapshot; with `next` and `frac` the cars stand part way to where they are in `next`. `doors` says how far
   * each car's doors are open (0 to 1); without it a stopped car has them open.
   */
  show(s: BuildingSnapshot, look: Look, next?: BuildingSnapshot, frac?: number, doors?: readonly number[]): void;
  /** Draws the crash of `cars` at `progress` (0 to 1) on top of the snapshot. */
  crash(s: BuildingSnapshot, look: Look, cars: readonly number[], where: 'roof' | 'pit' | 'fall', progress: number): void;
}

/** What a frame needs besides the snapshot. */
export interface Look {
  /** Who appeared (indexed by passenger id): their target floor, and the tick they appeared. */
  passengers: readonly { to: number; tick: number }[];
  /** People who appeared more than this many ticks ago and have not got out are drawn red (the waiting limit). */
  lateAfter?: number;
}

export interface SceneOptions {
  floors: number;
  cars: number;
  /** Closed floors (building sites). */
  closed?: readonly number[];
  /** The building's accent colour (`lift-theme-<theme>`) and the name on its label. */
  theme: string;
  name: string;
  /** The name a car has in the code: `elevator` (one car) or `elevators[i]`. */
  carName: (i: number) => string;
  label: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (n: number) => Math.round(n * 10) / 10;

export function createScene(o: SceneOptions): LiftScene {
  const fh = o.floors <= 3 ? 62 : o.floors <= 5 ? 54 : o.floors <= 8 ? 46 : 40;
  /** People (and with them the cars) are drawn bigger in buildings with high floors. */
  const ps = fh >= 54 ? 1.2 : fh >= 46 ? 1.1 : 1;
  const SEAT_W = 13.5 * ps;
  const STEP = 15 * ps;
  const CAR_W = Math.round(4 * SEAT_W + 5);
  /** The car, and a narrow column of floor-button lamps at its right. */
  const SHAFT_W = CAR_W + 8;
  const shaftsW = o.cars * SHAFT_W + (o.cars - 1) * SHAFT_GAP;
  /** Room for six people in line; a small building is narrow, so on a phone it is drawn bigger. */
  const width = Math.round(PEOPLE_X + 6 * STEP + 14 + shaftsW + 6);
  const shaftsLeft = width - 6 - shaftsW;
  const peopleRight = shaftsLeft - 6;
  const MAX_SHOWN = Math.max(1, Math.floor((peopleRight - PEOPLE_X - 14) / STEP));
  /** The thin bands above the top floor and below floor 0. */
  const band = Math.round(fh * 0.3);
  const top = LABEL_H + band;
  const ground = top + o.floors * fh;
  const shaftTop = top - band;
  const shaftBottom = ground + band;
  const height = shaftBottom + FOOT_H;
  /** The line under floor `f`. */
  const floorY = (f: number) => top + (o.floors - f) * fh;
  const shaftX = (i: number) => shaftsLeft + i * (SHAFT_W + SHAFT_GAP);
  const carH = fh - 6;
  const closed = new Set(o.closed ?? []);
  /** The top edge of a car at height `pos` (in floors); an overshoot is drawn shorter. */
  const carTop = (pos: number) => {
    const p = pos > o.floors - 1 ? o.floors - 1 + (pos - (o.floors - 1)) * OVERSHOOT : pos < 0 ? pos * OVERSHOOT : pos;
    return top + (o.floors - 1 - p) * fh + (fh - carH) / 2;
  };
  /** Where a falling car comes to rest: the bottom of its shaft. */
  const restTop = shaftBottom - carH - 4;
  const lampX = (i: number) => shaftX(i) + SHAFT_W - 3.5;
  const railL = (i: number) => shaftX(i) + 0.8;
  const railR = (i: number) => shaftX(i) + CAR_W + 2.2;

  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', `0 0 ${width} ${height}`);
  el.setAttribute('class', `lift-scene lift-theme-${o.theme}`);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', o.label);
  el.dataset.testid = 'lift-scene';
  el.style.maxWidth = `${Math.round(width * MAX_ZOOM)}px`;

  // What does not change: the name, the floor bands with their numbers, the shafts, barrier tape, the car names.
  let still = `<text class="lift-name" x="2" y="12.5">${esc(o.name)}</text>`;
  for (let f = 0; f < o.floors; f++) {
    const y = floorY(f);
    still += `<rect class="lift-floor${f % 2 ? ' odd' : ''}${closed.has(f) ? ' closed' : ''}" x="0" y="${y - fh}" width="${width}" height="${fh}"/>`;
    still += `<text class="lift-floorno" x="14" y="${r1(y - fh / 2 + 4.5)}" text-anchor="middle">${f}</text>`;
  }
  for (let f = 0; f <= o.floors; f++) still += `<line class="lift-floorline" x1="0" y1="${floorY(f)}" x2="${width}" y2="${floorY(f)}"/>`;
  for (let i = 0; i < o.cars; i++) {
    const x = shaftX(i);
    still += `<rect class="lift-shaft" x="${x}" y="${shaftTop}" width="${SHAFT_W}" height="${shaftBottom - shaftTop}" rx="2"/>`;
    still += `<line class="lift-rail" x1="${railL(i)}" y1="${shaftTop}" x2="${railL(i)}" y2="${shaftBottom}"/><line class="lift-rail" x1="${railR(i)}" y1="${shaftTop}" x2="${railR(i)}" y2="${shaftBottom}"/>`;
    still += `<rect class="lift-motor" x="${x + 1.5 + CAR_W / 2 - 7}" y="${shaftTop + 1}" width="14" height="4" rx="1"/>`;
    for (let f = 0; f < o.floors; f++) if (!closed.has(f)) still += `<circle class="lift-btn" cx="${lampX(i)}" cy="${floorY(f) - fh / 2}" r="2"/>`;
    const name = o.carName(i);
    const fit = name.length * 5.9 > SHAFT_W ? ` textLength="${SHAFT_W - 2}" lengthAdjust="spacingAndGlyphs"` : '';
    still += `<text class="lift-carname" x="${x + SHAFT_W / 2}" y="${shaftBottom + 12}" text-anchor="middle"${fit}>${esc(name)}</text>`;
    still += `<rect class="lift-queue-chip" x="${x}" y="${shaftBottom + 17}" width="${SHAFT_W}" height="18" rx="5"/>`;
  }
  // Barrier tape across a closed floor, where the people would wait and in front of every shaft.
  for (const f of closed) {
    const y = floorY(f) - fh / 2;
    still += `<g class="lift-site" data-testid="lift-site-${f}"><rect class="lift-tape" x="${PEOPLE_X - 18}" y="${y - 5}" width="${peopleRight - PEOPLE_X + 18}" height="10" rx="1"/>`;
    for (let i = 0; i < o.cars; i++) still += `<rect class="lift-tape" x="${shaftX(i) - 3}" y="${y - 5}" width="5" height="10"/>`;
    still += `</g>`;
  }
  el.innerHTML = `<defs><pattern id="lift-tape" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="10" class="lift-tape-a"/><rect x="5" width="5" height="10" class="lift-tape-b"/></pattern></defs><g>${still}</g><g class="lift-live"></g><circle class="lift-alarm" cx="${width - 8}" cy="9" r="5"/>`;
  const live = el.querySelector('.lift-live') as SVGGElement;
  const alarm = el.querySelector('.lift-alarm') as SVGCircleElement;

  /** A small person: head and body, the floor they want to go to on the body. */
  const person = (id: number, x: number, yBottom: number, to: number, cls: string) =>
    `<g class="lift-person ${cls} s${id % SHIRTS}" transform="translate(${r1(x)} ${r1(yBottom)})${ps === 1 ? '' : ` scale(${ps})`}"><circle class="lift-head k${(id * 7) % SKINS}" cx="6.5" cy="-15.6" r="3.3"/><rect class="lift-shirt" y="-12" width="13" height="12" rx="3"/><text x="6.5" y="-2.7" text-anchor="middle">${to}</text></g>`;
  const late = (id: number, look: Look, tick: number) => look.lateAfter !== undefined && tick - (look.passengers[id]?.tick ?? tick) > look.lateAfter;

  /** An up or a down call button. */
  const dirButton = (f: number, up: boolean, on: boolean, cy: number) => {
    const d = up ? -1 : 1;
    const cx = 33;
    return `<path class="lift-dir${on ? ' on' : ''}" data-testid="lift-${up ? 'up' : 'down'}-${f}" d="M${cx - 5} ${r1(cy + d * 1.5)}L${cx} ${r1(cy + d * 8)}L${cx + 5} ${r1(cy + d * 1.5)}z"/>`;
  };

  /** The floors with their people and call buttons, and the lamps and list of every car (not the cars themselves). */
  function floorsAndLists(s: BuildingSnapshot, look: Look): string {
    let out = '';
    for (let f = 0; f < o.floors; f++) {
      const y = floorY(f);
      const waiting = s.waiting[f] ?? [];
      // The first in line stands next to the shaft.
      waiting.slice(0, MAX_SHOWN).forEach((id, k) => {
        out += person(id, peopleRight - 13 * ps - k * STEP, y - 1.5, look.passengers[id]?.to ?? 0, `waiting${late(id, look, s.tick) ? ' late' : ''}`);
      });
      if (waiting.length > MAX_SHOWN) out += `<text class="lift-more" x="${r1(peopleRight - MAX_SHOWN * STEP - 1)}" y="${r1(y - 6)}" text-anchor="end">+${waiting.length - MAX_SHOWN}</text>`;
      if (!closed.has(f)) {
        // Lit while somebody waiting here wants to go up (down).
        const to = waiting.map((id) => look.passengers[id]?.to ?? f);
        const cy = y - fh / 2;
        if (f < o.floors - 1) out += dirButton(f, true, to.some((t) => t > f), f > 0 ? cy : cy + 3);
        if (f > 0) out += dirButton(f, false, to.some((t) => t < f), f < o.floors - 1 ? cy : cy - 3);
      }
    }
    s.cars.forEach((car, i) => {
      const x = shaftX(i);
      for (const f of car.pressed) if (f >= 0 && f < o.floors) out += `<circle class="lift-pressed" cx="${lampX(i)}" cy="${floorY(f) - fh / 2}" r="2.6"/>`;
      const text = `[${car.queue.join(', ')}]`;
      const fit = text.length * 7 > SHAFT_W - 4 ? ` textLength="${SHAFT_W - 6}" lengthAdjust="spacingAndGlyphs"` : '';
      out += `<text class="lift-queue" x="${x + SHAFT_W / 2}" y="${shaftBottom + 30}" text-anchor="middle"${fit} data-testid="lift-queue-${i}">${text}</text>`;
    });
    return out;
  }

  /** The cable from the motor down to the car's top. */
  const cable = (i: number, y: number) => {
    const cx = shaftX(i) + 1.5 + CAR_W / 2;
    return `<line class="lift-cable" x1="${cx}" y1="${shaftTop + 5}" x2="${cx}" y2="${r1(y)}"/>`;
  };

  /**
   * One car with its riders; `open` says how far the doors are open (0 to 1), `tilt` turns the car (lying crooked
   * after a crash).
   */
  function car(s: BuildingSnapshot, look: Look, i: number, y: number, pos: number, open: number, extra = '', tilt = 0): string {
    const c = s.cars[i]!;
    const x = shaftX(i) + 1.5;
    const cls = c.site ? 'stopped site' : c.state;
    const turn = tilt ? ` transform="rotate(${tilt} ${x + CAR_W / 2} ${r1(y + carH)})"` : '';
    const inX = x + 2;
    const inW = CAR_W - 4;
    const inY = y + HEAD;
    const inH = carH - HEAD - 2;
    let out = `<g class="lift-car ${cls}${extra}" data-testid="lift-car-${i}" data-state="${c.state}"${turn}>`;
    out += `<rect class="lift-car-body" x="${x}" y="${r1(y)}" width="${CAR_W}" height="${carH}" rx="3"/>`;
    out += `<rect class="lift-car-in" x="${inX}" y="${r1(inY)}" width="${inW}" height="${inH}" rx="1"/>`;
    // The doors slide apart from the middle. They are drawn behind the riders: who is inside always stays visible.
    const dw = (inW / 2) * (1 - Math.max(0, Math.min(1, open)));
    if (dw > 0.4) {
      out += `<rect class="lift-door" x="${inX}" y="${r1(inY)}" width="${r1(dw)}" height="${inH}"/><rect class="lift-door" x="${r1(inX + inW - dw)}" y="${r1(inY)}" width="${r1(dw)}" height="${inH}"/>`;
    }
    c.riders.forEach((id, k) => {
      out += person(id, inX + 0.5 + (k % 4) * SEAT_W, y + carH - 2 - Math.floor(k / 4) * 4 * ps, look.passengers[id]?.to ?? 0, `riding${late(id, look, s.tick) ? ' late' : ''}`);
    });
    // The head: the direction and the floor.
    const mid = x + CAR_W / 2;
    const ty = r1(y + HEAD - 2);
    if (extra) out += `<text class="lift-display-text alarm" x="${mid}" y="${ty}" text-anchor="middle">!</text>`;
    else {
      const shownFloor = Math.max(0, Math.min(o.floors - 1, Math.round(pos)));
      if (c.dir > 0) out += `<path class="lift-display-arrow" d="M${mid - 12} ${r1(y + HEAD - 2.5)}l3 -4.5 3 4.5z"/>`;
      if (c.dir < 0) out += `<path class="lift-display-arrow" d="M${mid - 12} ${r1(y + 3)}l3 4.5 3 -4.5z"/>`;
      out += `<text class="lift-display-text" x="${mid}" y="${ty}" text-anchor="middle">${shownFloor}</text>`;
    }
    return `${out}</g>`;
  }

  const defaultOpen = (s: BuildingSnapshot, i: number) => (s.cars[i]!.state === 'stopped' ? 1 : 0);

  function show(s: BuildingSnapshot, look: Look, next?: BuildingSnapshot, frac = 0, doors?: readonly number[]) {
    el.classList.remove('lift-shake');
    alarm.classList.remove('on');
    let out = floorsAndLists(s, look);
    s.cars.forEach((c, i) => {
      const pos = next ? c.pos + (next.cars[i]!.pos - c.pos) * frac : c.pos;
      const y = carTop(pos);
      out += cable(i, y) + car(s, look, i, y, pos, doors?.[i] ?? defaultOpen(s, i));
    });
    live.innerHTML = out;
  }

  function crash(s: BuildingSnapshot, look: Look, crashed: readonly number[], where: 'roof' | 'pit' | 'fall', p: number) {
    el.classList.toggle('lift-shake', p < 0.35);
    alarm.classList.toggle('on', Math.floor(p * 12) % 2 === 0 || p >= 1);
    let out = floorsAndLists(s, look);
    const FALL_FROM = 0.15;
    const LAND = 0.7;
    s.cars.forEach((c, i) => {
      if (!crashed.includes(i)) {
        const y = carTop(c.pos);
        out += cable(i, y) + car(s, look, i, y, c.pos, defaultOpen(s, i));
        return;
      }
      const mid = shaftX(i) + 1.5 + CAR_W / 2;
      const from = carTop(c.pos);
      // A hole where it hit (the top or the bottom of the shaft), debris flying off.
      if (where !== 'fall') {
        const yHit = where === 'roof' ? shaftTop : shaftBottom;
        const d = where === 'roof' ? -1 : 1;
        out += `<path class="lift-hole" d="M${mid - 18} ${yHit}l4 ${d * 5}l5 ${-d * 3}l5 ${d * 6}l5 ${-d * 4}l5 ${d * 5}l5 ${-d * 3}l7 ${d * 2}l0 ${-d * 8}z"/>`;
        if (p < 0.6) {
          const k = p / 0.6;
          for (let n = 0; n < 7; n++) {
            const dx = (n - 3) * 7 * (0.5 + k * 1.4);
            const dy = d * (6 + (n % 3) * 5) * k;
            out += `<rect class="lift-debris" x="${r1(mid + dx)}" y="${r1(yHit + dy)}" width="${3 + (n % 2) * 2}" height="3.5" opacity="${r1(1 - k)}" transform="rotate(${n * 40 + k * 200} ${r1(mid + dx + 2)} ${r1(yHit + dy + 2)})"/>`;
          }
        }
      }
      if (p < FALL_FROM) {
        out += cable(i, from) + car(s, look, i, from, c.pos, 1, ' crashing');
        return;
      }
      // The cable has snapped: a short end hangs from the motor.
      const sway = Math.sin(p * 30) * 3;
      out += `<path class="lift-cable" d="M${mid} ${shaftTop + 5}q${r1(sway)} 7 ${r1(sway * 1.6)} 15"/>`;
      if (p < LAND) {
        // Falling: faster and faster, sparks at the rails.
        const k = (p - FALL_FROM) / (LAND - FALL_FROM);
        const y = from + (restTop - from) * k * k;
        const pos = o.floors - 1 - (y - top - (fh - carH) / 2) / fh;
        out += car(s, look, i, y, pos, 1, ' crashing');
        const flick = Math.floor(p * 40);
        for (let sp = 0; sp < 6; sp++) {
          const left = sp % 2 === 0;
          const side = left ? railL(i) : railR(i);
          const sy = y + 4 + ((sp * 11 + flick * 5) % Math.max(8, carH - 6));
          const dir = left ? -1 : 1;
          out += `<line class="lift-spark" x1="${side}" y1="${r1(sy)}" x2="${side + dir * (3 + ((flick + sp) % 3) * 2)}" y2="${r1(sy - 5 - (sp % 3) * 2)}"/>`;
        }
        return;
      }
      // Landed: crooked, doors open, dust settling.
      const k = (p - LAND) / (1 - LAND);
      out += car(s, look, i, restTop, 0, 1, ' crashed', -6);
      for (let d = 0; d < 4; d++) {
        const cx = shaftX(i) + 6 + d * (CAR_W / 3.4) + (d - 1.5) * k * 7;
        out += `<ellipse class="lift-dust" cx="${r1(cx)}" cy="${r1(restTop + carH - 3 - k * 6)}" rx="${r1(5 + k * 8)}" ry="${r1(3 + k * 4)}" opacity="${r1(0.75 * (1 - k))}"/>`;
      }
    });
    live.innerHTML = out;
  }

  return { el, show, crash };
}
