/**
 * Hydra Lift's problems, misses and goals as sentences for a beginner, with the
 * line ("(line 4)"). Python errors go through Robot Battler's friendly texts;
 * the car's own errors have `elevator.py.*` texts.
 */
import { MESSAGES, translate, type Lang, type MessageKey } from '../i18n.ts';
import { friendlyError } from '../robot/friendly.ts';
import { lineRef, type Goal, type Problem, type RunResult } from './run.ts';

const hasKey = (key: string): key is MessageKey => key in MESSAGES.de;

/** "line 4", or "the fixed line" for the prelude. */
export function whereText(line: number, lang: Lang): string {
  const ref = lineRef(line);
  return ref.part === 'prelude' ? translate(lang, 'elevator.where.prelude') : translate(lang, 'elevator.where.own', { line: ref.line });
}

/** Adds "(line 4)" before the closing period. */
function withWhere(text: string, line: number, lang: Lang): string {
  if (!line) return text;
  const where = whereText(line, lang);
  return text.endsWith('.') ? `${text.slice(0, -1)} (${where}).` : `${text} (${where})`;
}

/** The whole sentence for a problem, line included. */
export function problemText(p: Problem, lang: Lang): string {
  switch (p.kind) {
    case 'python': {
      const e = p.error;
      const key = `elevator.py.${e.code}`;
      return withWhere(hasKey(key) ? translate(lang, key, e.params) : friendlyError(e, lang), e.line, lang);
    }
    case 'budget':
      return withWhere(translate(lang, 'elevator.err.budget', { handler: p.handler || '…' }), p.line, lang);
    case 'read-only':
      return withWhere(translate(lang, 'elevator.err.read-only', { name: p.name }), p.line, lang);
    case 'idle-def':
      return withWhere(translate(lang, 'elevator.err.idle-def'), p.line, lang);
    case 'unknown-handler':
      return withWhere(translate(lang, p.suggestion ? 'elevator.err.unknown-handler-hint' : 'elevator.err.unknown-handler', { name: p.name, suggestion: p.suggestion ?? '' }), p.line, lang);
    case 'handler-params':
      return withWhere(translate(lang, p.expected === 0 ? 'elevator.err.handler-params-none' : 'elevator.err.handler-params', { name: p.name, params: p.params, given: p.given }), p.line, lang);
    case 'needs-elevator':
      return withWhere(translate(lang, 'elevator.err.needs-elevator', { name: p.name, car: p.car }), p.line, lang);
    case 'no-floor':
      return withWhere(translate(lang, p.where === 'roof' ? 'elevator.err.no-floor.roof' : 'elevator.err.no-floor.pit', { floor: p.floor, max: p.max }), p.line, lang);
  }
}

/** "Goal: 12 people in 100 s, at most 24 trips, nobody longer than 35 s". */
export function goalText(goal: Goal, lang: Lang): string {
  const parts = [translate(lang, 'elevator.goal.people', { people: goal.people, seconds: goal.seconds })];
  if (goal.maxMoves !== undefined) parts.push(translate(lang, 'elevator.goal.moves', { n: goal.maxMoves }));
  if (goal.maxWait !== undefined) parts.push(translate(lang, 'elevator.goal.wait', { n: goal.maxWait }));
  if (goal.noSiteStops) parts.push(translate(lang, 'elevator.goal.site'));
  return translate(lang, 'elevator.goal', { what: parts.join(', ') });
}

/** The verdict of a run: what went wrong (or that it worked), and one hint if there is one. */
export function verdictText(r: RunResult, goal: Goal, lang: Lang): { text: string; hint?: string } {
  if (r.passed) return { text: translate(lang, 'elevator.result.pass', { people: r.stats.transported, seconds: seconds(r.stats.elapsed, lang) }) };
  if (r.problem && r.crashed) return { text: translate(lang, r.crashed.length > 1 ? 'elevator.result.crash.other' : 'elevator.result.crash.one', { reason: problemText(r.problem, lang) }) };
  if (r.problem) return { text: problemText(r.problem, lang) };
  const text = r.misses
    .map((m) =>
      m === 'moves'
        ? translate(lang, 'elevator.miss.moves', { n: goal.maxMoves ?? 0 })
        : m === 'wait'
          ? translate(lang, 'elevator.miss.wait', { n: goal.maxWait ?? 0 })
          : m === 'site'
            ? translate(lang, 'elevator.miss.site')
            : translate(lang, 'elevator.miss.time', { have: r.stats.transported, people: goal.people, seconds: goal.seconds }),
    )
    .join(' ');
  const hint = r.pressedIgnored
    ? translate(lang, 'elevator.hint.pressed-ignored')
    : r.stoodStill
    ? translate(lang, 'elevator.hint.stood-still')
    : r.unusedCar !== undefined
      ? translate(lang, 'elevator.hint.unused-car', { car: `elevators[${r.unusedCar}]` })
      : r.neverVisited !== undefined
        ? translate(lang, 'elevator.hint.never-visited', { floor: r.neverVisited })
        : undefined;
  return hint ? { text, hint } : { text };
}

/** 12.5 → "12,5" (de) / "12.5" (en). */
export function seconds(s: number, lang: Lang): string {
  const v = Math.round(s * 10) / 10;
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return lang === 'de' ? text.replace('.', ',') : text;
}
