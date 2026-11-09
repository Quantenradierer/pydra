import { describe, expect, it } from 'vitest';
import { GEAR, LOCOMOTIONS, START_BUILD, type Build, type ChassisId } from '../build.ts';
import { muzzleOf, robotSvg, specOf } from './compose.ts';
import { CHASSIS_ART, GEAR_ART, LOCOMOTION_ART, PART_ART, partArt } from './registry.ts';
import { anchorPoint, assignSockets, emptySockets, paintOrder, socketTransform, turnedPoint } from './sockets.ts';
import { BODY_LAYER } from './types.ts';

describe('socket math', () => {
  it('writes a transform in the order translate, rotate, scale', () => {
    expect(socketTransform({ x: 70, y: 50, rot: 0, scale: 1, layer: 1 })).toBe('translate(70 50)');
    expect(socketTransform({ x: 50, y: 30, rot: -90, scale: 0.5, layer: 1 })).toBe('translate(50 30) rotate(-90) scale(0.5)');
  });
  it('anchors a part point in the chassis box', () => {
    expect(anchorPoint({ x: 70, y: 50, rot: 0, scale: 1, layer: 1 }, { x: 20, y: 0 })).toEqual({ x: 90, y: 50 });
    expect(anchorPoint({ x: 70, y: 50, rot: 0, scale: 0.5, layer: 1 }, { x: 20, y: 4 })).toEqual({ x: 80, y: 52 });
    expect(anchorPoint({ x: 50, y: 30, rot: -90, scale: 1, layer: 1 }, { x: 10, y: 0 })).toEqual({ x: 50, y: 20 });
    expect(anchorPoint({ x: 30, y: 50, rot: 180, scale: 2, layer: 1 }, { x: 5, y: 1 })).toEqual({ x: 20, y: 48 });
  });
  it('turns a point with the robot', () => {
    expect(turnedPoint({ x: 80, y: 50 }, 'E')).toEqual({ x: 80, y: 50 });
    expect(turnedPoint({ x: 80, y: 50 }, 'S')).toEqual({ x: 50, y: 80 });
    expect(turnedPoint({ x: 80, y: 50 }, 'W')).toEqual({ x: 20, y: 50 });
    expect(turnedPoint({ x: 80, y: 50 }, 'N')).toEqual({ x: 50, y: 20 });
  });
  it('paints low layers first and keeps the order of equal layers', () => {
    const items = [{ id: 'a', socket: { layer: 40 } }, { id: 'b', socket: { layer: 0 } }, { id: 'c', socket: { layer: 40 } }, { id: 'd', socket: { layer: 10 } }];
    expect((paintOrder(items as never[]) as typeof items).map((i) => i.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('registry', () => {
  it('has art for every locomotion and gear id of the game', () => {
    for (const id of [...LOCOMOTIONS, ...GEAR]) expect(PART_ART[id], id).toBeDefined();
    for (const c of ['light', 'medium']) expect(CHASSIS_ART[c], c).toBeDefined();
  });
  it('keys parts by their own id and gives every chassis a full socket set', () => {
    for (const [key, p] of Object.entries(PART_ART)) expect(p.id).toBe(key);
    for (const c of Object.values(CHASSIS_ART)) {
      for (const name of ['top', 'front', 'back', 'left', 'right', 'underside'] as const) expect(c.sockets[name], `${c.id}.${name}`).toBeDefined();
      expect(c.sockets.underside.layer).toBeLessThan(BODY_LAYER);
      for (const s of c.slots) expect(c.sockets[s].layer).toBeGreaterThan(BODY_LAYER);
    }
    expect(CHASSIS_ART.light!.slots.length).toBe(2);
    expect(CHASSIS_ART.medium!.slots.length).toBe(3);
  });
  it('lets every gear part use at least one slot of every chassis', () => {
    for (const c of Object.values(CHASSIS_ART)) for (const p of GEAR_ART) expect(p.fits.some((s) => c.slots.includes(s)), `${c.id}/${p.id}`).toBe(true);
    for (const p of LOCOMOTION_ART) expect(p.fits).toEqual(['underside']);
  });
});

describe('assignment', () => {
  const gearSets = (): string[][] => {
    const out: string[][] = [[]];
    for (const a of GEAR) {
      out.push([a]);
      for (const b of GEAR) if (a < b) out.push([a, b]);
    }
    return out;
  };
  it('puts any two gear items on the light chassis in different slots', () => {
    for (const set of gearSets()) {
      const got = assignSockets(CHASSIS_ART.light!, set, partArt);
      expect(got.size).toBe(set.length);
      expect(new Set(got.values()).size).toBe(set.length);
      for (const [id, s] of got) expect(partArt(id)!.fits, `${set} ${id}`).toContain(s);
    }
  });
  it('lists the slots that stay empty', () => {
    const light = CHASSIS_ART.light!;
    expect(emptySockets(light, assignSockets(light, ['blaster'], partArt))).toHaveLength(1);
    expect(emptySockets(light, assignSockets(light, [], partArt))).toEqual(['front', 'top']);
    expect(emptySockets(CHASSIS_ART.medium!, assignSockets(CHASSIS_ART.medium!, ['blaster', 'eyes', 'gps'], partArt))).toEqual([]);
  });
  it('is deterministic', () => {
    const a = [...assignSockets(CHASSIS_ART.medium!, ['gps', 'cannon', 'plates'], partArt)];
    expect(a).toEqual([...assignSockets(CHASSIS_ART.medium!, ['gps', 'cannon', 'plates'], partArt)]);
  });
});

describe('composition', () => {
  const build = (o: Partial<Build>): Build => ({ ...START_BUILD, ...o });
  const partsIn = (svg: string) => [...svg.matchAll(/data-part="([a-z]+)"/g)].map((m) => m[1]);
  it('draws the locomotion and every chosen gear item exactly once', () => {
    for (const l of LOCOMOTIONS) {
      const svg = robotSvg(specOf(build({ locomotion: l })));
      expect(partsIn(svg)).toContain(l);
      for (const other of LOCOMOTIONS.filter((x) => x !== l)) expect(partsIn(svg)).not.toContain(other);
    }
    const svg = robotSvg(specOf(build({ chassis: 'medium', gear: ['cannon', 'shield', 'gps'] })));
    expect(partsIn(svg).filter((p) => p !== 'wheels').sort()).toEqual(['cannon', 'gps', 'shield']);
  });
  it('is different for every locomotion, every weapon and both chassis', () => {
    const all = new Set<string>();
    for (const l of LOCOMOTIONS) all.add(robotSvg(specOf(build({ locomotion: l }))));
    for (const g of GEAR) all.add(robotSvg(specOf(build({ gear: [g] }))));
    for (const c of ['light', 'medium'] as ChassisId[]) all.add(robotSvg(specOf(build({ chassis: c, gear: [] }))));
    expect(all.size).toBe(LOCOMOTIONS.length + GEAR.length + 2);
  });
  it('shows tiers: Mk II blaster, wide and scanner eyes', () => {
    const mk1 = robotSvg(specOf(build({ gear: ['blaster'] })));
    const mk2 = robotSvg(specOf(build({ gear: ['blaster'], blasterMark: 2 })));
    expect(mk2).not.toBe(mk1);
    const eyes = robotSvg(specOf(build({ gear: ['eyes'] })));
    const wide = robotSvg(specOf(build({ gear: ['eyes'], addons: ['wide'] })));
    const scan = robotSvg(specOf(build({ gear: ['eyes'], addons: ['wide', 'scanner'] })));
    expect(new Set([eyes, wide, scan]).size).toBe(3);
    expect(scan).toContain('rb-scan');
    expect(eyes).not.toContain('rb-scan');
  });
  it('shows empty slots as plugs (and none when full)', () => {
    const count = (svg: string) => (svg.match(/class="rb-plug"/g) ?? []).length;
    expect(count(robotSvg(specOf(build({ gear: ['blaster'] })), { sockets: 'empty' }))).toBe(1);
    expect(count(robotSvg(specOf(build({ gear: ['blaster', 'eyes'] })), { sockets: 'empty' }))).toBe(0);
    expect(count(robotSvg(specOf(build({ chassis: 'medium', gear: [] })), { sockets: 'empty' }))).toBe(3);
    expect(count(robotSvg(specOf(build({ gear: [] }))))).toBe(0);
  });
  it('marks new parts for the snap-in and enemies for the red palette', () => {
    const svg = robotSvg(specOf(build({})), { snap: ['blaster'], enemy: true });
    expect(svg.match(/rb-snap/g)).toHaveLength(1);
    expect(svg).toContain('rb-enemy');
  });
  it('paints the locomotion behind the body and gear in front of it', () => {
    const svg = robotSvg(specOf(build({})));
    expect(svg.indexOf('rb-part-wheels')).toBeLessThan(svg.indexOf('rb-body'));
    expect(svg.indexOf('rb-body')).toBeLessThan(svg.indexOf('rb-part-blaster'));
  });
  it('finds the muzzle of a weapon in the box', () => {
    const m = muzzleOf(specOf(build({})), 'blaster')!;
    expect(m.x).toBeGreaterThan(70);
    expect(m.y).toBeCloseTo(50, 5);
    expect(muzzleOf(specOf(build({})), 'cannon')).toBeUndefined();
  });
  it('draws unknown ids without crashing (art may lag behind the game)', () => {
    expect(() => robotSvg({ chassis: 'nope', locomotion: 'nope', gear: ['nope'] })).not.toThrow();
  });
});
