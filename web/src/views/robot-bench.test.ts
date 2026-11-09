import { describe, expect, it } from 'vitest';
import { START_BUILD, type Build } from '../robot/build.ts';
import { gearForSocket } from './robot-bench.ts';

const all = () => true;
describe('gearForSocket', () => {
  const empty: Build = { ...START_BUILD, gear: [] };
  it('offers parts that click into the tapped socket first', () => {
    const { here } = gearForSocket(empty, 'front', all);
    expect(here).toContain('blaster');
    expect(here).toContain('hammer');
    expect(here).not.toContain('eyes');
    expect(gearForSocket(empty, 'top', all).here).toContain('eyes');
  });
  it('lists the rest as elsewhere, and hides locked or equipped parts', () => {
    const r = gearForSocket({ ...empty, gear: ['blaster'] }, 'top', (g) => g !== 'cannon');
    expect(r.here).not.toContain('blaster');
    expect([...r.here, ...r.elsewhere]).not.toContain('cannon');
    expect([...r.here, ...r.elsewhere]).not.toContain('blaster');
  });
});
