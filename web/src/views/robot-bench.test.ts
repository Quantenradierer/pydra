import { describe, expect, it } from 'vitest';
import { START_BUILD, type Build } from '../robot/build.ts';
import { gearForSocket } from './robot-bench.ts';

describe('gearForSocket', () => {
  const empty: Build = { ...START_BUILD, gear: [] };
  it('offers parts that click into the tapped socket first', () => {
    const { here } = gearForSocket(empty, 'front');
    expect(here).toContain('blaster');
    expect(here).toContain('hammer');
    expect(here).not.toContain('eyes');
    expect(gearForSocket(empty, 'top').here).toContain('eyes');
  });
  it('lists the rest as elsewhere, offers every part (nothing is locked) and hides equipped parts', () => {
    const r = gearForSocket({ ...empty, gear: ['blaster'] }, 'top');
    expect(r.here).not.toContain('blaster');
    expect([...r.here, ...r.elsewhere]).toContain('cannon');
    expect([...r.here, ...r.elsewhere]).not.toContain('blaster');
  });
});
