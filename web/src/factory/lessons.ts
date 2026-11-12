/**
 * The first layer of Hydra Works as data: eleven lessons in three branches
 * (grabber G1-G4, smelter S1-S4, block B1-B3), see docs/factory.md. Each one
 * has its belts, order, run mode, the names it allows, a reference solution
 * and, for the "gets a name" lessons, the structural checks that make a
 * passing function safe to build on.
 */
import type { Lang } from '../i18n.ts';
import { RbError } from '../robot/py/errors.ts';
import { parse } from '../robot/py/parser.ts';
import type { Expr, Stmt } from '../robot/py/ast.ts';
import { MACHINE_WORDS, type Item } from './world.ts';
import { precheck, runBelt, walk, type BeltRun, type FactoryName, type Order, type Problem, type RunMode } from './run.ts';

export const LESSON_IDS = ['G1', 'G2', 'G3', 'G4', 'S1', 'S2', 'S3', 'S4', 'B1', 'B2', 'B3'] as const;
export type LessonId = (typeof LESSON_IDS)[number];
export const isLessonId = (v: unknown): v is LessonId => (LESSON_IDS as readonly unknown[]).includes(v);

/** grabber: the learner programs the grabber; smelter: the grey factory grabber feeds the smelter; block: both, through the learner's functions. */
export type Branch = 'grabber' | 'smelter' | 'block';

export interface Belt {
  items: readonly Item[];
  /** The value of `n` on this belt (B2, B3). */
  n?: number;
}

export type Text = Record<Lang, string>;

/** What a structural check gets: the learner's own text (parsed and as text), "Your machines", and the runs on every belt. */
export interface CheckInput {
  ast: Stmt[];
  source: string;
  machines: string;
  belts: readonly BeltRun[];
}

/** The function a "gets a name" lesson asks for: defined at the top level with `params` parameters, and called there. */
export interface Provides {
  name: string;
  params: number;
  /** As the messages show it: `feed()`, `make_plate(ore, coal)`. */
  signature: string;
  call: string;
}

export interface Lesson {
  id: LessonId;
  branch: Branch;
  title: Text;
  task: Text;
  /** Opens when all of these are solved. */
  needs: readonly LessonId[];
  /** The editor starts with this lesson's passing text (until the learner types here). Missing: starts empty. */
  carryFrom?: LessonId;
  mode: RunMode;
  /** Tested on every belt; the first one is played step by step. */
  belts: readonly Belt[];
  /** Heaps at the start. */
  start: { ore: number; coal: number };
  order: Order;
  /** Every factory name the program can use (for the block lessons: also the ones only "Your machines" may use). */
  names: readonly FactoryName[];
  /** Names the learner's own text must not use. */
  forbiddenInOwn?: readonly string[];
  /** Names the own text must not define or take as a parameter, with the lesson whose function they name. */
  reserved?: Readonly<Record<string, LessonId>>;
  /** The chips of the toolbox, in order. */
  toolbox: readonly string[];
  /** The one new word of the lesson, if any. */
  newWord?: string;
  /** "Your machines": the functions these lessons provide (and their helpers) stand above the editor, read-only. */
  machinesFrom?: readonly LessonId[];
  reference: string;
  /** The function this lesson builds. Checked once the order is met, and also when it is not (a forgotten call). */
  provides?: Provides;
  /** Extra checks once the order is met on every belt and `provides` is fine. */
  check?: (input: CheckInput) => Problem | undefined;
}

// ------------------------------------------------------------------ syntax helpers for the checks

type Def = Extract<Stmt, { kind: 'def' }>;

/** The functions defined at the top level, by name (a later def of a name replaces the earlier one, as in Python). */
export function topLevelDefs(ast: Stmt[]): Map<string, Def> {
  const out = new Map<string, Def>();
  for (const s of ast) if (s.kind === 'def') out.set(s.name, s);
  return out;
}

/** Names used outside of any function body (calls and plain uses), with their lines. */
export function topLevelNames(ast: Stmt[]): { name: string; line: number; called: boolean }[] {
  const out: { name: string; line: number; called: boolean }[] = [];
  const calls = new Set<Expr>();
  walk(
    ast,
    (n) => {
      const e = n as unknown as Expr;
      if (e.kind === 'call' && e.func.kind === 'name') calls.add(e.func);
      if (e.kind === 'name') out.push({ name: e.name, line: e.line, called: calls.has(e) });
    },
    true,
  );
  return out.sort((a, b) => a.line - b.line);
}

