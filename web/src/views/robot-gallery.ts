import type { App, Screen } from '../app.ts';
import { h } from '../dom.ts';
import { robotEl } from '../robot/art/compose.ts';
import { CHASSIS_ART, GEAR_ART, LOCOMOTION_ART } from '../robot/art/registry.ts';
import type { RobotSpec } from '../robot/art/types.ts';

const SIZES = [24, 48, 96, 160, 240] as const;

/** Hidden dev gallery (`#/dev/robots`): every chassis and part at several sizes, both colour schemes side by side. */
export function robotGalleryScreen(_app: App): Screen {
  const root = h('main', { class: 'screen robot-gallery', 'data-testid': 'robot-gallery' });
  const sample = (spec: RobotSpec, size: number, enemy = false, sockets: 'none' | 'empty' = 'none') =>
    h('div', { class: 'rb-stage rb-sample', style: `width:${size}px;height:${size}px` }, robotEl(spec, { enemy, sockets }));
  const row = (title: string, spec: RobotSpec, extra = false) =>
    h('section', { class: 'rb-row' }, h('h3', {}, title), h('div', { class: 'rb-sizes' }, ...SIZES.map((s) => sample(spec, s, false, extra ? 'empty' : 'none')), sample(spec, 96, true), sample(spec, 24, true)));
  const base = { chassis: 'medium', locomotion: 'wheels', gear: [] as string[] };
  const themes = (scheme: 'light' | 'dark') =>
    h(
      'div',
      { class: `rb-theme ${scheme}`, style: `color-scheme:${scheme}` },
      h('h2', {}, scheme),
      h('h3', { class: 'rb-head' }, 'Chassis (empty sockets)'),
      ...Object.keys(CHASSIS_ART).map((c) => row(c, { ...base, chassis: c }, true)),
      h('h3', { class: 'rb-head' }, 'Locomotion (medium chassis)'),
      ...LOCOMOTION_ART.map((p) => row(p.id, { ...base, locomotion: p.id })),
      h('h3', { class: 'rb-head' }, 'Gear (light chassis; front or top socket)'),
      ...GEAR_ART.flatMap((p) => {
        const spec = { chassis: 'light', locomotion: 'wheels', gear: [p.id] };
        const tiers: [string, RobotSpec][] = [[p.id, spec]];
        if (p.id === 'blaster') tiers.push(['blaster Mk II', { ...spec, mark: 2 }]);
        if (p.id === 'eyes') tiers.push(['eyes + wide', { ...spec, wide: true }], ['eyes + wide + scanner', { ...spec, wide: true, scanner: true }]);
        return tiers.map(([title, s]) => row(title, s));
      }),
      h('h3', { class: 'rb-head' }, 'Full builds'),
      row('light: blaster + eyes', { chassis: 'light', locomotion: 'wheels', gear: ['blaster', 'eyes'] }),
      row('light: hammer + shield, legs', { chassis: 'light', locomotion: 'legs', gear: ['hammer', 'shield'] }),
      row('medium: cannon + eyes + plates, treads', { chassis: 'medium', locomotion: 'treads', gear: ['cannon', 'eyes', 'plates'], wide: true }),
      row('medium: blaster Mk II + gps + shield, legs', { chassis: 'medium', locomotion: 'legs', gear: ['blaster', 'gps', 'shield'], mark: 2 }),
      row('heavy: all, hover', { chassis: 'heavy', locomotion: 'hover', gear: ['cannon', 'eyes', 'plates', 'shield'], wide: true, scanner: true }),
    );
  root.append(h('h1', {}, 'Robot art gallery'), h('div', { class: 'rb-themes' }, themes('light'), themes('dark')));
  return { root };
}
