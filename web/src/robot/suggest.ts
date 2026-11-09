import type { ApiId } from './messages-ui.ts';
import type { Build, GearId } from './build.ts';
import { GEAR } from './build.ts';

/**
 * The suggestion engine of the script editor (pure, no DOM): what to offer while the player types (completions) and
 * which templates sit in the insert bar (snippets). Suggestions are tools, they name commands and shapes of code;
 * they never say what the task's solution is.
 */

export type SuggestKind = 'part' | 'method' | 'command' | 'keyword' | 'variable';

export interface Suggestion {
  /** What the popup shows, e.g. `blaster.fire()`. */
  label: string;
  /** The word that is matched against what has been typed. */
  name: string;
  /** Replaces the typed word. */
  insert: string;
  /** How many characters the caret moves back after the insert (into the parentheses of a call that takes an argument). */
  back: number;
  kind: SuggestKind;
  /** Message key of the short description (absent for variables). */
  desc: string | null;
  /** False for parts the robot does not carry: they are listed (last), but calling them would fail. */
  equipped: boolean;
}

export interface Completion {
  /** The range of the typed word that a suggestion replaces. */
  from: number;
  to: number;
  items: Suggestion[];
}

const KEYWORDS = ['if', 'elif', 'else', 'while', 'for', 'in', 'def', 'return', 'True', 'False', 'and', 'or', 'not'] as const;
const BUILTINS = ['range', 'len', 'print'] as const;
const GEAR_DESC: Record<GearId, string> = Object.fromEntries(GEAR.map((g) => [g, `robot.sug.part.${g}`])) as Record<GearId, string>;

interface Cmd {
  name: string;
  /** Arguments as written in the call, `''` for none. */
  args: string;
  id: ApiId;
}

const cmd = (name: string, args: string, id: ApiId): Cmd => ({ name, args, id });

/** The methods of every part object by object name, as far as the build has them. */
function methodsOf(build: Build, obj: string): Cmd[] {
  const has = (g: GearId) => build.gear.includes(g);
  const checks = (): Cmd[] => [cmd('is_charged', '', 'checks'), cmd('cooldown', '', 'checks'), cmd('mark', '', 'checks')];
  switch (obj) {
    case 'blaster':
      return [build.blasterMark === 2 ? cmd('fire', 'shots', 'fire_burst') : cmd('fire', '', 'fire_blaster'), ...(build.blasterMark === 2 ? [cmd('heat', '', 'heat')] : []), ...checks()];
    case 'cannon':
      return [cmd('fire', 'power', 'fire_cannon'), ...checks()];
    case 'hammer':
      return [cmd('smash', '', 'smash'), ...checks()];
    case 'shield':
      return [cmd('activate', '', 'activate'), cmd('is_up', '', 'is_up'), ...checks()];
    case 'gps':
      return [cmd('position', '', 'position'), cmd('facing', '', 'facing'), ...checks()];
    case 'plates':
      return [cmd('integrity', '', 'integrity'), ...checks()];
    case 'eyes':
      return [cmd('see', '', 'see'), cmd('distance', '', 'distance'), ...(build.addons.includes('wide') ? [cmd('see_left', '', 'see_side'), cmd('see_right', '', 'see_side')] : []), ...(build.addons.includes('scanner') ? [cmd('enemy_shielded', '', 'enemy_shielded')] : []), ...checks()];
    case 'clock':
      return [cmd('tick', '', 'tick')];
    default:
      return has(obj as GearId) ? checks() : [];
  }
}

