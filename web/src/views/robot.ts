import type { App, Screen } from '../app.ts';
import { h, svg } from '../dom.ts';
import { BACK } from '../icons.ts';
import type { MessageKey } from '../i18n.ts';
import { apiEntries } from '../robot/api.ts';
import { START_BUILD, UNLOCK_CHAPTER, CHASSIS, addonsFor, type Build, type GearId } from '../robot/build.ts';
import { checkConstraint, checkGlitch, checkLineUp, checkPredict, checkWorkshop, injectGlitch, predictAnswer, shuffledLines } from '../robot/challenges.ts';
import { cardsOfChapter } from '../robot/content/cards.ts';
import type { Challenge } from '../robot/content/challenges.ts';
import type { EnemyData } from '../robot/content/types.ts';
import type { EnemyReport, FightReport } from '../robot/fight.ts';
import { evaluateQueue, playItem, type LossReason, type QueueItem } from '../robot/variations.ts';
import { createViewer, type Speed, type Viewer } from './robot-viewer.ts';
import { friendlyError } from '../robot/friendly.ts';
import type { RunReport, Step } from '../robot/game.ts';
import { precheck as precheckFn, type BattleResult } from '../robot/battle.ts';
import type { RbError } from '../robot/py/errors.ts';
import { subpageHeader } from './header.ts';
import { benchEl } from './robot-bench.ts';
import { iconEl, partIconSpec, chassisIconSpec, specOf } from '../robot/art/compose.ts';
import { enemyBuild } from '../robot/battle.ts';
import type { RobotSpec } from '../robot/art/types.ts';

const GEAR_ORDER: GearId[] = ['blaster', 'cannon', 'eyes', 'hammer', 'shield', 'gps', 'plates'];

/** The picture on a part's concept card. */
function cardIcon(id: string): RobotSpec {
  const part = id.replace('part-', '');
  if (part === 'wide') return { ...partIconSpec('eyes'), wide: true };
  if (part === 'burst') return { ...partIconSpec('blaster'), mark: 2 };
  return partIconSpec(part);
}