/** The top-level defs `root` reaches: itself and every top-level function its body names, and so on. */
function reachable(defs: Map<string, Def>, root: string): Set<Def> {
  const out = new Set<Def>();
  const todo = [root];
  while (todo.length > 0) {
    const def = defs.get(todo.pop()!);
    if (!def || out.has(def)) continue;
    out.add(def);
    walk(def.body, (n) => {
      if (n.kind === 'name' && typeof n.name === 'string') todo.push(n.name);
    });
  }
  return out;
}

/**
 * The top-level `def`s of a text, as text: what "Your machines" shows and runs. With `root` only that function
 * and the helpers it reaches. A def runs from its line to the line before the next top-level statement; trailing
 * blank lines and unindented comments are dropped. Of two defs with one name only the later one counts.
 */
export function extractDefs(source: string, root?: string): string {
  return defBlocks(source, root).join('\n\n');
}

function defBlocks(source: string, root?: string): string[] {
  let ast: Stmt[];
  try {
    ast = parse(source);
  } catch (e) {
    if (e instanceof RbError) return [];
    throw e;
  }
  const defs = topLevelDefs(ast);
  const keep = root === undefined ? new Set(defs.values()) : reachable(defs, root);
  const lines = source.split('\n');
  const blocks: string[] = [];
  ast.forEach((s, i) => {
    if (s.kind !== 'def' || !keep.has(s)) return;
    const end = i + 1 < ast.length ? ast[i + 1]!.line - 1 : lines.length;
    const block = lines.slice(s.line - 1, end);
    while (block.length > 1 && /^(\s*|#.*)$/.test(block.at(-1)!)) block.pop();
    blocks.push(block.join('\n'));
  });
  return blocks;
}

const check = (code: string, params: Record<string, string | number> = {}): Problem => ({ kind: 'check', code, params });

/** The function of `provides` is defined at the top level with the right number of parameters and called outside of any function. */
export function definedAndCalled(ast: Stmt[], p: Provides): Problem | undefined {
  const def = topLevelDefs(ast).get(p.name);
  if (!def) return check('def-missing', { name: p.name, signature: p.signature, call: p.call });
  if (def.params.length !== p.params) return check('def-params', { name: p.name, count: p.params, signature: p.signature });
  if (!topLevelNames(ast).some((u) => u.name === p.name && u.called)) return check('not-called', { name: p.name, call: p.call });
  return undefined;
}

/** The first use of one of `words` outside of any function: they belong inside `fn`. */
function topLevelCommand(ast: Stmt[], words: readonly string[], fn: string): Problem | undefined {
  const u = topLevelNames(ast).find((x) => words.includes(x.name));
  return u ? check('top-level-command', { fn, name: u.name, line: u.line }) : undefined;
}

/** The first command on any belt that did not run inside `fn` (e.g. in a helper called from the top level). */
function commandOutside(belts: readonly BeltRun[], commands: readonly string[], fn: string): Problem | undefined {
  for (const b of belts) {
    for (const f of b.frames) {
      if (f.event.kind === 'act' && commands.includes(f.event.command) && !f.inside?.includes(fn)) return check('top-level-command', { fn, name: f.event.command, line: f.line ?? 0 });
    }
  }
  return undefined;
}

/** A NameError of the isolated function: it used a name of the rest of the program. */
function outsideName(problem: Problem | undefined, fn: string): Problem | undefined {
  if (problem?.kind === 'python' && problem.error.type === 'NameError' && (problem.error.code === 'unknown-name' || problem.error.code === 'unbound-local')) {
    return check('outside-name', { fn, name: String(problem.error.params.name ?? '') });
  }
  return undefined;
}

/**
 * The function on its own, as "Your machines" will have it: only the defs it reaches, nothing of the top
 * level. A name it reads from the rest of the program is reported here, in the lesson that can fix it.
 */
function isolatedPrecheck(defs: string, fn: string, names: readonly FactoryName[], machines?: string): Problem | undefined {
  const pre = precheck(machines ? { own: defs, machines } : { own: defs }, { names });
  return outsideName(pre, fn) ?? pre;
}

const GRABBER_NAMES: readonly FactoryName[] = ['grab', 'turn', 'drop'];
const SORTING_NAMES: readonly FactoryName[] = [...GRABBER_NAMES, 'is_coal'];
const SMELTER_NAMES: readonly FactoryName[] = ['smelt', 'ore', 'coal'];
const BLOCK_NAMES: readonly FactoryName[] = [...MACHINE_WORDS, 'ore', 'coal'];
const N_NAMES: readonly FactoryName[] = [...BLOCK_NAMES, 'n'];

const FEED: Provides = { name: 'feed', params: 0, signature: 'feed()', call: 'feed()' };
const MAKE_PLATE: Provides = { name: 'make_plate', params: 2, signature: 'make_plate(ore, coal)', call: 'make_plate(ore, coal)' };
const MAKE_PLATES: Provides = { name: 'make_plates', params: 1, signature: 'make_plates(n)', call: 'make_plates(n)' };

/** G4: the top level moves nothing itself (not even through a helper), and one call of feed() alone moves exactly one item. */
function checkFeed({ ast, source, belts }: CheckInput): Problem | undefined {
  const commands = ['grab', 'turn', 'drop'];
  return topLevelCommand(ast, MACHINE_WORDS, 'feed') ?? commandOutside(belts, commands, 'feed') ?? feedProblem(extractDefs(source, 'feed'));
}

/** One call of feed() (with only its definitions) takes the front item to its place and leaves the grabber empty, facing the belt. */
export function feedProblem(defs: string): Problem | undefined {
  const pre = isolatedPrecheck(defs, 'feed', SORTING_NAMES);
  if (pre) return pre;
  for (const first of ['ore', 'coal'] as const) {
    const second: Item = first === 'ore' ? 'coal' : 'ore';
    const r = runBelt({ own: 'feed()', machines: defs }, { mode: 'once', belt: [first, second], names: SORTING_NAMES, order: {} });
    const outside = outsideName(r.problem, 'feed');
    if (outside) return outside;
    const s = r.final;
    const ok = !r.problem && s.belt.length === 1 && s.belt[0]!.kind === second && s.holding === null && s.facing === 'W' && s.ore === (first === 'ore' ? 1 : 0) && s.coal === (first === 'coal' ? 1 : 0);
    if (!ok) return check('feed-one-item');
  }
  return undefined;
}

/** S4: smelt() runs only inside make_plate, and make_plate decides by its parameters, not by the heaps. */
function checkMakePlate({ ast, source, belts }: CheckInput): Problem | undefined {
  return topLevelCommand(ast, ['smelt'], 'make_plate') ?? commandOutside(belts, ['smelt'], 'make_plate') ?? makePlateProblem(extractDefs(source, 'make_plate'));
}

/**
 * make_plate(2, 1) on heaps of 2 ore and 1 coal makes exactly one plate; make_plate(1, 1) and make_plate(2, 0)
 * on full heaps (4 ore, 2 coal) make none and raise no error, so a make_plate that ignores its parameters fails.
 */
export function makePlateProblem(defs: string): Problem | undefined {
  const pre = isolatedPrecheck(defs, 'make_plate', SMELTER_NAMES);
  if (pre) return pre;
  const plates = (args: [number, number], heaps: [number, number]): Problem | number => {
    const r = runBelt({ own: `make_plate(${args[0]}, ${args[1]})`, machines: defs }, { mode: 'once', belt: [], ore: heaps[0], coal: heaps[1], names: SMELTER_NAMES, order: {} });
    return outsideName(r.problem, 'make_plate') ?? (r.problem ? -1 : r.final.plates);
  };
  const one = plates([2, 1], [2, 1]);
  if (typeof one !== 'number') return one;
  if (one !== 1) return check('make-plate-one');
  for (const [ore, coal] of [
    [1, 1],
    [2, 0],
  ] as const) {
    const none = plates([ore, coal], [4, 2]);
    if (typeof none !== 'number') return none;
    if (none !== 0) return check('make-plate-none', { ore, coal });
  }
  return undefined;
}

/**
 * B3: the top level calls no machine itself, and make_plates(k) on its own (only the defs, "Your machines"
 * and the call) makes exactly k plates, also on a belt whose `n` is not k.
 */
function checkMakePlates({ ast, source, machines }: CheckInput): Problem | undefined {
  return topLevelCommand(ast, ['feed', 'make_plate'], 'make_plates') ?? makePlatesProblem(extractDefs(source, 'make_plates'), machines);
}

export function makePlatesProblem(defs: string, machines: string): Problem | undefined {
  const pre = isolatedPrecheck(defs, 'make_plates', N_NAMES, machines);
  if (pre) return pre;
  const belt = Array.from({ length: 4 }, () => ['ore', 'coal', 'ore'] as const).flat();
  for (const [k, n] of [
    [2, 3],
    [3, 2],
  ] as const) {
    const r = runBelt({ own: `${defs}\n\nmake_plates(${k})`, machines }, { mode: 'once', belt, n, names: N_NAMES, order: {} });
    const outside = outsideName(r.problem, 'make_plates');
    if (outside) return outside;
    if (r.problem || r.final.plates !== k) return check('make-plates-count', { k });
  }
  return undefined;
}

const SORT_BELTS: readonly Belt[] = [{ items: ['ore', 'coal', 'ore'] }, { items: ['coal', 'ore', 'ore'] }, { items: ['ore', 'ore', 'coal'] }];
const SMELT_BELTS: readonly Belt[] = [{ items: ['ore', 'ore', 'coal', 'ore', 'coal', 'ore'] }, { items: ['coal', 'ore', 'ore', 'ore', 'ore', 'coal'] }];
/**
 * Groups of two ore and one coal, in any order inside a group; one group more than ordered, so writing the
 * lines out or a fixed number of repeats makes too many plates on one of the belts.
 */
const N_BELTS: readonly Belt[] = [
  { n: 2, items: ['ore', 'coal', 'ore', 'ore', 'ore', 'coal', 'coal', 'ore', 'ore'] },
  { n: 3, items: ['coal', 'ore', 'ore', 'ore', 'coal', 'ore', 'ore', 'ore', 'coal', 'ore', 'coal', 'ore'] },
];

const G3_REFERENCE = `grab()
if is_coal():
    turn()
    drop()
    turn()
    turn()
    turn()
else:
    turn()
    turn()
    drop()
    turn()
    turn()`;

export const LESSONS: readonly Lesson[] = [
  {
    id: 'G1',
    branch: 'grabber',
    title: { de: 'Greifen und werfen', en: 'Grab and throw' },
    task: {
      de: 'Nimm das Erz vom Band und wirf es in die Erzklappe des Ofens im Osten. turn() dreht den Greifer eine Vierteldrehung im Uhrzeigersinn.',
      en: "Take the ore from the belt and drop it into the smelter's ore hatch in the east. turn() turns the grabber a quarter turn clockwise.",
    },
    needs: [],
    mode: 'once',
    belts: [{ items: ['ore'] }],
    start: { ore: 0, coal: 0 },
    order: { ore: 1 },
    names: GRABBER_NAMES,
    toolbox: ['grab()', 'turn()', 'drop()'],
    reference: 'grab()\nturn()\nturn()\ndrop()',
  },
  {
    id: 'G2',
    branch: 'grabber',
    title: { de: 'Und wieder zurück', en: 'And back again' },
    task: {
      de: 'Jetzt kommen zwei Erze. Die Fabrik startet dein Programm für jedes Teil neu: Es muss enden, wo es begonnen hat, mit dem Greifer zum Band.',
      en: 'Now two ores come. The factory starts your program again for every item: it must end where it began, with the grabber facing the belt.',
    },
    needs: ['G1'],
    carryFrom: 'G1',
    mode: 'per-item',
    belts: [{ items: ['ore', 'ore'] }],
    start: { ore: 0, coal: 0 },
    order: { ore: 2 },
    names: GRABBER_NAMES,
    toolbox: ['grab()', 'turn()', 'drop()'],
    reference: 'grab()\nturn()\nturn()\ndrop()\nturn()\nturn()',
  },
  {
    id: 'G3',
    branch: 'grabber',
    title: { de: 'Kohle oder Erz', en: 'Coal or ore' },
    task: {
      de: 'Jetzt kommt auch Kohle. Kohle gehört in den Bunker im Norden, Erz in den Ofen. is_coal() sagt dir, ob der Greifer Kohle hält: Benutze if und else.',
      en: 'Now coal comes too. Coal goes into the bunker in the north, ore into the smelter. is_coal() tells you whether the grabber holds coal: use if and else.',
    },
    needs: ['G2'],
    carryFrom: 'G2',
    mode: 'per-item',
    belts: SORT_BELTS,
    start: { ore: 0, coal: 0 },
    order: { ore: 2, coal: 1 },
    names: SORTING_NAMES,
    toolbox: ['grab()', 'turn()', 'drop()', 'is_coal()'],
    newWord: 'is_coal()',
    reference: G3_REFERENCE,
  },
  {
    id: 'G4',
    branch: 'grabber',
    title: { de: 'Der Greifer bekommt einen Namen', en: 'The grabber gets a name' },
    task: {
      de: 'Gib deinem Greifer-Code einen Namen: Schreib ihn eingerückt unter def feed(): und ruf darunter feed() auf. Ein Aufruf bringt genau ein Teil an seinen Platz.',
      en: 'Give your grabber code a name: indent it under def feed(): and call feed() below it. One call brings exactly one item to its place.',
    },
    needs: ['G3'],
    carryFrom: 'G3',
    mode: 'per-item',
    belts: SORT_BELTS,
    start: { ore: 0, coal: 0 },
    order: { ore: 2, coal: 1 },
    names: SORTING_NAMES,
    toolbox: ['grab()', 'turn()', 'drop()', 'is_coal()'],
    newWord: 'def',
    reserved: { make_plate: 'S4' },
    reference: `def feed():\n${G3_REFERENCE.replace(/^/gm, '    ')}\n\nfeed()`,
    provides: FEED,
    check: checkFeed,
  },
  {
    id: 'S1',
    branch: 'smelter',
    title: { de: 'Der Schmelzofen', en: 'The smelter' },
    task: {
      de: 'Der Ofen macht aus 2 Erz und 1 Kohle eine Platte. Die Schilder ore und coal zeigen, was auf den Haufen liegt. Mach eine Platte mit smelt().',
      en: 'The smelter makes a plate from 2 ore and 1 coal. The labels ore and coal show what lies on the heaps. Make one plate with smelt().',
    },
    needs: [],
    mode: 'once',
    belts: [{ items: [] }],
    start: { ore: 2, coal: 3 },
    order: { plates: 1 },
    names: SMELTER_NAMES,
    toolbox: ['smelt()', 'ore', 'coal'],
    reference: 'smelt()',
  },
  {
    id: 'S2',
    branch: 'smelter',
    title: { de: 'Zu schnell', en: 'Too fast' },
    task: {
      de: 'Der graue Fabrikgreifer bringt vier Erze, eins nach dem anderen, und nach jedem läuft dein Programm. Der Ofen muss warten, bis 2 Erz da sind. Neu ist der Vergleich >= (größer oder gleich).',
      en: 'The grey factory grabber brings four ores, one after the other, and after each one your program runs. The smelter must wait until there are 2 ore. New is the comparison >= (greater than or equal).',
    },
    needs: ['S1'],
    carryFrom: 'S1',
    mode: 'per-landing',
    belts: [{ items: ['ore', 'ore', 'ore', 'ore'] }],
    start: { ore: 0, coal: 3 },
    order: { plates: 2 },
    names: SMELTER_NAMES,
    toolbox: ['smelt()', 'ore', 'coal'],
    newWord: '>=',
    reference: 'if ore >= 2:\n    smelt()',
  },
  {
    id: 'S3',
    branch: 'smelter',
    title: { de: 'Keine Kohle', en: 'No coal' },
    task: {
      de: 'Jetzt kommt auch die Kohle mit dem Fabrikgreifer, manchmal spät. Schmilz nur, wenn 2 Erz und 1 Kohle da sind: zwei Bedingungen mit and.',
      en: 'Now the coal comes with the factory grabber too, sometimes late. Smelt only when there are 2 ore and 1 coal: two conditions with and.',
    },
    needs: ['S2'],
    carryFrom: 'S2',
    mode: 'per-landing',
    belts: SMELT_BELTS,
    start: { ore: 0, coal: 0 },
    order: { plates: 2 },
    names: SMELTER_NAMES,
    toolbox: ['smelt()', 'ore', 'coal'],
    newWord: 'and',
    reference: 'if ore >= 2 and coal >= 1:\n    smelt()',
  },
  {
    id: 'S4',
    branch: 'smelter',
    title: { de: 'Der Ofen bekommt einen Namen', en: 'The smelter gets a name' },
    task: {
      de: 'Gib deinem Ofen-Code einen Namen: def make_plate(ore, coal): und darunter make_plate(ore, coal). Mit (2, 1) macht er eine Platte, mit weniger keine und keinen Fehler.',
      en: 'Give your smelter code a name: def make_plate(ore, coal): and below it make_plate(ore, coal). With (2, 1) it makes one plate, with less none and no error.',
    },
    needs: ['S3'],
    carryFrom: 'S3',
    mode: 'per-landing',
    belts: SMELT_BELTS,
    start: { ore: 0, coal: 0 },
    order: { plates: 2 },
    names: SMELTER_NAMES,
    toolbox: ['smelt()', 'ore', 'coal'],
    newWord: 'def',
    reserved: { feed: 'G4' },
    reference: 'def make_plate(ore, coal):\n    if ore >= 2 and coal >= 1:\n        smelt()\n\nmake_plate(ore, coal)',
    provides: MAKE_PLATE,
    check: checkMakePlate,
  },
  {
    id: 'B1',
    branch: 'block',
    title: { de: 'Der Block', en: 'The block' },
    task: {
      de: 'Deine Maschinen stehen oben bereit. Mach mit ihnen eine Platte: Das Band bringt 2 Erz und 1 Kohle, in irgendeiner Reihenfolge.',
      en: 'Your machines are ready above. Make one plate with them: the belt brings 2 ore and 1 coal, in any order.',
    },
    needs: ['G4', 'S4'],
    mode: 'once',
    belts: SORT_BELTS,
    start: { ore: 0, coal: 0 },
    order: { plates: 1 },
    names: BLOCK_NAMES,
    forbiddenInOwn: MACHINE_WORDS,
    toolbox: ['feed()', 'make_plate(ore, coal)'],
    machinesFrom: ['G4', 'S4'],
    reference: 'feed()\nfeed()\nfeed()\nmake_plate(ore, coal)',
  },
  {
    id: 'B2',
    branch: 'block',
    title: { de: 'n Platten', en: 'n plates' },
    task: {
      de: 'Jetzt lautet der Auftrag n Platten, und n ist auf jedem Band anders. Wiederhole mit for i in range(n):',
      en: 'Now the order is n plates, and n differs from belt to belt. Repeat with for i in range(n):',
    },
    needs: ['B1'],
    carryFrom: 'B1',
    mode: 'once',
    belts: N_BELTS,
    start: { ore: 0, coal: 0 },
    order: { plates: 'n' },
    names: N_NAMES,
    forbiddenInOwn: MACHINE_WORDS,
    toolbox: ['feed()', 'make_plate(ore, coal)', 'n'],
    newWord: 'for',
    machinesFrom: ['G4', 'S4'],
    reference: 'for i in range(n):\n    feed()\n    feed()\n    feed()\n    make_plate(ore, coal)',
  },
  {
    id: 'B3',
    branch: 'block',
    title: { de: 'Der Block bekommt einen Namen', en: 'The block gets a name' },
    task: {
      de: 'Gib dem ganzen Block einen Namen: def make_plates(n): und darunter make_plates(n).',
      en: 'Give the whole block a name: def make_plates(n): and below it make_plates(n).',
    },
    needs: ['B2'],
    carryFrom: 'B2',
    mode: 'once',
    belts: N_BELTS,
    start: { ore: 0, coal: 0 },
    order: { plates: 'n' },
    names: N_NAMES,
    forbiddenInOwn: MACHINE_WORDS,
    toolbox: ['feed()', 'make_plate(ore, coal)', 'n'],
    newWord: 'def',
    machinesFrom: ['G4', 'S4'],
    reference: 'def make_plates(n):\n    for i in range(n):\n        feed()\n        feed()\n        feed()\n        make_plate(ore, coal)\n\nmake_plates(n)',
    provides: MAKE_PLATES,
    check: checkMakePlates,
  },
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

/** The lessons directly above `id` in the graph (those that need it). */
export function lessonsAbove(id: LessonId): Lesson[] {
  return LESSONS.filter((l) => l.needs.includes(id));
}

/**
 * "Your machines" for a lesson: from each passing text of `machinesFrom` the function that lesson provides and
 * the helpers it reaches, joined. A helper that both texts have word for word stands there once; two
 * different helpers with one name both stay (the judge reports `machines-clash`). Empty for other lessons.
 */
export function machinesText(lesson: Lesson, passing: (id: LessonId) => string | undefined): string {
  if (!lesson.machinesFrom) return '';
  const blocks: string[] = [];
  for (const id of lesson.machinesFrom) {
    const root = lessonById(id)?.provides?.name;
    for (const block of defBlocks(passing(id) ?? '', root)) if (!blocks.includes(block)) blocks.push(block);
  }
  return blocks.join('\n\n');
}

/** Two different functions with one name in "Your machines" (G4's and S4's helpers): the learner renames one there. */
export function machinesClash(machines: string): Problem | undefined {
  let ast: Stmt[];
  try {
    ast = parse(machines);
  } catch {
    return undefined;
  }
  const seen = new Set<string>();
  for (const s of ast) {
    if (s.kind !== 'def') continue;
    if (seen.has(s.name)) return check('machines-clash', { name: s.name });
    seen.add(s.name);
  }
  return undefined;
}
