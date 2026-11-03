import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels.ts';
import {
  choiceStates,
  EMPTY_PROGRESS,
  levelToShow,
  openLevel,
  parseGameProgress,
  pick,
  unlocked,
  type GameProgress,
} from './progress.ts';

const first = LEVELS[0]!;
const second = LEVELS[1]!;
/** A fixed rng: the shuffle is then deterministic. */
const rng = () => 0.3;

/** Slot of a choice in the current level. */
const slotOf = (p: GameProgress, choice: number) => p.current!.order.indexOf(choice);
const wrongChoices = first.choices.map((_, i) => i).filter((i) => i !== first.answerIndex);

/** All orders in which the wrong choices can be tried. */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));
}

describe('game progress', () => {
  it('opens a level with shuffled choices, and keeps a level already open', () => {
    const opened = openLevel(EMPTY_PROGRESS, first, rng);
    expect(opened.current).toMatchObject({ level: first.id, tried: [], solved: false });
    expect([...opened.current!.order].sort()).toEqual([0, 1, 2, 3]);
    expect(openLevel(opened, first, () => 0.9)).toBe(opened);
  });

  it('never reveals the right answer before it is picked, whatever wrong answers come first', () => {
    for (const order of permutations(wrongChoices)) {
      let progress = openLevel(EMPTY_PROGRESS, first, rng);
      for (const [n, choice] of order.entries()) {
        progress = pick(progress, first, slotOf(progress, choice));
        const states = choiceStates(first, progress.current!);
        expect(states).not.toContain('right');
        expect(states.filter((s) => s === 'wrong')).toHaveLength(n + 1);
        expect(states[slotOf(progress, first.answerIndex)]).toBe('open');
      }
      expect(progress.solved).toEqual([]);
      progress = pick(progress, first, slotOf(progress, first.answerIndex));
      expect(choiceStates(first, progress.current!)[slotOf(progress, first.answerIndex)]).toBe('right');
      expect(progress).toMatchObject({ solved: [first.id], picks: 4, correctPicks: 1 });
    }
  });

  it('ignores picks of a tried choice and of an unknown slot', () => {
    let progress = openLevel(EMPTY_PROGRESS, first, rng);
    progress = pick(progress, first, slotOf(progress, wrongChoices[0]!));
    expect(pick(progress, first, slotOf(progress, wrongChoices[0]!))).toBe(progress);
    expect(pick(progress, first, 7)).toBe(progress);
    expect(pick(progress, second, 0)).toBe(progress);
  });

  it('lets every answer be tried on a solved level without changing the score or un-solving it', () => {
    let progress = openLevel(EMPTY_PROGRESS, first, rng);
    progress = pick(progress, first, slotOf(progress, first.answerIndex));
    const score = { solved: [first.id], picks: 1, correctPicks: 1 };
    expect(progress).toMatchObject(score);
    expect(pick(progress, first, slotOf(progress, first.answerIndex))).toBe(progress);
    for (const [n, choice] of wrongChoices.entries()) {
      progress = pick(progress, first, slotOf(progress, choice));
      expect(progress).toMatchObject(score);
      expect(progress.current!.solved).toBe(true);
      expect(progress.current!.tried).toHaveLength(n + 1);
    }
    expect(pick(progress, first, slotOf(progress, wrongChoices[0]!))).toBe(progress);
    expect(choiceStates(first, progress.current!).filter((s) => s === 'wrong')).toHaveLength(3);
  });

  it('does not count picks on a level that was solved before and is reopened', () => {
    let progress = openLevel(EMPTY_PROGRESS, first, rng);
    progress = pick(progress, first, slotOf(progress, first.answerIndex));
    progress = openLevel(openLevel(progress, second, rng), first, rng);
    expect(progress.current).toMatchObject({ tried: [], solved: false });
    progress = pick(progress, first, slotOf(progress, wrongChoices[0]!));
    progress = pick(progress, first, slotOf(progress, first.answerIndex));
    expect(progress).toMatchObject({ solved: [first.id], picks: 1, correctPicks: 1 });
    expect(progress.current).toMatchObject({ solved: true, tried: [wrongChoices[0]] });
  });

  it('unlocks the solved levels and the first unsolved one', () => {
    expect(unlocked(EMPTY_PROGRESS, LEVELS)).toEqual(LEVELS.map((_, i) => i === 0));
    const progress = { ...EMPTY_PROGRESS, solved: [first.id, LEVELS[2]!.id] };
    expect(unlocked(progress, LEVELS).slice(0, 4)).toEqual([true, true, true, false]);
  });

  it('shows the level in progress, else the first unsolved one, else the first', () => {
    expect(levelToShow(EMPTY_PROGRESS, LEVELS)).toBe(first);
    expect(levelToShow({ ...EMPTY_PROGRESS, solved: [first.id] }, LEVELS)).toBe(second);
    const all = { ...EMPTY_PROGRESS, solved: LEVELS.map((l) => l.id) };
    expect(levelToShow(all, LEVELS)).toBe(first);
    expect(levelToShow(openLevel(all, LEVELS[4]!, rng), LEVELS)).toBe(LEVELS[4]);
  });

  it('round-trips through JSON', () => {
    let progress = openLevel(EMPTY_PROGRESS, first, rng);
    progress = pick(progress, first, slotOf(progress, wrongChoices[0]!));
    expect(parseGameProgress(JSON.parse(JSON.stringify(progress)), LEVELS)).toEqual(progress);
  });

  it('reads corrupt or foreign data defensively', () => {
    for (const raw of [null, 3, 'x', [], { picks: -1, correctPicks: 0 }, { picks: 1, correctPicks: 2 }]) {
      expect(parseGameProgress(raw, LEVELS)).toEqual(EMPTY_PROGRESS);
    }
    const base = { solved: [first.id, 'gone', first.id], picks: 2, correctPicks: 1 };
    expect(parseGameProgress(base, LEVELS)).toEqual({ solved: [first.id], picks: 2, correctPicks: 1 });
    const current = { level: first.id, order: [0, 1, 2, 3], tried: [], solved: false };
    for (const broken of [
      { ...current, level: 'gone' },
      { ...current, order: [0, 1, 2] },
      { ...current, order: [0, 0, 1, 2] },
      { ...current, tried: [first.answerIndex] },
      { ...current, tried: [1, 1] },
      { ...current, solved: 'yes' },
    ]) {
      expect(parseGameProgress({ ...base, current: broken }, LEVELS).current).toBeUndefined();
    }
  });
});
