import { describe, expect, it } from 'vitest';
import { apiEntries } from './api.ts';
import { START_BUILD } from './build.ts';
import { MESSAGES } from '../i18n.ts';

describe('apiEntries', () => {
  it('lists only what the build has', () => {
    const sigs = (b = START_BUILD) => apiEntries(b).map((e) => e.sig);
    expect(sigs()).toContain('forward(steps)');
    expect(sigs()).toContain('fire()');
    expect(sigs()).not.toContain('smash()');
    expect(sigs({ ...START_BUILD, locomotion: 'legs' }).join(' ')).toContain('move_north');
    expect(sigs({ ...START_BUILD, gear: ['cannon', 'eyes'] })).toContain('fire(power)');
  });

  it('has a text for every entry in both languages', () => {
    for (const e of apiEntries({ chassis: 'medium', locomotion: 'wheels', gear: ['blaster', 'eyes', 'hammer'], addons: ['wide', 'scanner'], blasterMark: 2 })) {
      expect(MESSAGES.de[`robot.api.${e.id}`]).toBeTruthy();
    }
  });
});
