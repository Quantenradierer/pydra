import { describe, expect, it } from 'vitest';
import { judge } from './game.ts';
import { extractDefs, feedProblem, LESSON_IDS, LESSONS, lessonById, machinesText, makePlateProblem, makePlatesProblem, type Lesson, type LessonId } from './lessons.ts';
import { problemText } from './friendly.ts';
import { MESSAGES } from '../i18n.ts';

const ref = (id: LessonId) => lessonById(id)!.reference;
/** "Your machines" made of the reference solutions of G4 and S4. */
const refMachines = (lesson: Lesson) => machinesText(lesson, (id) => ref(id));
const run = (id: LessonId, text: string) => {
  const lesson = lessonById(id)!;
  return judge(lesson, text, refMachines(lesson));
};

describe('the lessons', () => {
  it('are the eleven of the first layer, in a graph with G1 and S1 at the bottom', () => {
    expect(LESSONS.map((l) => l.id)).toEqual([...LESSON_IDS]);
    expect(LESSONS.filter((l) => l.needs.length === 0).map((l) => l.id)).toEqual(['G1', 'S1']);
    expect(lessonById('B1')!.needs).toEqual(['G4', 'S4']);
    for (const l of LESSONS) for (const n of l.needs) expect(LESSON_IDS.indexOf(n), `${l.id} needs ${n}`).toBeLessThan(LESSON_IDS.indexOf(l.id));
  });

  it('carry code up their own branch only', () => {
    expect(Object.fromEntries(LESSONS.map((l) => [l.id, l.carryFrom ?? null]))).toEqual({ G1: null, G2: 'G1', G3: 'G2', G4: 'G3', S1: null, S2: 'S1', S3: 'S2', S4: 'S3', B1: null, B2: 'B1', B3: 'B2' });
  });

  for (const lesson of LESSONS) {
    it(`${lesson.id}: the reference solution passes on every belt`, () => {
      const r = run(lesson.id, lesson.reference);
      expect(r.problem && problemText(r.problem, 'en')).toBeUndefined();
      expect(r.passed).toBe(true);
      expect(r.belts).toHaveLength(lesson.belts.length);
      for (const b of r.belts) expect(b.met).toBe(true);
    });

    for (const below of lesson.needs) {
      it(`${lesson.id}: the reference solution of ${below} does not pass (the old code fails first)`, () => {
        expect(run(lesson.id, ref(below)).passed).toBe(false);
      });
    }

    it(`${lesson.id}: has a title and a task in both languages`, () => {
      for (const lang of ['de', 'en'] as const) {
        expect(lesson.title[lang].trim()).not.toBe('');
        expect(lesson.task[lang].trim()).not.toBe('');
      }
    });
  }

  it('fail first the way the doc promises', () => {
    // G2: the G1 code grabs air on the second start; the second ore stays on the belt.
    const g2 = run('G2', ref('G1'));
    expect(g2.failure).toBe('order');
    expect(g2.belts[0]!.final).toMatchObject({ ore: 1, belt: [{ kind: 'ore' }] });
    expect(run('G3', ref('G2'))).toMatchObject({ failure: 'error', problem: { code: 'coal-in-ore-hatch' } });
    expect(run('G4', ref('G3'))).toMatchObject({ failure: 'check', problem: { code: 'def-missing' } });
    expect(run('S2', ref('S1'))).toMatchObject({ failure: 'error', problem: { code: 'need-ore', params: { have: 1 } } });
    expect(run('S3', ref('S2'))).toMatchObject({ failure: 'error', problem: { code: 'need-coal' } });
    expect(run('S4', ref('S3'))).toMatchObject({ failure: 'check', problem: { code: 'def-missing' } });
    // The G4 code defines feed again, which "Your machines" already has.
    expect(run('B1', ref('G4'))).toMatchObject({ failure: 'precheck', problem: { kind: 'reserved', name: 'feed', from: 'machines' } });
    expect(run('B1', ref('S4'))).toMatchObject({ failure: 'precheck', problem: { kind: 'reserved', name: 'make_plate', from: 'machines' } });
    expect(run('B1', 'feed()\nfeed()\nfeed()\nsmelt()')).toMatchObject({ failure: 'precheck', problem: { kind: 'machines-only', name: 'smelt' } });
    expect(run('B2', ref('B1'))).toMatchObject({ failure: 'order' });
    expect(run('B3', ref('B2'))).toMatchObject({ failure: 'check', problem: { code: 'def-missing' } });
  });

  it('G1: the typical mistakes are visible', () => {
    expect(run('G1', 'grab()\nturn()\ndrop()').problem).toMatchObject({ code: 'ore-in-bunker', line: 3 });
    expect(run('G1', 'grab()\nturn()\nturn()\nturn()\ndrop()').problem).toMatchObject({ code: 'nothing-there', line: 5 });
    const empty = run('G1', 'turn()\nturn()\ndrop()');
    expect([empty.failure, empty.problem]).toEqual(['order', undefined]);
  });

  it('B2: writing the lines out n times cannot pass, n differs between the belts', () => {
    const twice = 'feed()\nfeed()\nfeed()\nmake_plate(ore, coal)\n'.repeat(2);
    const r = run('B2', twice);
    expect(r.passed).toBe(false);
    expect([r.play, r.otherBelt]).toEqual([1, true]);
  });

  it('B2: every belt has one group more than ordered, and the order is exact: only range(n) passes', () => {
    const block = 'feed()\nfeed()\nfeed()\nmake_plate(ore, coal)\n';
    const loop = (times: string) => `for i in range(${times}):\n${block.replace(/^/gm, '    ')}`;
    for (const [name, code] of [
      ['three copies', block.repeat(3)],
      ['range(3)', loop('3')],
      ['range(10)', loop('10')],
    ] as const) {
      const r = run('B2', code);
      expect(r.passed, name).toBe(false);
      expect(r.failure, name).toBe('order');
    }
    // Three copies make three plates where two are ordered.
    expect(run('B2', block.repeat(3)).belts[0]!.final.plates).toBe(3);
    // The reference leaves a group on the belt; that does not count against the order.
    const ok = run('B2', ref('B2'));
    expect(ok.passed).toBe(true);
    for (const b of ok.belts) expect(b.final.belt).toHaveLength(3);
  });

  it('B3: a fixed range inside make_plates does not pass', () => {
    const r = run('B3', 'def make_plates(n):\n    for i in range(3):\n        feed()\n        feed()\n        feed()\n        make_plate(ore, coal)\n\nmake_plates(n)');
    expect(r.passed).toBe(false);
  });

  it('a forgotten or indented call is named, not just "the order is not met"', () => {
    const body = ref('G3').replace(/^/gm, '    ');
    expect(run('G4', `def feed():\n${body}`)).toMatchObject({ failure: 'check', problem: { code: 'not-called', params: { name: 'feed' } } });
    expect(run('G4', `def feed():\n${body}\n    feed()`)).toMatchObject({ failure: 'check', problem: { code: 'not-called' } });
    expect(run('S4', 'def make_plate(ore, coal):\n    if ore >= 2 and coal >= 1:\n        smelt()')).toMatchObject({ failure: 'check', problem: { code: 'not-called', params: { name: 'make_plate' } } });
    expect(run('B3', `def make_plates(n):\n${ref('B2').replace(/^/gm, '    ')}`)).toMatchObject({ failure: 'check', problem: { code: 'not-called', params: { name: 'make_plates' } } });
    // Misnamed and never called: the name is missing.
    const missing = run('G4', `def sort():\n${body}`);
    expect(missing).toMatchObject({ failure: 'check', problem: { code: 'def-missing' } });
    expect(problemText(missing.problem!, 'en')).toBe('feed is missing: put your code into def feed(): and call feed().');
    // A plain wrong order in a lesson without such a function stays "order".
    expect(run('G2', ref('G1')).failure).toBe('order');
  });

  it('a def or parameter must not hide a command or a machine', () => {
    expect(run('B1', 'def turn():\n    pass\nfeed()\nfeed()\nfeed()\nmake_plate(ore, coal)')).toMatchObject({ failure: 'precheck', problem: { kind: 'reserved', name: 'turn', from: 'factory' } });
    expect(run('B1', 'def make_plate(a, b):\n    pass\nfeed()')).toMatchObject({ failure: 'precheck', problem: { kind: 'reserved', name: 'make_plate', from: 'machines' } });
    expect(run('G3', 'def drop():\n    pass\ngrab()')).toMatchObject({ failure: 'precheck', problem: { kind: 'reserved', name: 'drop' } });
  });

  it('only use names they have', () => {
    expect(run('G1', 'grab()\nif is_coal():\n    drop()').failure).toBe('precheck');
    expect(run('G3', 'smelt()').failure).toBe('precheck');
    expect(run('S1', 'grab()').failure).toBe('precheck');
    expect(run('B1', 'for i in range(n):\n    feed()').failure).toBe('precheck');
    expect(run('S1', 'ore = 2\nsmelt()')).toMatchObject({ failure: 'precheck', problem: { kind: 'read-only', name: 'ore' } });
  });
});