/** Commands that work without an object in front, for this build. */
function globalCommands(build: Build): Cmd[] {
  const has = (g: GearId) => build.gear.includes(g);
  const out: Cmd[] = [];
  if (build.locomotion === 'legs') {
    for (const d of ['north', 'east', 'south', 'west']) out.push(cmd(`move_${d}`, 'steps', 'move'));
    out.push(cmd('rotate_left', '', 'rotate'), cmd('rotate_right', '', 'rotate'));
  } else {
    out.push(cmd('forward', 'steps', 'forward'), cmd('backward', 'steps', 'backward'), cmd('turn_left', '', 'turn_left'), cmd('turn_right', '', 'turn_right'));
    if (build.locomotion === 'treads') out.push(cmd('push', '', 'push'));
  }
  if (has('blaster')) out.push(build.blasterMark === 2 ? cmd('fire', 'shots', 'fire_burst') : cmd('fire', '', 'fire_blaster'));
  else if (has('cannon')) out.push(cmd('fire', 'power', 'fire_cannon'));
  if (has('hammer')) out.push(cmd('smash', '', 'smash'));
  if (has('eyes')) {
    out.push(cmd('see', '', 'see'), cmd('distance', '', 'distance'));
    if (build.addons.includes('wide')) out.push(cmd('see_left', '', 'see_side'), cmd('see_right', '', 'see_side'));
    if (build.addons.includes('scanner')) out.push(cmd('enemy_shielded', '', 'enemy_shielded'));
  }
  out.push(cmd('wait', '', 'wait'), cmd('say', 'text', 'say'), cmd('hp', '', 'hp'), cmd('alive', '', 'alive'));
  return out;
}

function asSuggestion(c: Cmd, prefix: string, kind: SuggestKind): Suggestion {
  return {
    label: `${prefix}${c.name}(${c.args})`,
    name: c.name,
    insert: `${c.name}()`,
    back: c.args === '' ? 0 : 1,
    kind,
    desc: `robot.api.${c.id}`,
    equipped: true,
  };
}

/** Names the script defines itself: assignments, loop variables, functions and their parameters. */
export function localNames(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/^[ \t]*([A-Za-z_]\w*)[ \t]*(?:[-+*/]?=)(?!=)/gm)) out.add(m[1]!);
  for (const m of text.matchAll(/^[ \t]*for[ \t]+([A-Za-z_]\w*)[ \t]+in\b/gm)) out.add(m[1]!);
  for (const m of text.matchAll(/^[ \t]*def[ \t]+([A-Za-z_]\w*)[ \t]*\(([^)]*)\)/gm)) {
    out.add(m[1]!);
    for (const p of m[2]!.split(',')) if (/^\s*[A-Za-z_]\w*\s*$/.test(p)) out.add(p.trim());
  }
  return [...out];
}

const rank = (name: string, word: string): number => (name === word ? 3 : name.startsWith(word) ? 0 : name.includes(word) ? 1 : -1);

