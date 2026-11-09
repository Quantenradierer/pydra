import { h } from '../dom.ts';
import type { MessageKey, Params } from '../i18n.ts';
import { GEAR, LOCOMOTIONS, type Build, type GearId, type LocomotionId } from '../robot/build.ts';
import { iconEl, partIconSpec, robotEl, specOf } from '../robot/art/compose.ts';
import { chassisArt, partArt } from '../robot/art/registry.ts';
import { assignSockets } from '../robot/art/sockets.ts';
import type { SocketName } from '../robot/art/types.ts';

type T = (key: MessageKey, params?: Params) => string;

export interface BenchOptions {
  t: T;
  build: Build;
  /** Tries a new build (the screen explains refusals). */
  apply(next: Build): void;
  /** What is picked on the robot (kept by the screen across redraws). */
  selected: SocketName | string | undefined;
  select(sel: string | undefined): void;
  /** Part ids that were just plugged in (snap-in animation). */
  snap: readonly string[];
}

const slotName = (t: T, s: SocketName) => t(`robot.socket.${s}` as MessageKey);

/** The gear that would click into `socket` if the player added it now. */
export function gearForSocket(build: Build, socket: SocketName): { here: GearId[]; elsewhere: GearId[] } {
  const chassis = chassisArt(build.chassis);
  const free = GEAR.filter((g) => !build.gear.includes(g));
  const here: GearId[] = [];
  const elsewhere: GearId[] = [];
  for (const g of free) (assignSockets(chassis, [...build.gear, g], partArt).get(g) === socket ? here : elsewhere).push(g);
  return { here, elsewhere };
}

/** The big robot with tappable sockets plus the inspector under it. */
export function benchEl(o: BenchOptions): HTMLElement {
  const { t, build } = o;
  const chassis = chassisArt(build.chassis);
  const partName = (id: string) => (id === 'blaster' && build.blasterMark === 2 ? t('robot.mk2') : t(`robot.gear.${id}` as MessageKey));
  const names = [t(`robot.locoName.${build.locomotion}` as MessageKey), ...build.gear.map((g) => t(`robot.part.${g}` as MessageKey))].join(', ');
  const robot = robotEl(specOf(build), {
    sockets: 'interactive',
    snap: o.snap,
    label: (kind, id) => (kind === 'socket' ? t('robot.bench.empty', { slot: slotName(t, id as SocketName) }) : kind === 'part' ? (id === 'wheels' || id === 'legs' || id === 'treads' ? t(`robot.locoName.${id}` as MessageKey) : t(`robot.part.${id}` as MessageKey)) : id === 'drive' ? t('robot.build.locomotion') : t('robot.art.alt', { parts: names })),
  });
  const assigned = assignSockets(chassis, build.gear, partArt);
  const selectedPart = o.selected && (build.gear.includes(o.selected as GearId) || o.selected === build.locomotion) ? o.selected : undefined;
  for (const el of robot.querySelectorAll<SVGElement>('[data-socket]')) {
    const part = el.getAttribute('data-part');
    const socket = el.getAttribute('data-socket')!;
    const key = el.classList.contains('rb-loco') ? 'underside' : (part ?? socket);
    if (o.selected === key) el.classList.add('picked');
    const choose = () => o.select(o.selected === key ? undefined : key);
    el.addEventListener('click', choose);
    el.addEventListener('keydown', (e) => ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') && (e.preventDefault(), choose()));
  }

  const card = (id: string, label: string, action: HTMLElement | null, note = '') =>
    h('li', { class: 'robot-pick' }, iconEl(partIconSpec(id), 52), h('span', { class: 'robot-pick-text' }, h('strong', {}, label), note ? h('small', {}, note) : null), action);
  const inspector = h('div', { class: 'robot-inspector', 'data-testid': 'robot-inspector', 'aria-live': 'polite' });
  const close = () => h('button', { class: 'run-control', onclick: () => o.select(undefined) }, t('robot.bench.close'));

  if (o.selected === 'underside') {
    inspector.append(
      h('h4', {}, t('robot.bench.loco')),
      h('ul', { class: 'robot-picks' }, ...LOCOMOTIONS.map((l: LocomotionId) => {
        const current = build.locomotion === l;
        return card(l, t(`robot.locoName.${l}` as MessageKey), current ? h('span', { class: 'robot-tag' }, t('robot.bench.current')) : h('button', { class: 'run-control', 'data-testid': `robot-pick-${l}`, onclick: () => o.apply({ ...build, locomotion: l }) }, t('robot.bench.plug')), t(`robot.loco.${l}` as MessageKey).split(':')[1]?.trim() ?? '');
      })),
    );
  } else if (selectedPart && selectedPart !== build.locomotion) {
    const id = selectedPart as GearId;
    inspector.append(
      h('h4', {}, partName(id)),
      h('p', {}, t('robot.bench.installed', { part: partName(id), slot: slotName(t, assigned.get(id) ?? 'top') })),
      h('div', { class: 'robot-pick-actions' }, h('button', { class: 'run-control', 'data-testid': `robot-unplug-${id}`, onclick: () => (o.select(undefined), o.apply({ ...build, gear: build.gear.filter((x) => x !== id) })) }, t('robot.bench.remove')), close()),
    );
  } else if (selectedPart === build.locomotion) {
    inspector.append(h('h4', {}, t(`robot.locoName.${build.locomotion}` as MessageKey)), h('p', {}, t(`robot.loco.${build.locomotion}` as MessageKey)), h('div', { class: 'robot-pick-actions' }, close()));
  } else if (o.selected && chassis.slots.includes(o.selected as SocketName)) {
    const sel = o.selected as SocketName;
    const { here, elsewhere } = gearForSocket(build, sel);
    const list = here.length > 0 ? here : elsewhere;
    inspector.append(
      h('h4', {}, t('robot.bench.empty', { slot: slotName(t, sel) })),
      list.length === 0 ? h('p', {}, t('robot.bench.none')) : h('p', {}, here.length > 0 ? t('robot.bench.fits') : t('robot.bench.elsewhere')),
      h('ul', { class: 'robot-picks' }, ...list.map((g) => card(g, partName(g), h('button', { class: 'run-control', 'data-testid': `robot-pick-${g}`, onclick: () => (o.select(undefined), o.apply({ ...build, gear: [...build.gear, g] })) }, t('robot.bench.plug'))))),
      h('div', { class: 'robot-pick-actions' }, close()),
    );
  }

  return h('div', { class: 'robot-bench', 'data-testid': 'robot-bench' }, h('div', { class: 'rb-stage robot-bench-stage' }, robot), inspector);
}