describe('G3: other correct shapes pass too (the picture is the test)', () => {
  const shapes = {
    'one shared first turn': 'grab()\nturn()\nif is_coal():\n    drop()\n    turn()\n    turn()\n    turn()\nelse:\n    turn()\n    drop()\n    turn()\n    turn()',
    'turning back after the if': 'grab()\nturn()\nif is_coal():\n    drop()\n    turn()\nelse:\n    turn()\n    drop()\nturn()\nturn()',
    'not is_coal() first': 'grab()\nif not is_coal():\n    turn()\n    turn()\n    drop()\n    turn()\n    turn()\nelse:\n    turn()\n    drop()\n    turn()\n    turn()\n    turn()',
    'a loop for the turns': 'grab()\nif is_coal():\n    turn()\n    drop()\n    for i in range(3):\n        turn()\nelse:\n    for i in range(2):\n        turn()\n    drop()\n    turn()\n    turn()',
  };
  for (const [name, code] of Object.entries(shapes)) {
    it(name, () => expect(run('G3', code).passed).toBe(true));
  }

  it('a shape that ends facing the wrong way does not', () => {
    expect(run('G3', 'grab()\nif is_coal():\n    turn()\n    drop()\nelse:\n    turn()\n    turn()\n    drop()').passed).toBe(false);
  });
});