/** The completions at a caret position, or null when nothing is being typed (so the popup stays out of the way). */
export function completionAt(text: string, caret: number, build: Build, opts: { manual?: boolean } = {}): Completion | null {
  const before = text.slice(0, caret);
  const m = /([A-Za-z_]\w*)?$/.exec(before)!;
  const word = m[1] ?? '';
  const from = caret - word.length;
  // Inside a comment or a string nothing is offered.
  const lineStart = before.lastIndexOf('\n') + 1;
  const line = before.slice(lineStart);
  if (/#/.test(line) || ((line.match(/"/g) ?? []).length % 2 === 1) || ((line.match(/'/g) ?? []).length % 2 === 1)) return null;
  const member = /([A-Za-z_]\w*)\.$/.exec(before.slice(0, from));
  let pool: Suggestion[];
  if (member) {
    const obj = member[1]!;
    pool = methodsOf(build, obj).map((c) => asSuggestion(c, `${obj}.`, 'method'));
    if (pool.length === 0) return null;
  } else {
    if (word === '' && !opts.manual) return null;
    // Digits cannot start a name: `3` then a letter is not a word.
    if (from > 0 && /\d/.test(text[from - 1]!)) return null;
    const equipped = new Set<GearId>(build.gear);
    const parts: Suggestion[] = [
      ...GEAR.filter((g) => equipped.has(g)),
      'clock' as const,
      ...GEAR.filter((g) => !equipped.has(g)),
    ].map((g) => ({ label: g, name: g, insert: g, back: 0, kind: 'part' as const, desc: g === 'clock' ? 'robot.sug.part.clock' : GEAR_DESC[g], equipped: g === 'clock' || equipped.has(g) }));
    const locals = localNames(text).filter((n) => n !== word);
    pool = [
      ...globalCommands(build).map((c) => asSuggestion(c, '', 'command')),
      ...parts,
      ...KEYWORDS.map((k) => ({ label: k, name: k, insert: k, back: 0, kind: 'keyword' as const, desc: `robot.sug.kw.${k}`, equipped: true })),
      ...BUILTINS.map((b) => ({ label: `${b}()`, name: b, insert: `${b}()`, back: 1, kind: 'command' as const, desc: `robot.sug.fn.${b}`, equipped: true })),
      ...locals.map((n) => ({ label: n, name: n, insert: n, back: 0, kind: 'variable' as const, desc: null, equipped: true })),
    ];
  }
  const seen = new Set<string>();
  const scored = pool
    .map((s, i) => ({ s, i, r: rank(s.name, word) }))
    .filter(({ r }) => word === '' || r >= 0)
    .filter(({ s }) => (seen.has(s.label) ? false : (seen.add(s.label), true)));
  // A word that is complete already (`fire` typed out) needs no popup, unless there is more to pick from.
  scored.sort((a, b) => Number(b.s.equipped) - Number(a.s.equipped) || (b.r === 0 ? 1 : 0) - (a.r === 0 ? 1 : 0) || b.r - a.r || a.i - b.i);
  const items = scored.map(({ s }) => s);
  if (items.length === 0) return null;
  if (!opts.manual && items.length === 1 && items[0]!.name === word && !member && items[0]!.back === 0) return null;
  return { from, to: caret, items: items.slice(0, 40) };
}

/** Puts a suggestion into the text; returns the new text and caret. A call's `()` is not doubled when it is there already. */
export function applySuggestion(text: string, c: Completion, s: Suggestion): { text: string; caret: number } {
  const after = text.slice(c.to);
  const call = s.insert.endsWith('()') && after.startsWith('(');
  const insert = call ? s.insert.slice(0, -2) : s.insert;
  const out = text.slice(0, c.from) + insert + after;
  return { text: out, caret: c.from + insert.length - (call ? 0 : s.back) };
}

// ------------------------------------------------------------------ snippets

export interface Snippet {
  /** What the button says. */
  label: string;
  /** The template; `$0` marks the caret. Lines after the first are indented like the line the caret is on. */
  text: string;
}

export interface SnippetGroup {
  /** `flow`, `compare`, `move` or a gear id. */
  id: string;
  snippets: Snippet[];
}

/** The insert bar, organised by what the build offers: always the Python shapes, then one group per kind of gear. */
export function snippetGroups(build: Build): SnippetGroup[] {
  const has = (g: GearId) => build.gear.includes(g);
  const groups: SnippetGroup[] = [
    {
      id: 'flow',
      snippets: [
        { label: 'if', text: 'if alive():\n    $0' },
        { label: 'elif', text: 'elif alive():\n    $0' },
        { label: 'else', text: 'else:\n    $0' },
        { label: 'while', text: 'while alive():\n    $0' },
        { label: 'for', text: 'for i in range(3):\n    $0' },
        { label: 'def', text: 'def action():\n    $0' },
        { label: 'return', text: 'return $0' },
        { label: 'x = …', text: 'x = $0' },
      ],
    },
    { id: 'compare', snippets: ['==', '!=', '<', '>', '<=', '>=', 'and', 'or', 'not'].map((o) => ({ label: o, text: o === 'not' ? 'not $0' : ` ${o} $0` })) },
  ];
  const move: Snippet[] =
    build.locomotion === 'legs'
      ? [{ label: 'move_north(1)', text: 'move_north($0)' }, { label: 'move_east(1)', text: 'move_east($0)' }, { label: 'move_south(1)', text: 'move_south($0)' }, { label: 'move_west(1)', text: 'move_west($0)' }, { label: 'rotate_left()', text: 'rotate_left()$0' }, { label: 'rotate_right()', text: 'rotate_right()$0' }]
      : [{ label: 'forward(1)', text: 'forward($0)' }, { label: 'backward(1)', text: 'backward($0)' }, { label: 'turn_left()', text: 'turn_left()$0' }, { label: 'turn_right()', text: 'turn_right()$0' }, ...(build.locomotion === 'treads' ? [{ label: 'push()', text: 'push()$0' }] : [])];
  groups.push({ id: 'move', snippets: move });
  if (has('blaster')) groups.push({ id: 'blaster', snippets: build.blasterMark === 2 ? [{ label: 'fire(1)', text: 'fire($0)' }, { label: 'blaster.heat()', text: 'blaster.heat()$0' }, { label: 'blaster.is_charged()', text: 'blaster.is_charged()$0' }] : [{ label: 'fire()', text: 'fire()$0' }, { label: 'blaster.is_charged()', text: 'blaster.is_charged()$0' }] });
  if (has('cannon')) groups.push({ id: 'cannon', snippets: [{ label: has('blaster') ? 'cannon.fire(1)' : 'fire(1)', text: has('blaster') ? 'cannon.fire($0)' : 'fire($0)' }, { label: 'cannon.is_charged()', text: 'cannon.is_charged()$0' }] });
  if (has('hammer')) groups.push({ id: 'hammer', snippets: [{ label: 'smash()', text: 'smash()$0' }, { label: 'hammer.is_charged()', text: 'hammer.is_charged()$0' }] });
  if (has('eyes')) {
    const s: Snippet[] = [{ label: 'see()', text: 'see()$0' }, { label: 'distance()', text: 'distance()$0' }, { label: 'if see() == "…"', text: 'if see() == "$0":\n    ' }];
    if (build.addons.includes('wide')) s.push({ label: 'see_left()', text: 'see_left()$0' }, { label: 'see_right()', text: 'see_right()$0' });
    if (build.addons.includes('scanner')) s.push({ label: 'enemy_shielded()', text: 'enemy_shielded()$0' });
    groups.push({ id: 'eyes', snippets: s });
  }
  if (has('shield')) groups.push({ id: 'shield', snippets: [{ label: 'shield.activate()', text: 'shield.activate()$0' }, { label: 'shield.is_up()', text: 'shield.is_up()$0' }] });
  if (has('gps')) groups.push({ id: 'gps', snippets: [{ label: 'gps.position()', text: 'gps.position()$0' }, { label: 'gps.facing()', text: 'gps.facing()$0' }] });
  if (has('plates')) groups.push({ id: 'plates', snippets: [{ label: 'plates.integrity()', text: 'plates.integrity()$0' }] });
  groups.push({ id: 'basics', snippets: [{ label: 'wait()', text: 'wait()$0' }, { label: 'say("…")', text: 'say("$0")' }, { label: 'hp()', text: 'hp()$0' }, { label: 'alive()', text: 'alive()$0' }] });
  return groups;
}

/** Inserts a template at the selection: continuation lines take the indent of the current line; the caret lands on `$0`. */
export function insertSnippet(text: string, start: number, end: number, snippet: Snippet): { text: string; caret: number } {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const indent = /^[ \t]*/.exec(text.slice(lineStart, start))![0];
  const lineBlank = text.slice(lineStart, start).trim() === '';
  const body = snippet.text.split('\n').join('\n' + indent);
  const at = body.indexOf('$0');
  const clean = body.replace('$0', '');
  // A new line is started when the caret sits behind code and the template is a statement (not an operator or a call).
  const statement = /^(if|elif|else|while|for|def|return|x =)/.test(snippet.text);
  const lead = statement && !lineBlank ? '\n' + indent : '';
  const out = text.slice(0, start) + lead + clean + text.slice(end);
  return { text: out, caret: start + lead.length + (at < 0 ? clean.length : at) };
}