/** Robot Battler: a map of tasks, and for each task the build / code / battle / improve loop. */
export function robotScreen(app: App): Screen {
  const { t, lang } = app;
  const game = app.services.robot;
  const root = h('main', { class: 'screen game robot' });
  const speed: Speed = { level: 1 };
  /** Stops whatever is playing on the current screen (set by the battle screen). */
  let cleanup: (() => void) | undefined;
  const stop = () => {
    cleanup?.();
    cleanup = undefined;
  };

  const titleOf = (s: Step) => (s.enemy ? s.enemy.title[lang] : s.challenge!.title[lang]);
  const errorText = (e: RbError) => friendlyError(e, lang);
  const rawError = (e: RbError) => h('details', { class: 'robot-original' }, h('summary', {}, t('robot.original')), h('code', {}, `${e.type}: ${e.detail}`));
  const errorBox = (e: RbError) =>
    h('div', { class: 'robot-error', role: 'alert', 'data-testid': 'robot-error' }, h('p', {}, t('robot.outcome.error', { line: e.line, message: errorText(e) })), rawError(e));

  function show(...children: (Node | null)[]) {
    stop();
    root.replaceChildren(...(children.filter(Boolean) as Node[]));
  }

  // ---------------------------------------------------------------- the map of tasks

  function showMap() {
    const p = game.progress();
    const chapters = [...new Set(game.steps.map((s) => s.chapter))];
    const upNext = game.steps.find((st) => game.unlocked(st.id) && !p.solved.includes(st.id) && (st.kind === 'battle' || st.challenge));
    const sections = chapters.map((chapter) => {
      const list = game.steps.filter((s) => s.chapter === chapter);
      const done = list.filter((s) => p.solved.includes(s.id)).length;
      const anyOpen = list.some((s) => game.unlocked(s.id));
      const isOpen = list.some((s) => game.unlocked(s.id) && !p.solved.includes(s.id));
      return h(
        'details',
        { class: `robot-chapter${done === list.length ? ' complete' : ''}${anyOpen ? '' : ' locked'}`, open: isOpen, 'data-testid': `robot-chapter-${chapter}` },
        h('summary', {}, h('h2', { class: 'robot-chapter-name' }, t(`robot.chapter.${chapter}` as MessageKey)), h('span', { class: 'robot-chapter-count' }, anyOpen ? t('robot.chapter.count', { done, n: list.length }) : t('robot.step.locked'))),
        h(
          'ul',
          { class: 'robot-steps' },
          ...list.map((s) => {
            const solved = p.solved.includes(s.id);
            const open = game.unlocked(s.id);
            const stars = p.stars[s.id] ?? 0;
            const state = solved ? t('robot.step.solved') : open ? '' : t('robot.step.locked');
            return h(
              'li',
              {},
              h(
                'button',
                {
                  class: `robot-step${solved ? ' solved' : ''}${s.kind === 'battle' ? '' : ' challenge'}${s.id === upNext?.id ? ' next' : ''}`,
                  'data-testid': `robot-step-${s.id}`,
                  disabled: !open,
                  onclick: () => {
                    game.open(s.id);
                    showStep(s.id);
                  },
                },
                h('span', { class: 'robot-main' }, h('span', { class: 'robot-title' }, titleOf(s)), h('span', { class: 'robot-kind' }, [t(`robot.kind.${s.kind}` as MessageKey), s.enemy?.regression === false ? t('robot.side') : ''].filter(Boolean).join(' · '))),
                h('span', { class: 'robot-state' }, [solved ? `✓ ${state}` : state, stars > 0 ? '★'.repeat(stars) : ''].filter(Boolean).join(' ')),
              ),
            );
          }),
        ),
      );
    });
    const resume = upNext
      ? h('button', { class: 'robot-run robot-continue', 'data-testid': 'robot-continue', onclick: () => (game.open(upNext.id), showStep(upNext.id)) }, h('small', {}, t(p.solved.length === 0 ? 'robot.start' : 'robot.continue')), h('span', {}, titleOf(upNext)))
      : null;
    show(
      subpageHeader(app, t('lesson.robot.title')),
      h('div', { class: 'robot-map', 'data-testid': 'robot-map' }, resume, p.solved.includes('final-exam') ? h('p', { class: 'robot-win', 'data-testid': 'robot-certificate' }, `🎓 ${t('robot.certificate')}`) : null, game.canTrain() ? h('button', { class: 'run-control', 'data-testid': 'robot-training', onclick: showTraining }, t('robot.training')) : null, ...sections),
    );
  }

  // ---------------------------------------------------------------- concept cards

  /** The chapter's cards: unread ones are open with a "Got it" button, read ones stay one click away. */
  function cardsBlock(chapter: number): Node | null {
    const cards = cardsOfChapter(chapter);
    if (cards.length === 0) return null;
    return h(
      'section',
      { class: 'robot-cards', 'data-testid': 'robot-cards' },
      ...cards.map((c) => {
        const unseen = !game.cardSeen(c.id);
        const box = h(
          'details',
          { class: `robot-card-note${unseen ? ' new' : ''}`, 'data-testid': `robot-card-${c.id}`, open: unseen },
          h('summary', {}, c.kind === 'part' ? iconEl(cardIcon(c.id), 36) : null, h('span', {}, `${t('robot.card')}: ${c.title[lang]}`)),
          h('p', {}, c.idea[lang]),
          h('h4', {}, t('robot.card.example')),
          h('pre', {}, h('code', {}, c.example)),
          h('p', {}, h('strong', {}, `${t('robot.card.try')}: `), c.tryIt[lang]),
          unseen
            ? h('button', { class: 'run-control', 'data-testid': `robot-card-gotit-${c.id}`, onclick: () => (game.markCard(c.id), box.removeAttribute('open'), box.classList.remove('new'), btnRemove()) }, t('robot.card.gotit'))
            : null,
        );
        const btnRemove = () => box.querySelector('button')?.remove();
        return box;
      }),
    );
  }

  // ---------------------------------------------------------------- build panel

  /** The panel closes when the screen redraws after a change; remember to open it again, with the last note. */
  let buildOpen = false;
  let buildNote = '';
  /** What is picked on the robot picture, and which parts were just plugged in (they snap in once). */
  let benchSel: string | undefined;
  let snapIds: string[] = [];

  function buildPanel(onChange: () => void): HTMLElement {
    const build = game.build();
    const note = h('p', { class: 'robot-note', 'aria-live': 'polite', 'data-testid': 'robot-build-note' }, buildNote);
    buildNote = '';
    const used = build.gear.length;
    const slots = CHASSIS[build.chassis].slots;
    /** Applies a change; refused builds explain why. */
    const apply = (next: Build) => {
      const withAddons: Build = { ...next, addons: next.gear.includes('eyes') ? addonsFor(game.level()) : [] };
      buildOpen = true;
      snapIds = [...withAddons.gear.filter((g) => !build.gear.includes(g)), ...(withAddons.locomotion !== build.locomotion ? [withAddons.locomotion] : []), ...(withAddons.blasterMark === 2 && build.blasterMark !== 2 ? ['blaster'] : [])];
      buildNote = game.setBuild(withAddons) ? '' : withAddons.gear.length > CHASSIS[withAddons.chassis].slots ? t('robot.build.full') : t('robot.build.locked');
      onChange();
    };
    const radio = (name: string, value: string, label: string, checked: boolean, ok: boolean, change: () => void) =>
      h(
        'label',
        { class: `robot-option${ok ? '' : ' locked'}` },
        h('input', { type: 'radio', name, value, checked, disabled: !ok, 'data-testid': `robot-${name}-${value}`, onchange: change }),
        iconEl(name === 'chassis' ? chassisIconSpec(value) : partIconSpec(value), 40),
        label,
      );
    const snap = snapIds;
    snapIds = [];
    return h(
      'details',
      { class: 'robot-build', 'data-testid': 'robot-build', open: buildOpen },
      h('summary', {}, iconEl(specOf(build), 36), h('span', {}, t('robot.build'))),
      benchEl({
        t,
        build,
        can: (kind, id) => game.can(kind, id),
        apply,
        selected: benchSel,
        select: (sel) => {
          benchSel = sel;
          buildOpen = true;
          onChange();
        },
        snap,
      }),
      h('fieldset', {}, h('legend', {}, t('robot.build.chassis')), ...(['light', 'medium'] as const).map((c) => radio('chassis', c, t(`robot.chassis.${c}`), build.chassis === c, game.can('chassis', c) && (c === 'light' || build.gear.length <= CHASSIS[c].slots), () => apply({ ...build, chassis: c })))),
      h('fieldset', {}, h('legend', {}, t('robot.build.locomotion')), ...(['wheels', 'legs', 'treads'] as const).map((l) => radio('locomotion', l, t(`robot.loco.${l}`), build.locomotion === l, game.can('locomotion', l), () => apply({ ...build, locomotion: l })))),
      h(
        'fieldset',
        {},
        h('legend', {}, t('robot.build.gear', { used, n: slots })),
        ...GEAR_ORDER.map((g) => {
          const on = build.gear.includes(g);
          const ok = game.can('gear', g);
          return h(
            'label',
            { class: `robot-option${ok ? '' : ' locked'}` },
            h('input', { type: 'checkbox', checked: on, disabled: !ok && !on, 'data-testid': `robot-gear-${g}`, onchange: (e: Event) => apply({ ...build, gear: (e.target as HTMLInputElement).checked ? [...build.gear, g] : build.gear.filter((x) => x !== g) }) }),
            iconEl(partIconSpec(g), 40),
            t(`robot.gear.${g}`),
          );
        }),
        build.gear.includes('blaster') && game.can('gear', 'blaster') && UNLOCK_CHAPTER.blasterMark2 <= game.level()
          ? h('label', { class: 'robot-option' }, h('input', { type: 'checkbox', checked: build.blasterMark === 2, onchange: (e: Event) => apply({ ...build, blasterMark: (e.target as HTMLInputElement).checked ? 2 : 1 }) }), t('robot.mk2'))
          : null,
      ),
      build.addons.length > 0 ? h('p', { class: 'robot-addons' }, `${t('robot.build.addons')}: ${build.addons.map((a) => t(`robot.addon.${a}` as MessageKey)).join(', ')}`) : null,
      note,
    );
  }

  function apiPanel(build: Build, open = false): HTMLElement {
    return h(
      'details',
      { class: 'robot-api', 'data-testid': 'robot-api', open },
      h('summary', {}, t('robot.api')),
      h('dl', {}, ...apiEntries(build).flatMap((e) => [h('dt', {}, h('code', {}, e.sig)), h('dd', {}, t(`robot.api.${e.id}` as MessageKey))])),
    );
  }

  // ---------------------------------------------------------------- the editor

  function editor(initial: string, onInput: (text: string) => void, testId = 'robot-code'): HTMLTextAreaElement {
    const area = h('textarea', { class: 'robot-code', rows: 4, spellcheck: false, autocapitalize: 'off', autocomplete: 'off', 'aria-label': t('robot.code'), 'data-testid': testId }) as HTMLTextAreaElement;
    area.value = initial;
    const fit = () => (area.rows = Math.max(5, Math.min(16, area.value.split('\n').length + 1)));
    fit();
    area.addEventListener('input', () => (fit(), onInput(area.value)));
    area.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || e.shiftKey) return;
      e.preventDefault();
      area.setRangeText('    ', area.selectionStart, area.selectionEnd, 'end');
      fit();
      onInput(area.value);
    });
    return area;
  }

  // ---------------------------------------------------------------- the variation queue

  /** Why a fight was not won, in words. */
  function unmetText(unmet: NonNullable<FightReport['unmet']>, enemy: EnemyData): string {
    const words = (list: string[] | undefined) => (list ?? []).map((w) => `"${w}"`).join(', ');
    switch (unmet) {
      case 'say':
        return t('robot.outcome.say');
      case 'sayPrefix':
        return t('robot.outcome.sayPrefix', { text: enemy.needs?.sayPrefix ?? '' });
      case 'damage':
        return t('robot.outcome.damage', { max: enemy.needs?.maxDamage ?? 0 });
      case 'waste':
        return t('robot.outcome.waste');
      case 'uses':
        return t('robot.outcome.uses', { words: words(enemy.needs?.uses) });
      case 'without':
        return t('robot.outcome.without', { words: words(enemy.needs?.without) });
      case 'repeat':
        return t('robot.outcome.repeat');
      case 'sayOnce':
        return t('robot.outcome.sayOnce', { text: enemy.needs?.sayOnce ?? '' });
    }
  }

  function lossText(reason: LossReason, enemy: EnemyData): string {
    switch (reason.code) {
      case 'error':
        return t('robot.outcome.stop', { line: reason.line, message: errorText(reason.error) });
      case 'budget':
        return t('robot.outcome.budget', { line: reason.line, message: t('robot.err.loop-budget') });
      case 'dead':
        return t('robot.vq.dead');
      case 'timeout':
        return t('robot.vq.timeout');
      case 'unmet':
        return unmetText(reason.unmet, enemy);
    }
  }

  /**
   * The fights of a run, one after another: the first fight of the enemy, then its other variations and the
   * earlier enemies of the chapter. Each plays in the line-by-line viewer; a queue bar shows the progress and
   * a summary at the end says who won and why a loss happened.
   */
  function variationQueue(items: QueueItem[], build: Build, script: string, tooLong: Node | null): { el: HTMLElement; dispose: () => void } {
    const outcomes = evaluateQueue(items, build, script);
    const done = new Set<number>();
    let current = 0;
    let auto = true;
    let oldOpen = false;
    let viewer: Viewer | undefined;
    let autoTimer: ReturnType<typeof setTimeout> | undefined;
    const holder = h('div', { class: 'robot-viewer' });
    const progress = h('p', { class: 'robot-vq-progress', 'data-testid': 'robot-vq-progress' });
    const stateTag = h('span', { class: 'robot-vq-state', 'data-testid': 'robot-vq-state' });
    const reasonBox = h('p', { class: 'robot-note', 'data-testid': 'robot-vq-reason' });
    const chips = h('div', { class: 'robot-layouts', role: 'group', 'data-testid': 'robot-vq-chips' });
    const summary = h('div', { class: 'robot-vq-summary', 'data-testid': 'robot-vq-summary' });
    const nextBtn = h('button', { class: 'run-control', 'data-testid': 'robot-vq-next', onclick: () => load(current + 1, true) }, t('robot.vq.next'));
    const skipBtn = h('button', { class: 'run-control', 'data-testid': 'robot-vq-skip', onclick: skip }, t('robot.vq.skip'));
    const allBtn = h('button', { class: 'run-control', 'data-testid': 'robot-vq-all', onclick: skipAll }, t('robot.vq.all'));
    const autoBox = h('input', { type: 'checkbox', checked: true, 'data-testid': 'robot-vq-auto', onchange: () => ((auto = autoBox.checked), !auto && cancelAuto()) }) as HTMLInputElement;
    const labelOf = (item: QueueItem) => (item.regression ? `${item.enemy.title[lang]} ${item.n}` : t('robot.layout', { n: item.n }));
    const cancelAuto = () => {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = undefined;
    };

    function paint() {
      const item = items[current]!;
      const out = outcomes[current]!;
      const finished = done.has(current);
      progress.textContent = t(item.regression ? 'robot.vq.progress.old' : 'robot.vq.progress', { k: current + 1, n: items.length, title: item.enemy.title[lang], v: item.n, m: item.of });
      const state = finished ? (out.won ? 'won' : 'lost') : 'running';
      stateTag.textContent = t(`robot.vq.state.${state}` as MessageKey);
      stateTag.dataset.state = state;
      reasonBox.textContent = finished && out.reason ? lossText(out.reason, item.enemy) : '';
      const chipOf = (it: QueueItem, i: number) => {
          const o = outcomes[i]!;
          const seen = done.has(i);
          const state = seen ? (o.won ? 'won' : 'lost') : 'pending';
          return h(
            'button',
            {
              class: `run-control layout${seen ? (o.won ? ' won' : ' lost') : ''}${it.regression ? ' old' : ''}`,
              'data-testid': it.regression ? `robot-vq-chip-${it.key}` : `robot-layout-${it.n}`,
              'aria-pressed': String(i === current),
              'aria-label': `${labelOf(it)}, ${t(`robot.vq.state.${state}` as MessageKey)}`,
              onclick: () => load(i, false),
            },
            `${seen ? (o.won ? '✓' : '✗') : '·'} ${labelOf(it)}`,
          );
      };
      const olds = items.flatMap((it, i) => (it.regression ? [chipOf(it, i)] : []));
      const oldDone = items.filter((it, i) => it.regression && done.has(i) && outcomes[i]!.won).length;
      chips.replaceChildren(
        ...items.flatMap((it, i) => (it.regression ? [] : [chipOf(it, i)])),
        ...(olds.length > 0
          ? [h('details', { class: 'robot-vq-old', open: oldOpen || items[current]!.regression === true, 'data-testid': 'robot-vq-old', ontoggle: (e: Event) => (oldOpen = (e.target as HTMLDetailsElement).open) }, h('summary', {}, t('robot.vq.olds', { done: oldDone, n: olds.length })), h('div', { class: 'robot-layouts' }, ...olds))]
          : []),
      );
      const last = current >= items.length - 1;
      nextBtn.hidden = !finished || last;
      skipBtn.hidden = finished && last;
      allBtn.hidden = done.size >= items.length;
    }

    function showSummary() {
      const won = outcomes.filter((o) => o.won).length;
      const row = (o: (typeof outcomes)[number], i: number) =>
        h(
          'li',
          { class: o.won ? 'won' : 'lost', 'data-testid': `robot-vq-row-${o.item.key}` },
          h('strong', {}, `${o.won ? '✓' : '✗'} ${o.item.regression ? `${t('robot.vq.old')}: ` : ''}${o.item.enemy.title[lang]} · ${t('robot.layout', { n: o.item.n })}`),
          h('span', { class: 'robot-note' }, ` ${t('robot.vq.ticks', { n: o.ticks })}`),
          o.reason ? h('span', { class: 'robot-vq-why' }, lossText(o.reason, o.item.enemy)) : null,
          h('button', { class: 'run-control', 'data-testid': `robot-vq-watch-${o.item.key}`, onclick: () => (load(i, false), holder.scrollIntoView?.({ block: 'center', behavior: 'smooth' })) }, t('robot.vq.watch')),
        );
      const lostRows = outcomes.flatMap((o, i) => (o.won ? [] : [row(o, i)]));
      const wonRows = outcomes.flatMap((o, i) => (o.won ? [row(o, i)] : []));
      summary.replaceChildren(
        h('h3', {}, t('robot.vq.summary', { won, n: items.length })),
        h('p', { class: won === items.length ? 'robot-win' : 'robot-loss', 'data-testid': 'robot-vq-verdict' }, t(won === items.length ? 'robot.vq.summary.ok' : 'robot.vq.summary.bad')),
        ...(tooLong ? [tooLong] : []),
        ...(lostRows.length > 0 ? [h('ul', { class: 'robot-vq-rows' }, ...lostRows.slice(0, 4))] : []),
        ...(lostRows.length > 4 ? [h('details', { class: 'robot-vq-won', 'data-testid': 'robot-vq-more-lost' }, h('summary', {}, t('robot.vq.moreLost', { n: lostRows.length - 4 })), h('ul', { class: 'robot-vq-rows' }, ...lostRows.slice(4)))] : []),
        ...(wonRows.length > 0 ? [h('details', { class: 'robot-vq-won', 'data-testid': 'robot-vq-won' }, h('summary', {}, t('robot.vq.wonList', { n: wonRows.length })), h('ul', { class: 'robot-vq-rows' }, ...wonRows))] : []),
      );
    }

    function finish(i: number) {
      done.add(i);
      if (done.size >= items.length) showSummary();
      if (i === current) paint();
    }

    function load(i: number, play: boolean) {
      cancelAuto();
      viewer?.dispose();
      current = Math.max(0, Math.min(items.length - 1, i));
      const item = items[current]!;
      const at = current;
      const report = playItem(item, build, script, true);
      viewer = createViewer(report.battle, script, {
        t,
        speed,
        onUser: cancelAuto,
        onEnd: (byPlay) => {
          finish(at);
          if (byPlay && auto) autoTimer = setTimeout(() => (at < items.length - 1 ? load(at + 1, true) : undefined), 1500);
        },
      });
      holder.replaceChildren(viewer.el);
      paint();
      if (play) viewer.play();
    }

    function skip() {
      const playing = viewer?.playing() ?? false;
      finish(current);
      if (current < items.length - 1) load(current + 1, playing);
    }
    function skipAll() {
      cancelAuto();
      viewer?.pause();
      items.forEach((_, i) => done.add(i));
      showSummary();
      paint();
      summary.scrollIntoView?.({ block: 'nearest' });
    }

    const el = h(
      'div',
      { class: 'robot-queue', 'data-testid': 'robot-queue' },
      h('h3', {}, t('robot.vq.title')),
      chips,
      h('div', { class: 'robot-vq-head' }, progress, stateTag),
      reasonBox,
      holder,
      h('div', { class: 'robot-actions' }, skipBtn, nextBtn, allBtn, h('label', { class: 'robot-option' }, autoBox, t('robot.vq.auto'))),
      summary,
    );
    load(0, false);
    return { el, dispose: () => (cancelAuto(), viewer?.dispose()) };
  }

  // ---------------------------------------------------------------- a battle step

  function outcomeFor(run: RunReport, report: EnemyReport, enemyStep: Step): { text: string; ok: boolean; extra: Node[] } {
    const enemy = enemyStep.enemy!;
    const n = report.fights.length;
    const lost = report.fights.filter((f) => !f.won).length;
    const extra: Node[] = [];
    if (run.won) {
      extra.push(h('p', { 'data-testid': 'robot-stars' }, `${'★'.repeat(run.stars)}${'☆'.repeat(3 - run.stars)} ${t('robot.stars', { n: run.stars })}`), h('p', { class: 'robot-note' }, t('robot.stars.rule', { par: enemy.par })));
      return { text: t(run.firstWin ? 'robot.outcome.firstWin' : 'robot.outcome.win', { n }), ok: true, extra };
    }
    if (run.broken.length > 0) {
      const names = run.broken.map((id) => titleOf(game.step(id)!)).join(', ');
      return { text: t('robot.regression.broken', { names }), ok: false, extra };
    }
    if (report.tooLong) return { text: t('robot.outcome.tooLong', { lines: report.lines, max: enemy.needs?.maxLines ?? 0 }), ok: false, extra };
    const failed = report.fights.find((f) => !f.won)!;
    const b = failed.battle;
    if (failed.unmet) return { text: unmetText(failed.unmet, enemy), ok: false, extra };
    if (b.error) {
      extra.push(rawError(b.error));
      return { text: t('robot.outcome.stop', { line: b.error.line, message: errorText(b.error) }), ok: false, extra };
    }
    if (b.budgetLine !== undefined) return { text: t('robot.outcome.budget', { line: b.budgetLine, message: t('robot.err.loop-budget') }), ok: false, extra };
    return { text: t('robot.outcome.lost', { lost, n }), ok: false, extra };
  }

  /** How a battle screen runs its fight and where it leads: the task map, or the Training Grounds. */
  interface BattleOpts {
    run: () => RunReport | undefined;
    next: () => { label: string; go: () => void } | undefined;
    back: () => void;
    /** Training fights are not stored: their hints live only on the screen. */
    training?: boolean;
  }

  function showBattle(step: Step, opts: BattleOpts = taskOpts(step)) {
    const enemy = step.enemy!;
    let localHint = 0;
    const hintCount = () => (opts.training ? localHint : game.hint(step.id));
    const result = h('div', { class: 'robot-result', 'data-testid': 'robot-result' }, h('p', { 'data-testid': 'robot-outcome', 'aria-live': 'polite' }, t('robot.outcome.idle')));
    const hintBox = h('div', { class: 'robot-hints', 'data-testid': 'robot-hints' });
    const historyBox = h('details', { class: 'robot-history', 'data-testid': 'robot-history' });
    let area: HTMLTextAreaElement;

    const hintText = (n: number): Node =>
      n === 1 ? h('p', {}, t('robot.hint.1', { text: enemy.twist[lang] })) : n === 2 ? h('p', {}, t('robot.hint.2', { text: enemy.idea[lang] })) : h('div', {}, h('p', {}, t('robot.hint.3')), h('pre', {}, h('code', {}, enemy.skeleton)));
    function renderHints() {
      const shown = hintCount();
      hintBox.replaceChildren(...Array.from({ length: shown }, (_, i) => hintText(i + 1)));
    }
    function renderHistory() {
      const history = game.history();
      historyBox.replaceChildren(
        h('summary', {}, t('robot.history')),
        history.length === 0
          ? h('p', {}, t('robot.history.empty'))
          : h(
              'ol',
              {},
              ...history.map((entry, i) =>
                h(
                  'li',
                  {},
                  h('span', {}, `${titleOf(game.step(entry.step)!)} · ${t(`robot.history.${entry.result}` as MessageKey)} · ${entry.script.split('\n').filter((l) => l.trim()).length}`),
                  h('button', { class: 'run-control', 'data-testid': `robot-restore-${i}`, onclick: () => (game.restore(i), area && (area.value = game.script()), renderHistory()) }, t('robot.history.restore')),
                ),
              ).reverse(),
            ),
      );
    }

    function fight() {
      const run = opts.run();
      if (!run) return;
      renderHistory();
      if (run.error) {
        result.replaceChildren(errorBox(run.error));
        return;
      }
      const report = run.report!;
      const { text, ok, extra } = outcomeFor(run, report, step);
      stop();
      const queue = variationQueue(game.variationQueue(step), game.build(), game.script(), report.tooLong ? h('p', { class: 'robot-loss' }, t('robot.outcome.tooLong', { lines: report.lines, max: enemy.needs?.maxLines ?? 0 })) : null);
      cleanup = queue.dispose;
      const regression = enemy.regression === false ? null : h('p', { class: 'robot-note' }, run.broken.length === 0 && run.won ? t('robot.regression.ok') : '');
      const next = run.won ? opts.next() : undefined;
      result.replaceChildren(
        ...[
        h('p', { class: ok ? 'robot-win' : 'robot-loss', 'data-testid': 'robot-outcome', 'data-state': ok ? 'won' : 'lost', 'aria-live': 'polite' }, text),
        ...extra,
        regression,
        queue.el,
        next ? h('button', { class: 'robot-next', 'data-testid': 'robot-next', onclick: next.go }, next.label) : null,
        ].filter((n): n is HTMLElement => n !== null),
      );
    }

    const build = game.build();
    show(
      stepHeader(step, opts.back),
      h(
        'section',
        { class: 'robot-card robot-twist' },
        h('div', { class: 'robot-foes', 'data-testid': 'robot-foes' }, ...enemy.enemies.map((def) => iconEl(specOf(enemyBuild(def)), 64, { enemy: true, label: () => t('robot.enemy') }))),
        h('h3', {}, t('robot.twist')),
        h('p', { 'data-testid': 'robot-twist' }, enemy.twist[lang]),
      ),
      opts.training ? null : cardsBlock(step.chapter),
      h('section', { class: 'robot-editor' }, h('h3', {}, t('robot.code')), h('p', { class: 'robot-note' }, t('robot.code.hint')), (area = editor(game.script(), (text) => game.setScript(text)))),
      h(
        'div',
        { class: 'robot-actions' },
        h('button', { class: 'robot-run', 'data-testid': 'robot-run', onclick: () => (game.setScript(area.value), fight(), result.scrollIntoView?.({ block: 'start', behavior: 'smooth' })) }, t('robot.run')),
        h('button', { class: 'run-control', 'data-testid': 'robot-hint', onclick: () => (opts.training ? (localHint = Math.min(3, localHint + 1)) : game.hint(step.id) < 3 && game.nextHint(step.id), renderHints()) }, t('robot.hint')),
      ),
      hintBox,
      result,
      apiPanel(build),
      buildPanel(() => showStep(step.id)),
      historyBox,
    );
    renderHints();
    renderHistory();
  }

  function taskOpts(step: Step): BattleOpts {
    return {
      run: () => game.run(step.id),
      next: () => {
        const n = nextStep(step);
        return n ? { label: `${t('robot.next')}: ${titleOf(n)}`, go: () => (game.open(n.id), showStep(n.id)) } : undefined;
      },
      back: () => (game.open(step.id), showMap()),
    };
  }

  // ---------------------------------------------------------------- Training Grounds

  function showTraining() {
    const stats = game.trainingStats();
    const play = (step: Step) =>
      showBattle(step, {
        run: () => game.runTraining(step),
        next: () => ({ label: t('robot.training.another'), go: () => play(game.trainingStep(game.nextTrainingSeed())) }),
        back: showTraining,
        training: true,
      });
    show(
      subpageHeader(app, t('robot.training')),
      h('p', { class: 'robot-card' }, t('robot.training.intro')),
      h('p', { 'data-testid': 'robot-training-stats' }, t('robot.training.stats', { wins: stats.wins })),
      h('div', { class: 'robot-actions' },
        h('button', { class: 'robot-run', 'data-testid': 'robot-train-daily', onclick: () => play(game.trainingStep('daily')) }, t(stats.dailyDone ? 'robot.training.dailyDone' : 'robot.training.daily')),
        h('button', { class: 'run-control', 'data-testid': 'robot-train-new', onclick: () => play(game.trainingStep(game.nextTrainingSeed())) }, t('robot.training.new')),
        h('button', { class: 'run-control', 'data-testid': 'robot-train-back', onclick: showMap }, t('robot.toMap')),
      ),
    );
  }

  /** The next unsolved battle after this step, for the "Next" button. */
  function nextStep(step: Step): Step | undefined {
    const i = game.steps.indexOf(step);
    return game.steps.slice(i + 1).find((s) => s.kind === 'battle' && game.unlocked(s.id) && !game.progress().solved.includes(s.id));
  }

  function stepHeader(step: Step, back: () => void = () => (game.open(step.id), showMap())): HTMLElement {
    return h(
      'header',
      { class: 'subpage-header' },
      h('button', { class: 'icon-button', 'aria-label': t('nav.back'), title: t('nav.back'), onclick: back }, svg(BACK)),
      h('h1', { tabindex: -1, 'data-testid': 'robot-step-title' }, titleOf(step)),
    );
  }

  // ---------------------------------------------------------------- challenges

  function feedback(ok: boolean, step: Step) {
    if (ok) game.complete(step.id);
    else game.miss(step.id);
    return h('p', { class: ok ? 'robot-win' : 'robot-loss', 'data-testid': 'robot-feedback', role: 'status' }, t(ok ? 'robot.right' : 'robot.wrong'));
  }

  function showChallenge(step: Step) {
    const c: Challenge = step.challenge!;
    const out = h('div', { 'data-testid': 'robot-result' });
    const back = h('button', { class: 'run-control', 'data-testid': 'robot-to-map', onclick: showMap }, t('robot.toMap'));
    const head = [stepHeader(step), h('p', { class: 'robot-card', 'data-testid': 'robot-prompt' }, c.prompt[lang])];
    switch (c.kind) {
      case 'lineup': {
        let order = shuffledLines(c);
        const list = h('ol', { class: 'robot-lineup', 'data-testid': 'robot-lineup', 'aria-label': t('robot.lineup.lines') });
        const draw = () =>
          list.replaceChildren(
            ...order.map((line, i) =>
              h(
                'li',
                { 'data-testid': `robot-line-${i}` },
                h('code', {}, line),
                h('button', { class: 'icon-button', 'aria-label': t('robot.lineup.up'), disabled: i === 0, 'data-testid': `robot-up-${i}`, onclick: () => ([order[i - 1], order[i]] = [order[i]!, order[i - 1]!], draw()) }, '↑'),
                h('button', { class: 'icon-button', 'aria-label': t('robot.lineup.down'), disabled: i === order.length - 1, 'data-testid': `robot-down-${i}`, onclick: () => ([order[i + 1], order[i]] = [order[i]!, order[i + 1]!], draw()) }, '↓'),
              ),
            ),
          );
        draw();
        show(...head, list, h('button', { class: 'robot-run', 'data-testid': 'robot-check', onclick: () => out.replaceChildren(feedback(checkLineUp(c, order), step)) }, t('robot.lineup.check')), out, back);
        break;
      }
      case 'predict': {
        const input = h('input', { type: 'text', class: 'robot-answer', 'aria-label': t('robot.predict.answer'), autocomplete: 'off', 'data-testid': 'robot-answer' }) as HTMLInputElement;
        let misses = 0;
        show(
          ...head,
          h('h3', {}, t('robot.predict.script')),
          h('pre', { class: 'robot-listing-static' }, h('code', {}, c.script)),
          input,
          h('button', { class: 'robot-run', 'data-testid': 'robot-check', onclick: () => {
            const ok = checkPredict(c, input.value);
            misses += ok ? 0 : 1;
            out.replaceChildren(feedback(ok, step), ...(misses >= 2 ? [h('p', { 'data-testid': 'robot-was' }, t('robot.predict.was', { answer: predictAnswer(c) }))] : []));
          } }, t('robot.lineup.check')),
          out,
          back,
        );
        break;
      }
      case 'glitch': {
        const bugged = injectGlitch(c, game.script());
        const area = editor(bugged, () => {}, 'robot-glitch-code');
        show(...head, h('p', { class: 'robot-note' }, t('robot.glitch.note')), area, h('button', { class: 'robot-run', 'data-testid': 'robot-check', onclick: () => out.replaceChildren(...glitchResult(c, area.value, step)) }, t('robot.glitch.fix')), out, back);
        break;
      }
      case 'workshop': {
        const area = editor(c.skeleton, () => {}, 'robot-workshop-code');
        show(...head, h('p', { class: 'robot-note' }, t('robot.workshop.note')), apiPanel({ ...START_BUILD }), area, h('button', { class: 'robot-run', 'data-testid': 'robot-check', onclick: () => {
          const r = checkWorkshop(c, area.value);
          out.replaceChildren(r.error ? h('p', { class: 'robot-loss', role: 'alert' }, r.error) : feedback(r.ok, step), workshopPicture(c.target, t('robot.workshop.target')), workshopPicture(r.trail, t('robot.workshop.yours')));
        } }, t('robot.workshop.run')), out, back);
        break;
      }
      case 'constraint': {
        const area = editor(game.script(), (text) => game.setScript(text), 'robot-constraint-code');
        show(...head, h('p', { class: 'robot-note' }, [c.maxLines !== undefined ? t('robot.constraint.rule', { n: c.maxLines }) : '', c.rule ? c.rule[lang] : ''].filter(Boolean).join(' ')), apiPanel(game.build()), area, h('button', { class: 'robot-run', 'data-testid': 'robot-check', onclick: () => out.replaceChildren(...constraintResult(c, area.value, step)) }, t('robot.run')), out, back);
        break;
      }
    }
  }

  function glitchResult(c: Extract<Challenge, { kind: 'glitch' }>, script: string, step: Step): Node[] {
    const build = game.build();
    try {
      const { precheckError } = precheckOf(build, script);
      if (precheckError) return [errorBox(precheckError)];
    } catch {
      // fall through to the battle
    }
    return [feedback(checkGlitch(c, script, build), step)];
  }

  function constraintResult(c: Extract<Challenge, { kind: 'constraint' }>, script: string, step: Step): Node[] {
    game.setScript(script);
    const { precheckError } = precheckOf(game.build(), script);
    if (precheckError) return [errorBox(precheckError)];
    return [feedback(checkConstraint(c, script, game.build()), step)];
  }

  function precheckOf(build: Build, script: string): { precheckError?: RbError } {
    const e = precheckFn(build, script);
    return e ? { precheckError: e } : {};
  }

  function workshopPicture(tiles: readonly string[], label: string): HTMLElement {
    const set = new Set(tiles);
    return h(
      'figure',
      { class: 'robot-picture' },
      h('figcaption', {}, label),
      h('div', { class: 'robot-pixels', role: 'img', 'aria-label': label }, ...Array.from({ length: 64 }, (_, i) => h('i', { class: set.has(`${i % 8},${Math.floor(i / 8)}`) ? 'on' : '' }))),
    );
  }

  function showStep(id: string) {
    const step = game.step(id)!;
    game.open(id);
    if (step.kind === 'battle') showBattle(step);
    else showChallenge(step);
    root.querySelector<HTMLElement>('[data-testid="robot-step-title"]')?.focus();
  }

  showMap();
  return { root, dispose: stop };
}