describe('G4: feed()', () => {
  const body = ref('G3').replace(/^/gm, '    ');
  it('passes when feed is defined, called and does one item per call', () => {
    expect(run('G4', `def feed():\n${body}\n\nfeed()`).passed).toBe(true);
    // A comment between the def and the call is fine.
    expect(run('G4', `# my grabber\ndef feed():\n${body}\n# go\nfeed()`).passed).toBe(true);
  });

  it('rejects a missing, misnamed or uncalled feed', () => {
    expect(run('G4', `def sort():\n${body}\n\nsort()`).problem).toMatchObject({ kind: 'check', code: 'def-missing', params: { name: 'feed' } });
    expect(run('G4', `def feed():\n${body}\n\nfeed()\n`.replace('def feed():', 'def feed(x=0):')).problem).toMatchObject({ code: 'def-params' });
    expect(run('G4', `def feed():\n${body}\n\n${ref('G3')}`).problem).toMatchObject({ code: 'not-called' });
  });

  it('rejects machine commands at the top level', () => {
    // feed() leaves the grabber facing the bunker; the top level turns it back.
    const code = 'def feed():\n    grab()\n    if is_coal():\n        turn()\n        drop()\n        turn()\n        turn()\n    else:\n        turn()\n        turn()\n        drop()\n        turn()\nfeed()\nturn()';
    const r = run('G4', code);
    expect(r.passed).toBe(false);
    expect(r.problem).toMatchObject({ code: 'top-level-command', params: { name: 'turn', line: 14 } });
    expect(problemText(r.problem!, 'en')).toBe("Don't use machine commands outside feed(): turn() belongs inside feed() (line 14).");
    expect(problemText(r.problem!, 'de')).toBe('Außerhalb von feed() soll kein Maschinenbefehl stehen: turn() gehört in feed() (Zeile 14).');
  });

  it('rejects commands that run outside feed() through a helper', () => {
    // feed() leaves the grabber facing the smelter; back() at the top level turns it to the belt.
    const code = 'def back():\n    turn()\n    turn()\ndef feed():\n    grab()\n    if is_coal():\n        turn()\n        drop()\n        turn()\n    else:\n        back()\n        drop()\nfeed()\nback()';
    const r = run('G4', code);
    expect(r.belts.every((b) => b.met)).toBe(true);
    expect(r.problem).toMatchObject({ code: 'top-level-command', params: { fn: 'feed', name: 'turn', line: 2 } });
  });

  it('rejects a def named make_plate: that is the smelter of S4', () => {
    const r = run('G4', `${ref('G4')}\n\ndef make_plate(ore, coal):\n    pass`);
    expect(r).toMatchObject({ failure: 'precheck', problem: { kind: 'reserved', name: 'make_plate', from: 'S4' } });
  });

  it('rejects a feed that does not move exactly one item per call', () => {
    const twice = (s: string) => `def feed():\n${s}\n\nfeed()`;
    expect(feedProblem(extractDefs(twice(body)))).toBeUndefined();
    expect(feedProblem('def feed():\n    grab()\n    turn()\n    turn()\n    drop()')).toMatchObject({ code: 'feed-one-item' });
  });

  it('names a top-level variable that feed uses: "Your machines" will not have it', () => {
    const k = `k = 2\ndef feed():\n${body.replace('    else:\n        turn()\n        turn()', '    else:\n        for i in range(k):\n            turn()')}\n\nfeed()`;
    const r = run('G4', k);
    expect(r.belts.every((b) => b.met)).toBe(true);
    expect(r.problem).toMatchObject({ kind: 'check', code: 'outside-name', params: { fn: 'feed', name: 'k' } });
    expect(problemText(r.problem!, 'en')).toBe('feed uses "k", which is defined outside the function. Your function must work without the rest of the program.');
    expect(problemText(r.problem!, 'de')).toBe('feed benutzt „k“, und das ist außerhalb der Funktion festgelegt. Deine Funktion muss ohne den Rest des Programms auskommen.');
    const counter = `count = 0\ndef feed():\n    global count\n    count += 1\n${body}\n\nfeed()`;
    expect(run('G4', counter).problem).toMatchObject({ code: 'outside-name', params: { name: 'count' } });
    // ...also when a helper that feed calls reads it.
    const helper = `k = 2\ndef back():\n    for i in range(k):\n        turn()\ndef feed():\n${body.replace('    else:\n        turn()\n        turn()', '    else:\n        back()')}\n\nfeed()`;
    expect(run('G4', helper).problem).toMatchObject({ code: 'outside-name', params: { fn: 'feed', name: 'k' } });
  });

  it('a helper feed never calls is left out of "Your machines", so its top-level variable breaks nothing', () => {
    const code = `k = 2\ndef show():\n    print(k)\n\n${ref('G4')}`;
    expect(run('G4', code).passed).toBe(true);
    const b1 = lessonById('B1')!;
    const machines = machinesText(b1, (id) => (id === 'G4' ? code : ref(id)));
    expect(machines).not.toContain('show');
    expect(judge(b1, ref('B1'), machines).passed).toBe(true);
  });
});

