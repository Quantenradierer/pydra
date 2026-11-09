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
import { createWork, type Phase } from './robot-work.ts';
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
    root.classList.remove('robot-workmode');
    root.replaceChildren(...(children.filter(Boolean) as Node[]));
  }

  /** The zoned work screen fills the viewport; the page itself does not scroll. */
  function showWork(el: HTMLElement) {
    stop();
    root.classList.add('robot-workmode');
    root.replaceChildren(el);
  }

  // ---------------------------------------------------------------- the map of tasks

  function showMap() {
    const p = game.progress();
    const chapters = [...new Set(game.steps.map((s) => s.chapter))];
    const upNext = game.steps.find((st) => game.unlocked(st.id) && !p.solved.includes(st.id) && (st.kind === 'battle' || st.challenge));
    /** One list of step buttons. */
    const row = (list: Step[]): Node | null =>
      list.length === 0
        ? null
        : h(
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
          );
    /** Finished and locked steps fold away; what can be played now stays in sight. */
    const fold = (list: Step[], key: MessageKey, id: string): Node | null =>
      list.length === 0 ? null : h('details', { class: 'robot-fold', 'data-testid': id }, h('summary', {}, t(key, { n: list.length })), row(list));
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
          'div',
          { class: 'robot-chapter-body' },
          ...[
            fold(list.filter((s) => p.solved.includes(s.id)), 'work.map.done', 'robot-fold-done'),
            row(list.filter((s) => !p.solved.includes(s.id) && game.unlocked(s.id))),
            fold(list.filter((s) => !p.solved.includes(s.id) && !game.unlocked(s.id)), 'work.map.locked', 'robot-fold-locked'),
          ],
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
  function cardsBlock(chapter: number, onSeen: () => void): Node | null {
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
            ? h('button', { class: 'run-control', 'data-testid': `robot-card-gotit-${c.id}`, onclick: () => (game.markCard(c.id), box.removeAttribute('open'), box.classList.remove('new'), btnRemove(), onSeen()) }, t('robot.card.gotit'))
            : null,
        );
        const btnRemove = () => box.querySelector('button')?.remove();
        return box;
      }),
    );
  }

  // ---------------------------------------------------------------- build panel

  /** The panel closes when the screen redraws after a change; remember to open it again, with the last note. */
  let buildNote = '';
  /** What is picked on the robot picture, and which parts were just plugged in (they snap in once). */
  let benchSel: string | undefined;
  let snapIds: string[] = [];

  function buildPanel(onChange: () => void): { bench: HTMLElement; parts: HTMLElement } {
    const build = game.build();
    const note = h('p', { class: 'robot-note', 'aria-live': 'polite', 'data-testid': 'robot-build-note' }, buildNote);
    const noteCopy = h('p', { class: 'robot-note' }, buildNote);
    buildNote = '';
    const used = build.gear.length;
    const slots = CHASSIS[build.chassis].slots;
    /** Applies a change; refused builds explain why. */
    const apply = (next: Build) => {
      const withAddons: Build = { ...next, addons: next.gear.includes('eyes') ? addonsFor(game.level()) : [] };
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
    const bench = h(
      'div',
      { class: 'robot-bench-wrap' },
      benchEl({
        t,
        build,
        can: (kind, id) => game.can(kind, id),
        apply,
        selected: benchSel,
        select: (sel) => {
          benchSel = sel;
          onChange();
        },
        snap,
      }),
      noteCopy,
    );
    const parts = h(
      'div',
      { class: 'robot-build', 'data-testid': 'robot-build' },
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
    return { bench, parts };
  }

  /** The commands of the equipped parts, for a drawer. */
  function apiList(build: Build): HTMLElement {
    return h('dl', { class: 'robot-api', 'data-testid': 'robot-api' }, ...apiEntries(build).flatMap((e) => [h('dt', {}, h('code', {}, e.sig)), h('dd', {}, t(`robot.api.${e.id}` as MessageKey))]));
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
  interface Mount {
    arena: HTMLElement;
    controls: HTMLElement;
    more: HTMLElement;
    listing: HTMLElement;
  }
  interface QueueHooks {
    /** "Watch" in the summary: leave the drawer, show the fight. */
    watch(): void;
    /** The state of the queue changed (fights seen / all won). */
    progress(done: number, total: number, allWon: boolean): void;
  }
  function variationQueue(items: QueueItem[], build: Build, script: string, tooLong: Node | null, mount: Mount, hooks: QueueHooks): { bar: HTMLElement; panel: HTMLElement; dispose: () => void } {
    const outcomes = evaluateQueue(items, build, script);
    const done = new Set<number>();
    let current = 0;
    let auto = true;
    let oldOpen = false;
    let viewer: Viewer | undefined;
    let autoTimer: ReturnType<typeof setTimeout> | undefined;
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
      progress.title = progress.textContent ?? '';
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
      hooks.progress(done.size, items.length, outcomes.every((o) => o.won));
    }

    function showSummary() {
      picker.open = false;
      const won = outcomes.filter((o) => o.won).length;
      const row = (o: (typeof outcomes)[number], i: number) =>
        h(
          'li',
          { class: o.won ? 'won' : 'lost', 'data-testid': `robot-vq-row-${o.item.key}` },
          h('strong', {}, `${o.won ? '✓' : '✗'} ${o.item.regression ? `${t('robot.vq.old')}: ` : ''}${o.item.enemy.title[lang]} · ${t('robot.layout', { n: o.item.n })}`),
          h('span', { class: 'robot-note' }, ` ${t('robot.vq.ticks', { n: o.ticks })}`),
          o.reason ? h('span', { class: 'robot-vq-why' }, lossText(o.reason, o.item.enemy)) : null,
          h('button', { class: 'run-control', 'data-testid': `robot-vq-watch-${o.item.key}`, onclick: () => (load(i, false), hooks.watch()) }, t('robot.vq.watch')),
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
      mount.arena.replaceChildren(viewer.el);
      mount.controls.replaceChildren(viewer.controls);
      mount.more.replaceChildren(viewer.more);
      mount.listing.replaceChildren(viewer.listing);
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
    }

    const bar = h('div', { class: 'robot-queue', 'data-testid': 'robot-queue' }, h('div', { class: 'robot-vq-head' }, progress, stateTag), h('div', { class: 'robot-vq-bar' }, skipBtn, nextBtn), reasonBox);
    const picker = h('details', { class: 'robot-fold', open: true, 'data-testid': 'robot-vq-picker' }, h('summary', {}, t('work.pick')), chips, h('div', { class: 'robot-actions' }, allBtn, h('label', { class: 'robot-option' }, autoBox, t('robot.vq.auto'))));
    const panel = h('div', { class: 'robot-queue-panel', 'data-testid': 'robot-queue-panel' }, summary, picker);
    load(0, false);
    return { bar, panel, dispose: () => (cancelAuto(), viewer?.dispose()) };
  }

  // ---------------------------------------------------------------- a battle step

  function outcomeFor(run: RunReport, report: EnemyReport, enemyStep: Step): { text: string; ok: boolean; extra: Node[]; rule?: Node } {
    const enemy = enemyStep.enemy!;
    const n = report.fights.length;
    const lost = report.fights.filter((f) => !f.won).length;
    const extra: Node[] = [];
    if (run.won) {
      extra.push(h('p', { 'data-testid': 'robot-stars', class: 'rb-stars' }, `${'★'.repeat(run.stars)}${'☆'.repeat(3 - run.stars)} ${t('robot.stars', { n: run.stars })}`));
      return { text: t(run.firstWin ? 'robot.outcome.firstWin' : 'robot.outcome.win', { n }), ok: true, extra, rule: h('p', { class: 'robot-note' }, t('robot.stars.rule', { par: enemy.par })) };
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
    const work = createWork(t, stepHeader(step, opts.back));
    const Z = work.zones;
    let ran = false;
    let lost = false;
    let area: HTMLTextAreaElement;
    const btn = (label: string, id: string, onclick: () => void = () => {}, cls = 'run-control') => h('button', { class: cls, 'data-testid': id, onclick }, label);
    const goCode = () => (work.show('code', true), area.focus());

    // ---- Task: the enemy, the catch, hints and the concept cards
    const hintBox = h('div', { class: 'robot-hints', 'data-testid': 'robot-hints' });
    const hintText = (n: number): Node =>
      n === 1 ? h('p', {}, t('robot.hint.1', { text: enemy.catchLine[lang] })) : n === 2 ? h('p', {}, t('robot.hint.2', { text: enemy.idea[lang] })) : h('div', {}, h('p', {}, t('robot.hint.3')), h('pre', {}, h('code', {}, enemy.skeleton)));
    const hintBtn = btn(t('robot.hint'), 'robot-hint', () => askHint());
    function renderHints() {
      const shown = hintCount();
      hintBox.replaceChildren(...Array.from({ length: shown }, (_, i) => hintText(i + 1)));
      hintBtn.textContent = shown > 0 ? t('work.hint.count', { n: shown }) : t('robot.hint');
    }
    function askHint() {
      if (opts.training) localHint = Math.min(3, localHint + 1);
      else if (game.hint(step.id) < 3) game.nextHint(step.id);
      renderHints();
      work.show('task', true);
    }
    const cardList = opts.training ? [] : cardsOfChapter(step.chapter);
    const cardsBtn = btn('', 'robot-cards-open');
    const cardsLabel = () => {
      const unseen = cardList.filter((c) => !game.cardSeen(c.id)).length;
      cardsBtn.replaceChildren(t('work.cards'), unseen > 0 ? h('span', { class: 'rb-badge' }, t('work.cards.new')) : '');
    };
    Z.task.body.append(
      h('div', { class: 'robot-card robot-catch' }, h('div', { class: 'robot-foes', 'data-testid': 'robot-foes' }, ...enemy.enemies.map((def) => iconEl(specOf(enemyBuild(def)), 56, { enemy: true, label: () => t('robot.enemy') }))), h('div', {}, h('h3', {}, t('robot.catch')), h('p', { 'data-testid': 'robot-catch' }, enemy.catchLine[lang]))),
      hintBox,
    );
    if (cardList.length > 0) {
      Z.task.tools.append(cardsBtn);
      const cardsDrawer = work.drawer('task', t('work.cards'), cardsBtn);
      cardsLabel();
      cardsDrawer.set(cardsBlock(step.chapter, cardsLabel)!);
    }
    Z.task.actions.append(hintBtn, btn(t('work.toCode'), 'robot-to-code', goCode, 'robot-run rb-only-tabs'));

    // ---- Robot: the picture with tappable sockets, and the full parts list in a drawer
    const partsBtn = btn(t('work.parts'), 'robot-build-open');
    Z.robot.tools.append(partsBtn);
    const partsDrawer = work.drawer('robot', t('robot.build'), partsBtn);
    const apiBtn = btn(t('work.commands'), 'robot-api-open');
    const historyBtn = btn(t('work.versions'), 'robot-history-open');
    const apiDrawer = work.drawer('code', t('robot.api'), apiBtn);
    const historyDrawer = work.drawer('code', t('robot.history'), historyBtn);
    function drawRobot() {
      const focused = (document.activeElement as HTMLElement | null)?.dataset?.testid;
      const { bench, parts } = buildPanel(() => (work.phase('build'), drawRobot()));
      Z.robot.body.replaceChildren(bench);
      partsDrawer.set(parts);
      apiDrawer.set(apiList(game.build()));
      if (focused) root.querySelector<HTMLElement>(`[data-testid="${focused}"]`)?.focus({ preventScroll: true });
    }
    drawRobot();
    Z.robot.actions.append(btn(t('work.toCode'), 'robot-to-code-2', goCode, 'robot-run rb-only-tabs'));

    // ---- Code: the editor (or the line-by-line listing during a fight), commands and versions
    const errorHolder = h('div', { class: 'robot-error-holder' });
    const listingHolder = h('div', { class: 'robot-listing-holder', hidden: true });
    area = editor(game.script(), (text) => (game.setScript(text), ran && lost && work.phase('improve')));
    area.addEventListener('focus', () => work.phase(ran && lost ? 'improve' : 'code'));
    Z.code.body.append(errorHolder, area, listingHolder);
    Z.code.tools.append(apiBtn, historyBtn);
    const viewBtn = btn(t('work.edit'), 'robot-view-toggle', () => showEditor(listingHolder.hidden === false), 'run-control');
    viewBtn.hidden = true;
    function showEditor(edit: boolean) {
      area.hidden = !edit;
      listingHolder.hidden = edit;
      viewBtn.textContent = t(edit ? 'work.follow' : 'work.edit');
      if (edit) area.focus();
    }
    Z.code.actions.append(btn(t('robot.run'), 'robot-run', () => (game.setScript(area.value), fight()), 'robot-run'), viewBtn, btn(t('robot.hint'), 'robot-hint-code', askHint));

    // ---- Fight: result, queue bar, arena; controls at the bottom; details in drawers
    const result = h('div', { class: 'robot-result', 'data-testid': 'robot-result' }, h('p', { 'data-testid': 'robot-outcome', 'aria-live': 'polite' }, t('robot.outcome.idle')));
    const queueHolder = h('div', { class: 'robot-queue-holder' });
    const arenaHolder = h('div', { class: 'robot-viewer' });
    const controlsHolder = h('div', { class: 'robot-controls-holder' });
    const moreHolder = h('div');
    const listingMount = h('div');
    listingHolder.append(listingMount);
    Z.fight.body.append(result, queueHolder, arenaHolder);
    const firstRun = btn(t('robot.run'), 'robot-run-fight', () => (game.setScript(area.value), fight()), 'robot-run');
    controlsHolder.append(firstRun);
    Z.fight.actions.append(controlsHolder);
    const fightsBtn = btn('', 'robot-vq-open');
    const moreBtn = btn(t('work.more'), 'robot-more-open');
    fightsBtn.hidden = moreBtn.hidden = true;
    Z.fight.tools.append(fightsBtn, moreBtn);
    const fightsDrawer = work.drawer('fight', t('work.fights.title'), fightsBtn);
    const moreDrawer = work.drawer('fight', t('work.more.title'), moreBtn);
    moreDrawer.set(moreHolder);

    function renderHistory() {
      const history = game.history();
      historyDrawer.set(
        history.length === 0
          ? h('p', { 'data-testid': 'robot-history' }, t('robot.history.empty'))
          : h(
              'ol',
              { 'data-testid': 'robot-history' },
              ...history.map((entry, i) =>
                h(
                  'li',
                  {},
                  h('span', {}, `${titleOf(game.step(entry.step)!)} · ${t(`robot.history.${entry.result}` as MessageKey)} · ${entry.script.split('\n').filter((l) => l.trim()).length}`),
                  h('button', { class: 'run-control', 'data-testid': `robot-restore-${i}`, onclick: () => (game.restore(i), (area.value = game.script()), renderHistory(), historyDrawer.close(), showEditor(true)) }, t('robot.history.restore')),
                ),
              ).reverse(),
            ),
      );
    }

    function fight() {
      const run = opts.run();
      if (!run) return;
      renderHistory();
      errorHolder.replaceChildren();
      if (run.error) {
        errorHolder.replaceChildren(errorBox(run.error));
        work.show('code');
        showEditor(true);
        return;
      }
      const report = run.report!;
      const { text, ok, extra, rule } = outcomeFor(run, report, step);
      stop();
      ran = true;
      lost = !ok;
      moreDrawer.close();
      fightsDrawer.close();
      const queue = variationQueue(
        game.variationQueue(step),
        game.build(),
        game.script(),
        report.tooLong ? h('p', { class: 'robot-loss' }, t('robot.outcome.tooLong', { lines: report.lines, max: enemy.needs?.maxLines ?? 0 })) : null,
        { arena: arenaHolder, controls: controlsHolder, more: moreHolder, listing: listingMount },
        {
          watch: () => (fightsDrawer.close(), work.show('fight', true)),
          progress: (done, total, allWon) => (fightsBtn.textContent = `${done >= total ? (allWon ? '✓ ' : '✗ ') : ''}${t('work.fights', { n: total })}`),
        },
      );
      cleanup = queue.dispose;
      const regression = enemy.regression === false ? null : h('p', { class: 'robot-note' }, run.broken.length === 0 && run.won ? t('robot.regression.ok') : '');
      const next = run.won ? opts.next() : undefined;
      result.replaceChildren(
        ...[
          h('p', { class: ok ? 'robot-win' : 'robot-loss', 'data-testid': 'robot-outcome', 'data-state': ok ? 'won' : 'lost', 'aria-live': 'polite' }, text),
          ...extra,
          next ? btn(next.label, 'robot-next', next.go, 'robot-next') : btn(t('work.improve'), 'robot-improve', () => (work.show('code', true), showEditor(true)), 'robot-next'),
        ].filter((n): n is HTMLElement => n !== null),
      );
      queueHolder.replaceChildren(queue.bar);
      fightsDrawer.set(...[rule ?? null, regression, queue.panel].filter((n): n is HTMLElement => n !== null));
      fightsBtn.hidden = moreBtn.hidden = false;
      viewBtn.hidden = false;
      showEditor(false);
      work.phase('fight');
      work.show('fight', true);
    }

    work.onZone((z) => {
      if (z === 'robot') work.phase('build');
      else if (z === 'code') work.phase(ran && lost ? 'improve' : 'code');
      else if (z === 'fight') work.phase('fight');
    });
    work.phase('build');
    showWork(work.el);
    work.show(game.progress().solved.includes(step.id) ? 'code' : 'task');
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

  /** A challenge fills the viewport like the work screen: content scrolls, the check button and the way back stay at the bottom. */
  function challengeShell(step: Step, content: (Node | null)[], check: HTMLElement, out: HTMLElement) {
    const back = h('button', { class: 'run-control', 'data-testid': 'robot-to-map', onclick: showMap }, t('robot.toMap'));
    const body = h('div', { class: 'rb-zone-body' }, ...content, out);
    const actions = h('div', { class: 'rb-zone-actions' }, check, back);
    check.addEventListener('click', () => setTimeout(() => out.scrollIntoView?.({ block: 'nearest' }), 0));
    showWork(h('div', { class: 'rb-work rb-chal', 'data-testid': 'robot-challenge' }, h('div', { class: 'rb-top' }, stepHeader(step)), h('section', { class: 'rb-zone rb-single' }, body, actions)));
  }

  /** The commands of the build, folded away. */
  const apiFold = (build: Build) => h('details', { class: 'robot-api-fold' }, h('summary', {}, t('robot.api')), apiList(build));

  function showChallenge(step: Step) {
    const c: Challenge = step.challenge!;
    const out = h('div', { 'data-testid': 'robot-result' });
    const prompt = h('p', { class: 'robot-card', 'data-testid': 'robot-prompt' }, c.prompt[lang]);
    const checkBtn = (label: string, onclick: () => void) => h('button', { class: 'robot-run', 'data-testid': 'robot-check', onclick }, label);
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
        challengeShell(step, [prompt, list], checkBtn(t('robot.lineup.check'), () => out.replaceChildren(feedback(checkLineUp(c, order), step))), out);
        break;
      }
      case 'predict': {
        const input = h('input', { type: 'text', class: 'robot-answer', 'aria-label': t('robot.predict.answer'), autocomplete: 'off', 'data-testid': 'robot-answer' }) as HTMLInputElement;
        let misses = 0;
        challengeShell(
          step,
          [prompt, h('h3', {}, t('robot.predict.script')), h('pre', { class: 'robot-listing-static' }, h('code', {}, c.script)), input],
          checkBtn(t('robot.lineup.check'), () => {
            const ok = checkPredict(c, input.value);
            misses += ok ? 0 : 1;
            out.replaceChildren(feedback(ok, step), ...(misses >= 2 ? [h('p', { 'data-testid': 'robot-was' }, t('robot.predict.was', { answer: predictAnswer(c) }))] : []));
          }),
          out,
        );
        break;
      }
      case 'glitch': {
        const bugged = injectGlitch(c, game.script());
        const area = editor(bugged, () => {}, 'robot-glitch-code');
        challengeShell(step, [prompt, h('p', { class: 'robot-note' }, t('robot.glitch.note')), area], checkBtn(t('robot.glitch.fix'), () => out.replaceChildren(...glitchResult(c, area.value, step))), out);
        break;
      }
      case 'workshop': {
        const area = editor(c.skeleton, () => {}, 'robot-workshop-code');
        challengeShell(
          step,
          [prompt, h('p', { class: 'robot-note' }, t('robot.workshop.note')), apiFold({ ...START_BUILD }), area],
          checkBtn(t('robot.workshop.run'), () => {
            const r = checkWorkshop(c, area.value);
            out.replaceChildren(r.error ? h('p', { class: 'robot-loss', role: 'alert' }, r.error) : feedback(r.ok, step), workshopPicture(c.target, t('robot.workshop.target')), workshopPicture(r.trail, t('robot.workshop.yours')));
          }),
          out,
        );
        break;
      }
      case 'constraint': {
        const area = editor(game.script(), (text) => game.setScript(text), 'robot-constraint-code');
        challengeShell(
          step,
          [prompt, h('p', { class: 'robot-note' }, [c.maxLines !== undefined ? t('robot.constraint.rule', { n: c.maxLines }) : '', c.rule ? c.rule[lang] : ''].filter(Boolean).join(' ')), apiFold(game.build()), area],
          checkBtn(t('robot.lineup.check'), () => out.replaceChildren(...constraintResult(c, area.value, step))),
          out,
        );
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

