import { MESSAGES, translate, type Lang, type MessageKey } from '../i18n.ts';
import type { RbError } from './py/errors.ts';

const hasKey = (key: string): key is MessageKey => key in MESSAGES.de;

/** An error as a sentence for a beginner, in the player's language. The line is added by the caller. */
export function friendlyError(error: RbError, lang: Lang): string {
  const base = error.code === 'not-equipped' ? `robot.err.not-equipped-${error.params.kind}` : `robot.err.${error.code}`;
  const hinted = `${base}-hint`;
  const key = error.params.suggestion !== undefined && hasKey(hinted) ? hinted : base;
  const params: Record<string, string | number> = { ...error.params };
  if (typeof params.need === 'string') params.need = translate(lang, `robot.part.${params.need}` as MessageKey);
  if (typeof params.dir === 'string') params.dir = translate(lang, `robot.dir.${params.dir}` as MessageKey);
  if (hasKey(key)) return translate(lang, key, params);
  return translate(lang, 'robot.err.generic', { type: error.type, detail: error.detail });
}