describe('S4: make_plate(ore, coal)', () => {
  it('passes the reference and an equivalent shape', () => {
    expect(run('S4', 'def make_plate(ore, coal):\n    if ore < 2 or coal < 1:\n        return\n    smelt()\n\nmake_plate(ore, coal)').passed).toBe(true);
  });

  it('rejects a missing, wrongly shaped or uncalled make_plate', () => {
    expect(run('S4', 'def plate(ore, coal):\n    if ore >= 2 and coal >= 1:\n        smelt()\nplate(ore, coal)').problem).toMatchObject({ code: 'def-missing' });
    expect(run('S4', 'def make_plate():\n    if ore >= 2 and coal >= 1:\n        smelt()\nmake_plate()').problem).toMatchObject({ code: 'def-params', params: { count: 2 } });
    expect(run('S4', 'def make_plate(ore, coal):\n    if ore >= 2 and coal >= 1:\n        smelt()\nif ore >= 2 and coal >= 1:\n    smelt()').problem).toMatchObject({ code: 'not-called' });
  });

  it('rejects a make_plate that ignores its parameters', () => {
    const r = run('S4', 'def make_plate(x, y):\n    if ore >= 2 and coal >= 1:\n        smelt()\n\nmake_plate(0, 0)');
    expect(r.belts.every((b) => b.met)).toBe(true);
    expect(r).toMatchObject({ failure: 'check', problem: { code: 'make-plate-none', params: { ore: 1, coal: 1 } } });
    expect(problemText(r.problem!, 'en')).toBe('make_plate(1, 1) must make no plate and no error, even when the heaps are full: use the parameters.');
  });

  it('the work is done by make_plate, not by smelt() outside it', () => {
    // smelt() at the top level, as G4 forbids grab() there.
    const top = run('S4', 'def make_plate(ore, coal):\n    if ore >= 2 and coal >= 1:\n        smelt()\n\nmake_plate(0, 0)\nif ore >= 2 and coal >= 1:\n    smelt()');
    expect(top.belts.every((b) => b.met)).toBe(true);
    expect(top.problem).toMatchObject({ code: 'top-level-command', params: { fn: 'make_plate', name: 'smelt', line: 7 } });
    // smelt() in a helper the top level calls; make_plate itself never smelts in the run.
    const helper = run('S4', 'def make_plate(ore, coal):\n    if ore >= 2 and coal >= 1:\n        smelt()\n\ndef go():\n    if ore >= 2 and coal >= 1:\n        smelt()\n\nmake_plate(0, 0)\ngo()');
    expect(helper.belts.every((b) => b.met)).toBe(true);
    expect(helper.problem).toMatchObject({ code: 'top-level-command', params: { fn: 'make_plate', name: 'smelt' } });
  });

  it('rejects a def named feed: that is the grabber of G4', () => {
    const r = run('S4', `${ref('S4')}\n\ndef feed():\n    pass`);
    expect(r).toMatchObject({ failure: 'precheck', problem: { kind: 'reserved', name: 'feed', from: 'G4' } });
  });

  it('calls it with (2, 1), (1, 1) and (2, 0)', () => {
    expect(makePlateProblem(extractDefs(ref('S4')))).toBeUndefined();
    // Ignores coal: smelts cold at (2, 0).
    expect(makePlateProblem('def make_plate(ore, coal):\n    if ore >= 2:\n        smelt()')).toMatchObject({ code: 'make-plate-none', params: { ore: 2, coal: 0 } });
    // Never smelts.
    expect(makePlateProblem('def make_plate(ore, coal):\n    if ore > 2 and coal >= 1:\n        smelt()')).toMatchObject({ code: 'make-plate-one' });
    expect(problemText(makePlateProblem('def make_plate(ore, coal):\n    if ore >= 2:\n        smelt()')!, 'en')).toBe('make_plate(2, 0) must make no plate and no error, even when the heaps are full: use the parameters.');
    // Reads the heaps instead of its parameters.
    expect(makePlateProblem('def make_plate(a, b):\n    if ore >= 2 and coal >= 1:\n        smelt()')).toMatchObject({ code: 'make-plate-none', params: { ore: 1, coal: 1 } });
  });
});

