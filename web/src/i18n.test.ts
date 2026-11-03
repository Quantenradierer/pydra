import { describe, expect, it } from 'vitest';
import { LANGS, MESSAGES, translate } from './i18n.ts';
import { TOPICS } from './content/types.ts';

describe('i18n', () => {
  it('has every key in every language, never empty', () => {
    const keys = Object.keys(MESSAGES.de).sort();
    for (const lang of LANGS) {
      expect(Object.keys(MESSAGES[lang]).sort(), lang).toEqual(keys);
      for (const key of keys) expect(MESSAGES[lang][key as keyof typeof MESSAGES.de].trim(), `${lang} ${key}`).not.toBe('');
    }
  });

  it('uses the same placeholders in every language', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(MESSAGES.de) as (keyof typeof MESSAGES.de)[]) {
      expect(placeholders(MESSAGES.en[key]), key).toEqual(placeholders(MESSAGES.de[key]));
    }
  });

  it('names every topic', () => {
    for (const topic of TOPICS) expect(MESSAGES.de).toHaveProperty(`topic.${topic}`);
  });

  it('fills in placeholders', () => {
    expect(translate('en', 'summary.headline', { score: 7, total: 10 })).toBe('7 of 10 heads slain');
    expect(translate('de', 'summary.headline', { score: 7, total: 10 })).toBe('7 von 10 Köpfen erlegt');
  });
});
