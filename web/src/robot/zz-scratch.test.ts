import { it } from 'vitest';
import { ENEMIES } from './content/index.ts';
import { DEFAULT_BUILD, fightEnemy } from './fight.ts';
it('report', () => {
  const only = process.env.CH ? process.env.CH.split(',').map(Number) : undefined;
  const out: string[] = [];
  ENEMIES.forEach((e, i) => {
    if (only && !only.includes(e.chapter)) return;
    const r = fightEnemy(e, DEFAULT_BUILD, e.solution);
    const prev = ENEMIES[i - 1];
    const old = prev && prev.chapter === e.chapter ? fightEnemy(e, DEFAULT_BUILD, prev.solution) : undefined;
    out.push(`${e.id}: won=${r.won} unmet=${r.fight.unmet ?? ''} rounds=${r.fight.battle.frames.length - 1} dmg=${r.damage} err=${r.fight.battle.error?.message ?? ''} | oldsol won=${old?.won} err=${old?.fight.battle.error?.message ?? ''}`);
  });
  console.log(out.join('\n'));
});