describe('the block lessons', () => {
  it('"Your machines" holds only the definitions of the passing G4 and S4 texts', () => {
    const text = refMachines(lessonById('B1')!);
    expect(text).toContain('def feed():');
    expect(text).toContain('def make_plate(ore, coal):');
    expect(text).not.toMatch(/^feed\(\)/m);
    expect(text).not.toMatch(/^make_plate\(ore, coal\)/m);
    expect(machinesText(lessonById('G2')!, (id) => ref(id))).toBe('');
  });

  it('use whatever feed the learner wrote in G4', () => {
    const otherFeed = 'def feed():\n    grab()\n    turn()\n    if is_coal():\n        drop()\n        turn()\n        turn()\n        turn()\n    else:\n        turn()\n        drop()\n        turn()\n        turn()\n\nfeed()';
    const lesson = lessonById('B1')!;
    const machines = machinesText(lesson, (id) => (id === 'G4' ? otherFeed : ref(id)));
    expect(judge(lesson, ref('B1'), machines).passed).toBe(true);
  });

  it('B1: given commands are not allowed in the own text, even inside an own function', () => {
    expect(run('B1', 'def f():\n    grab()\nfeed()').problem).toMatchObject({ kind: 'machines-only', name: 'grab', line: 2 });
    expect(run('B1', 'feed()\nfeed()\nfeed()\nif ore >= 2 and coal >= 1:\n    smelt()').problem).toMatchObject({ kind: 'machines-only', name: 'smelt', line: 5 });
  });

  it('B3: make_plates must do the work, with its parameter', () => {
    const loop = ref('B2');
    // An empty make_plates and the B2 loop at the top level.
    expect(run('B3', `def make_plates(n):\n    pass\n\nmake_plates(n)\n${loop}`).problem).toMatchObject({ code: 'top-level-command', params: { fn: 'make_plates', name: 'feed', line: 6 } });
    // The parameter is ignored: the function reads the global n.
    const ignores = run('B3', `def make_plates(k):\n${loop.replace(/^/gm, '    ')}\n\nmake_plates(5)`);
    expect(ignores.belts.every((b) => b.met)).toBe(true);
    expect(ignores.problem).toMatchObject({ code: 'make-plates-count', params: { k: 2 } });
    expect(problemText(ignores.problem!, 'en')).toBe('make_plates(2) must make exactly 2 plates, even when n is different: use the parameter.');
    // A loop of make_plates(1) at the top level: make_plates works for every k, so this passes.
    const one = run('B3', `def make_plates(k):\n${loop.replace('range(n)', 'range(k)').replace(/^/gm, '    ')}\n\nfor i in range(n):\n    make_plates(1)`);
    expect(one.passed).toBe(true);
    // An empty make_plates fails the strict run even without top-level commands.
    expect(makePlatesProblem('def make_plates(n):\n    pass', refMachines(lessonById('B3')!))).toMatchObject({ code: 'make-plates-count', params: { k: 2 } });
    // A top-level variable it reads.
    const other = run('B3', `m = n\ndef make_plates(k):\n${loop.replace('range(n)', 'range(m)').replace(/^/gm, '    ')}\n\nmake_plates(n)`);
    expect(other.problem).toMatchObject({ code: 'outside-name', params: { fn: 'make_plates', name: 'm' } });
  });

  it('B3: make_plates must take one parameter and be called', () => {
    const body = ref('B2').replace(/^/gm, '    ');
    expect(run('B3', `def make_plates():\n${body}\n\nmake_plates()`).problem).toMatchObject({ code: 'def-params', params: { count: 1 } });
    expect(problemText(run('B3', `def make_plates():\n${body}\n\nmake_plates()`).problem!, 'en')).toBe('make_plates needs exactly 1 parameter: def make_plates(n):');
    expect(problemText(run('B3', `def make_plates():\n${body}\n\nmake_plates()`).problem!, 'de')).toBe('make_plates braucht genau 1 Parameter: def make_plates(n):');
    expect(run('B3', `def make_plates(n):\n${body}\n\n${ref('B2')}`).problem).toMatchObject({ code: 'not-called' });
    expect(run('B3', `def make_plates(count):\n${ref('B2').replace('range(n)', 'range(count)').replace(/^/gm, '    ')}\n\nmake_plates(n)`).passed).toBe(true);
  });

  it('"Your machines" takes only feed, make_plate and the helpers they reach', () => {
    const g4 = `def back():\n    turn()\n    turn()\n\ndef unused():\n    turn()\n\n${ref('G4').replace('    else:\n        turn()\n        turn()\n        drop()\n        turn()\n        turn()', '    else:\n        back()\n        drop()\n        back()')}`;
    expect(run('G4', g4).passed).toBe(true);
    const b1 = lessonById('B1')!;
    const same = machinesText(b1, (id) => (id === 'G4' ? g4 : ref(id)));
    expect(same).toContain('def back():');
    expect(same).not.toContain('unused');
    expect(judge(b1, ref('B1'), same).passed).toBe(true);
    // S4 with the same helper word for word: it stands there once.
    const s4same = `def back():\n    turn()\n    turn()\n\n${ref('S4').replace('        smelt()', '        smelt()\n    if False:\n        back()')}`;
    const once = machinesText(b1, (id) => (id === 'G4' ? g4 : s4same));
    expect(once.match(/def back\(/g)).toHaveLength(1);
  });

  it('two different helpers with one name in G4 and S4 are reported in the block lessons', () => {
    const g4 = `def back():\n    turn()\n    turn()\n\n${ref('G4').replace('    else:\n        turn()\n        turn()\n        drop()\n        turn()\n        turn()', '    else:\n        back()\n        drop()\n        back()')}`;
    const s4 = 'def back(a):\n    return a >= 2\n\ndef make_plate(ore, coal):\n    if back(ore) and coal >= 1:\n        smelt()\n\nmake_plate(ore, coal)';
    expect(run('G4', g4).passed).toBe(true);
    expect(run('S4', s4).passed).toBe(true);
    const b1 = lessonById('B1')!;
    const r = judge(b1, ref('B1'), machinesText(b1, (id) => (id === 'G4' ? g4 : s4)));
    expect(r).toMatchObject({ failure: 'precheck', problem: { kind: 'check', code: 'machines-clash', params: { name: 'back' } } });
    expect(problemText(r.problem!, 'en')).toBe('In "Your machines" two different functions are called "back", one from G4 and one from S4. Rename one of them in G4 or S4.');
  });

  it('the first belt is played; a failing belt is played instead', () => {
    const ok = run('B2', ref('B2'));
    expect([ok.play, ok.otherBelt]).toEqual([0, false]);
    expect(ok.belts[0]!.frames.length).toBeGreaterThan(10);
  });
});

describe('check messages', () => {
  it('exist for every check code used', () => {
    for (const code of ['def-missing', 'def-params', 'def-params-one', 'def-params-none', 'not-called', 'top-level-command', 'outside-name', 'machines-clash', 'feed-one-item', 'make-plate-one', 'make-plate-none', 'make-plates-count']) {
      expect(MESSAGES.en).toHaveProperty(`factory.check.${code}`);
      expect(MESSAGES.de).toHaveProperty(`factory.check.${code}`);
    }
    for (const key of ['factory.err.read-only-n', 'factory.err.reserved.factory', 'factory.err.reserved.machines', 'factory.err.reserved.lesson', 'factory.py.too-many-lines']) {
      expect(MESSAGES.en).toHaveProperty(key);
      expect(MESSAGES.de).toHaveProperty(key);
    }
  });

  it('def-params says what is needed, singular and plural', () => {
    expect(problemText(run('G4', `def feed(x):\n${ref('G3').replace(/^/gm, '    ')}\n\nfeed(1)`).problem!, 'en')).toBe('feed takes no parameters: def feed():');
    expect(problemText(run('S4', 'def make_plate(a):\n    if a >= 2 and coal >= 1:\n        smelt()\nmake_plate(ore)').problem!, 'de')).toBe('make_plate braucht genau 2 Parameter: def make_plate(ore, coal):');
  });

  it('the S2 task names the problem and the new word, not the solution', () => {
    const s2 = lessonById('S2')!;
    for (const lang of ['de', 'en'] as const) {
      expect(s2.task[lang]).toContain('>=');
      expect(s2.task[lang]).not.toContain('if ore');
    }
  });
});
