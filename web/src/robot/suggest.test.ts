import { describe, expect, it } from 'vitest';
import { START_BUILD, type Build } from './build.ts';
import { applySuggestion, completionAt, insertSnippet, localNames, nextSnippets, snippetGroups } from './suggest.ts';

const legs: Build = { chassis: 'medium', locomotion: 'legs', gear: ['cannon', 'shield', 'gps'], addons: [], blasterMark: 1 };
const names = (text: string, build: Build = START_BUILD, manual = false) => completionAt(text, text.length, build, { manual })?.items.map((i) => i.label) ?? [];

describe('completionAt', () => {
  it('stays quiet behind code, on a blank line offers the next commands, on request everything', () => {
    expect(completionAt('fire() ', 7, START_BUILD)).toBeNull();
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
    expect(names('print("fo')).toEqual([]);
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
  describe('insertSnippet', () => {
    const g = snippetGroups(START_BUILD);
    const snip = (group: string, label: string) => g.find((x) => x.id === group)!.snippets.find((s) => s.label === label)!;
    const fwd = snip('move', 'forward(1)');
    const back = snip('move', 'backward(1)');
    const ifs = snip('flow', 'if');
    const forLoop = snip('flow', 'for');
    const at = (text: string, caret: number, s = fwd, end = caret) => insertSnippet(text, caret, end, s);

    it('empty line: the snippet goes there, the caret lands on $0', () => {
      expect(at('', 0)).toEqual({ text: 'forward()', caret: 8 });
      expect(at('fire()\n', 7)).toEqual({ text: 'fire()\nforward()', caret: 15 });
      expect(at('', 0, forLoop)).toEqual({ text: 'for i in range(3):\n    ', caret: 23 });
    });
    it('keeps the indent of an empty indented line, and adds one level after a colon line', () => {
      const r = at('while alive():\n    ', 19, forLoop);
      expect(r.text).toBe('while alive():\n    for i in range(3):\n        ');
      expect(r.caret).toBe(r.text.length);
      expect(at('while alive():\n', 15).text).toBe('while alive():\n    forward()');
    });
    it('end of a non-empty line: a NEW line below, never forward()backward()', () => {
      expect(at('forward()', 9, back)).toEqual({ text: 'forward()\nbackward()', caret: 19 });
      expect(at('forward()', 9, ifs).text).toBe('forward()\nif alive():\n    ');
    });
    it('tapping forward() then backward() gives two lines (the caret sits inside the first call)', () => {
      const one = at('', 0);
      const two = at(one.text, one.caret, back);
      expect(two.text).toBe('forward()\nbackward()');
      const three = at(two.text, two.caret, fwd);
      expect(three.text).toBe('forward()\nbackward()\nforward()');
    });
    it('mid-line: below the whole line, the line is not split; text below stays', () => {
      expect(at('forward()\nfire()', 4, back).text).toBe('forward()\nbackward()\nfire()');
      expect(at('  forward()\nfire()', 5, back).text).toBe('  forward()\n  backward()\nfire()');
    });
    it('after a colon: the new line is indented by 4 more, a block snippet puts the caret in its body', () => {
      const r = at('while alive():', 14, fwd);
      expect(r.text).toBe('while alive():\n    forward()');
      const nested = at('while alive():', 14, ifs);
      expect(nested.text).toBe('while alive():\n    if alive():\n        ');
      expect(nested.caret).toBe(nested.text.length);
      expect(at('    if x:', 9, back).text).toBe('    if x:\n        backward()');
    });
    it('partial word: the typed word is replaced', () => {
      expect(at('fo', 2)).toEqual({ text: 'forward()', caret: 8 });
      expect(at('    for', 7, forLoop).text).toBe('    for i in range(3):\n        ');
      expect(at('forward()\nback', 14, back).text).toBe('forward()\nbackward()');
    });
    it('selection: the selected text is replaced', () => {
      expect(at('abc', 0, fwd, 3)).toEqual({ text: 'forward()', caret: 8 });
      expect(at('fire()\nabc\nfire()', 7, back, 10).text).toBe('fire()\nbackward()\nfire()');
    });
    it('values go inline where one is expected, operators at the caret', () => {
      const dist = { label: 'distance()', text: 'distance()$0' };
      expect(at('x = ', 4, dist).text).toBe('x = distance()');
      expect(at('if d', 4, snip('compare', '<')).text).toBe('if d < ');
      expect(at('if d ', 5, snip('compare', '<')).text).toBe('if d < ');
    });
  });
  it('offers the next sensible commands on a fresh line (equipped gear first, no unequipped parts)', () => {
    for (const text of ['', 'forward()\n', 'if alive():\n    ']) {
      const c = completionAt(text, text.length, START_BUILD)!;
      expect(c.fresh).toBe(true);
      expect(c.items[0]!.kind).toBe('command');
      expect(c.items.every((i) => i.equipped)).toBe(true);
    }
    expect(names('', START_BUILD)).toContain('forward(steps)');
    // Behind code on the same line nothing opens by itself.
    expect(completionAt('forward()', 9, START_BUILD)).toBeNull();
    expect(completionAt('fo', 2, START_BUILD)!.fresh).toBeFalsy();
  });
});

describe('nextSnippets (the strip while nothing is typed)', () => {
  it('starts with moving, then the weapon and the eyes, then Python shapes; no duplicates', () => {
    const labels = nextSnippets(START_BUILD).map((s) => s.label);
    expect(labels.slice(0, 2)).toEqual(['forward(1)', 'backward(1)']);
    expect(labels).toContain('fire()');
    expect(labels).toContain('see()');
    expect(labels).toEqual(expect.arrayContaining(['if', 'while', 'for']));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.length).toBeLessThanOrEqual(14);
  });
});
