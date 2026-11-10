import type { MessageKey, Params } from '../i18n.ts';
import type { Frame } from './battle.ts';
import { DELTA } from './engine.ts';

type T = (key: MessageKey, params?: Params) => string;

/**
 * What the player's robot just did in this tick, as ONE short sentence ("Du fährst einen Schritt vor.",
 * "Du schießt: Treffer!"), or null when nothing worth mentioning happened. Never coordinates, never generic.
 */
export function describeAction(prev: Frame | undefined, frame: Frame, t: T): string | null {
  for (const e of frame.events) {
    switch (e.type) {
      case 'fizzle':
        if (e.robot === 'player') return t(`narr.fizzle.${e.reason}` as MessageKey, { part: t(`robot.part.${e.part}` as MessageKey) });
        break;
      case 'shot':
      case 'smash':
        if (e.by === 'player') return t(`narr.${e.type}.${e.hit ? (e.blocked ? 'blocked' : 'hit') : 'miss'}` as MessageKey);
        break;
      case 'push':
        if (e.by === 'player') return t('narr.push');
        break;
      case 'bump':
        if (e.robot === 'player') return t(`narr.bump.${e.reason}` as MessageKey);
        break;
      case 'shield':
        if (e.robot === 'player') return t('narr.shield');
        break;
      default:
        break;
    }
  }
  const before = prev?.robots.find((r) => r.id === 'player');
  const after = frame.robots.find((r) => r.id === 'player');
  if (!before || !after) return null;
  const dx = after.pos.x - before.pos.x;
  const dy = after.pos.y - before.pos.y;
  if (dx !== 0 || dy !== 0) {
    const ahead = DELTA[before.facing];
    return t(ahead.x * dx + ahead.y * dy > 0 ? 'narr.forward' : 'narr.backward');
  }
  return before.facing !== after.facing ? t('narr.turn') : null;
}
