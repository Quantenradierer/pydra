import type { MessageKey, Params } from '../i18n.ts';
import type { Frame } from './battle.ts';
import type { TraceEvent } from './py/trace.ts';

type T = (key: MessageKey, params?: Params) => string;

/** What one executed line did, as short sentences for a beginner (the `line` event itself is shown as the highlight). */
export function narrateEvents(events: readonly TraceEvent[], t: T): string[] {
  const out: string[] = [];
  for (const e of events) {
    switch (e.k) {
      case 'call':
        out.push(t(`robot.narr.call.${e.kind}` as MessageKey, { fn: e.fn, args: e.args.join(', '), result: e.result ?? '' }));
        break;
      case 'set':
        out.push(t('robot.narr.set', { name: e.name, value: e.value }));
        break;
      case 'branch':
        if (e.kind === 'if') out.push(t(e.taken ? 'robot.narr.if.true' : e.hasElse ? 'robot.narr.if.else' : 'robot.narr.if.false'));
        else if (e.kind === 'while') out.push(t(e.taken ? 'robot.narr.while.true' : 'robot.narr.while.false', { n: e.n ?? 1 }));
        else out.push(e.taken ? t('robot.narr.for.true', { n: e.n ?? 1, value: e.value ?? '' }) : t('robot.narr.for.false'));
        break;
      case 'enter':
        out.push(t('robot.narr.enter', { fn: e.fn, args: e.args.join(', ') }));
        break;
      case 'leave':
        out.push(t('robot.narr.leave', { fn: e.fn, value: e.value }));
        break;
      case 'cut':
        out.push(t('robot.narr.cut'));
        break;
      case 'line':
        break;
    }
  }
  return out;
}

/** The player's move or turn between two frames, in words. */
export function describeMotion(prev: Frame | undefined, frame: Frame, t: T): string[] {
  const before = prev?.robots.find((r) => r.id === 'player');
  const after = frame.robots.find((r) => r.id === 'player');
  if (!before || !after) return [];
  const out: string[] = [];
  const who = t('robot.you');
  if (before.pos.x !== after.pos.x || before.pos.y !== after.pos.y) out.push(t('robot.motion.moved', { who, x1: before.pos.x, y1: before.pos.y, x2: after.pos.x, y2: after.pos.y }));
  if (before.facing !== after.facing) out.push(t('robot.motion.turned', { who, dir: t(`robot.dir.${after.facing}` as MessageKey) }));
  return out;
}
