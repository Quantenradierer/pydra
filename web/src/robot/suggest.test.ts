import { describe, expect, it } from 'vitest';
import { START_BUILD, type Build } from './build.ts';
import { applySuggestion, completionAt, insertSnippet, localNames, snippetGroups } from './suggest.ts';

const legs: Build = { chassis: 'medium', locomotion: 'legs', gear: ['cannon', 'shield', 'gps'], addons: [], blasterMark: 1 };
const names = (text: string, build: Build = START_BUILD, manual = false) => completionAt(text, text.length, build, { manual })?.items.map((i) => i.label) ?? [];

describe('completionAt', () => {
  it('stays quiet when nothing is typed, and on request offers everything', () => {
    expect(completionAt('', 0, START_BUILD)).toBeNull();
    expect(names('', START_BUILD, true)).toContain('forward(steps)');
  });
  it('matches by prefix first, then by substring, and offers the equipped commands', () => {
    const l = names('fo');
    expect(l[0]).toBe('forward(steps)');
    expect(l).toContain('for');
    expect(names('ee')).toContain('see()');
  });
  it('offers only commands the build has, but lists unequipped parts last', () => {
    expect(names('move_')).toEqual([]);
    expect(names('move_', legs)).toContain('move_north(steps)');
    expect(names('forw', legs)).toEqual([]);
    const all = completionAt('ha', 2, START_BUILD)!.items;
    const hammer = all.find((i) => i.name === 'hammer')!;
    expect(hammer.equipped).toBe(false);
    expect(completionAt('b', 1, START_BUILD)!.items[0]!.name).toBe('backward');
  });
  it('completes methods after a dot, with signatures', () => {
    expect(names('blaster.')).toEqual(['blaster.fire()', 'blaster.is_charged()', 'blaster.cooldown()', 'blaster.mark()']);
    expect(names('cannon.f', legs)).toEqual(['cannon.fire(power)']);
    expect(names('eyes.s')).toContain('eyes.see()');
    expect(names('blaster.he', { ...START_BUILD, blasterMark: 2 })).toEqual(['blaster.heat()']);
    expect(names('tree.')).toEqual([]);
  });
  it('offers keywords and local names, not inside strings or comments', () => {
    expect(names('wh')).toContain('while');
    expect(names('count = 3\nco')).toContain('count');
    expect(names('for step in range(3):\n    st')).toContain('step');
    expect(names('say("fo')).toEqual([]);
    expect(names('# fo')).toEqual([]);
  });
  it('gives every suggestion a description (except variables)', () => {
    for (const i of completionAt('', 0, START_BUILD, { manual: true })!.items) expect(i.kind === 'variable' || i.desc).toBeTruthy();
  });
  it('stays quiet once a plain word is complete', () => {
    expect(names('else')).toEqual([]);
  });
});

describe('applySuggestion', () => {
  it('replaces the typed word and puts the caret into the parentheses of calls with an argument', () => {
    const c = completionAt('fo', 2, START_BUILD)!;
    const r = applySuggestion('fo', c, c.items[0]!);
    expect(r).toEqual({ text: 'forward()', caret: 8 });
    const c2 = completionAt('x = h', 5, START_BUILD)!;
    expect(applySuggestion('x = h', c2, c2.items.find((i) => i.name === 'hp')!)).toEqual({ text: 'x = hp()', caret: 8 });
  });
  it('does not double existing parentheses', () => {
    const c = completionAt('fo(1)', 2, START_BUILD)!;
    expect(applySuggestion('fo(1)', c, c.items[0]!).text).toBe('forward(1)');
  });
});

describe('localNames', () => {
  it('finds assignments, loop variables, functions and parameters', () => {
    expect(localNames('a = 1\nb += 2\nfor i in range(3):\n    c = a == b\ndef go(x, y):\n    return x').sort()).toEqual(['a', 'b', 'c', 'go', 'i', 'x', 'y']);
  });
});

describe('snippets', () => {
  it('are organised by the gear of the build', () => {
    expect(snippetGroups(START_BUILD).map((g) => g.id)).toEqual(['flow', 'compare', 'move', 'blaster', 'eyes', 'basics']);
    expect(snippetGroups(legs).map((g) => g.id)).toEqual(['flow', 'compare', 'move', 'cannon', 'shield', 'gps', 'basics']);
    const move = snippetGroups(legs).find((g) => g.id === 'move')!;
    expect(move.snippets.map((s) => s.label)).toContain('move_north(1)');
    expect(snippetGroups(START_BUILD).find((g) => g.id === 'eyes')!.snippets.map((s) => s.label)).toContain('see_left()');
  });
  it('insert at the caret, indent continuation lines and place the caret', () => {
    const forLoop = snippetGroups(START_BUILD)[0]!.snippets.find((s) => s.label === 'for')!;
    expect(insertSnippet('', 0, 0, forLoop)).toEqual({ text: 'for i in range(3):\n    ', caret: 23 });
    const r = insertSnippet('while alive():\n    ', 19, 19, forLoop);
    expect(r.text).toBe('while alive():\n    for i in range(3):\n        ');
    expect(r.caret).toBe(r.text.length);
  });
  it('start a new line when a statement is inserted behind code, and replace a selection', () => {
    const ifs = snippetGroups(START_BUILD)[0]!.snippets[0]!;
    expect(insertSnippet('forward()', 9, 9, ifs).text).toBe('forward()\nif alive():\n    ');
    const call = snippetGroups(START_BUILD).find((g) => g.id === 'move')!.snippets[0]!;
    expect(insertSnippet('abc', 0, 3, call)).toEqual({ text: 'forward()', caret: 8 });
  });
});
