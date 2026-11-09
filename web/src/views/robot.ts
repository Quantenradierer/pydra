import type { App, Screen } from '../app.ts';
import { h, svg } from '../dom.ts';
import { BACK } from '../icons.ts';
import type { MessageKey } from '../i18n.ts';
import { apiEntries } from '../robot/api.ts';
import { START_BUILD, INTRODUCED_IN, CHASSIS, addonsFor, type Build, type GearId } from '../robot/build.ts';
import { checkGlitch, injectGlitch } from '../robot/challenges.ts';
import type { Challenge } from '../robot/content/challenges.ts';
import type { EnemyData } from '../robot/content/types.ts';
import type { EnemyReport, FightReport } from '../robot/fight.ts';
import { evaluateQueue, playItem, type LossReason, type QueueItem } from '../robot/variations.ts';
import { createViewer, type Speed, type Viewer } from './robot-viewer.ts';
import { friendlyError } from '../robot/friendly.ts';
import { type RunReport, type Step } from '../robot/game.ts';
import { precheck as precheckFn, type BattleResult } from '../robot/battle.ts';
import type { RbError } from '../robot/py/errors.ts';
import { createEditor, type Editor } from './robot-editor.ts';
import { subpageHeader } from './header.ts';
import { benchEl } from './robot-bench.ts';
import { createSheet } from './robot-sheet.ts';
import { levelStrip } from './level-strip.ts';
import { iconEl, partIconSpec, chassisIconSpec, specOf } from '../robot/art/compose.ts';
import { enemyBuild } from '../robot/battle.ts';

const GEAR_ORDER: GearId[] = ['blaster', 'cannon', 'eyes', 'hammer', 'shield', 'gps', 'plates'];

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
    window.scrollTo(0, 0);
  }

  /** The task page: on a desktop it fills the viewport in two columns; on a phone it is one column. */
  function showWork(el: HTMLElement) {
    stop();
    root.classList.add('robot-workmode');
    root.replaceChildren(el);
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- the map of tasks

  function showMap() {
    const p = game.progress();
    const chapters = [...new Set(game.steps.map((s) => s.chapter))];
    const upNext = game.steps.find((st) => game.unlocked(st.id) && !p.solved.includes(st.id) && (st.kind === 'battle' || st.challenge));
    /** One round pill per task (1..N of its chapter), like the level pills of every game; the name is its label. */
    const pill = (s: Step, i: number) => {
      const solved = p.solved.includes(s.id);
      const open = game.unlocked(s.id);
      const stars = p.stars[s.id] ?? 0;
      const state = solved ? t('robot.step.solved') : open ? '' : t('robot.step.locked');
      const label = [titleOf(s), s.enemy?.regression === false ? t('robot.side') : '', state, stars > 0 ? t('robot.step.stars', { n: stars }) : ''].filter(Boolean).join(', ');
      return h(
        'button',
        {
          class: `level-dot${solved ? ' solved' : ''}${s.kind === 'battle' && s.enemy?.regression !== false ? '' : ' side'}${s.id === upNext?.id ? ' next' : ''}`,
          'aria-label': `${i + 1}: ${label}`,
          title: label,
          'data-testid': `robot-step-${s.id}`,
          disabled: !open,
          onclick: () => {
            game.open(s.id);
            showStep(s.id);
          },
        },
        String(i + 1),
      );
    };
    /** The tasks of a chapter; a chapter in progress is open, finished and locked ones fold away. */
    const sections = chapters.map((chapter) => {
      const list = game.steps.filter((s) => s.chapter === chapter);
      const done = list.filter((s) => p.solved.includes(s.id)).length;
      const anyOpen = list.some((s) => game.unlocked(s.id));
      // Only the main path keeps a chapter open; side missions wait inside the folded chapter.
      const inProgress = list.some((s) => s.kind === 'battle' && s.enemy?.regression !== false && game.unlocked(s.id) && !p.solved.includes(s.id));
      return h(
        'details',
        { class: `robot-chapter${done === list.length ? ' complete' : ''}${anyOpen ? '' : ' locked'}`, open: inProgress, 'data-testid': `robot-chapter-${chapter}` },
        h('summary', {}, h('h2', { class: 'robot-chapter-name' }, t(`robot.chapter.${chapter}` as MessageKey)), h('span', { class: 'robot-chapter-count' }, anyOpen ? t('robot.chapter.count', { done, n: list.length }) : t('robot.step.locked'))),
        h('div', { class: 'level-strip robot-pills' }, ...list.map(pill)),
      );
    });
    const resume = upNext
      ? h('button', { class: 'primary robot-continue', 'data-testid': 'robot-continue', onclick: () => (game.open(upNext.id), showStep(upNext.id)) }, h('small', {}, t(p.solved.length === 0 ? 'robot.start' : 'robot.continue')), h('span', {}, titleOf(upNext)))
      : null;
    show(
      subpageHeader(app, t('lesson.robot.title')),
      h('div', { class: 'robot-map', 'data-testid': 'robot-map' }, resume, p.solved.includes('final-exam') ? h('p', { class: 'robot-win', 'data-testid': 'robot-certificate' }, `🎓 ${t('robot.certificate')}`) : null, game.canTrain() ? h('button', { class: 'run-control', 'data-testid': 'robot-training', onclick: showTraining }, t('robot.training')) : null, ...sections),
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
      const withAddons: Build = { ...next, addons: addonsFor(next.gear) };
      snapIds = [...withAddons.gear.filter((g) => !build.gear.includes(g)), ...(withAddons.locomotion !== build.locomotion ? [withAddons.locomotion] : []), ...(withAddons.blasterMark === 2 && build.blasterMark !== 2 ? ['blaster'] : [])];
      buildNote = game.setBuild(withAddons) ? '' : t('robot.build.full');
      onChange();
    };
    const isNew = (chapter: number) => chapter > 0 && chapter === Math.min(game.level(), 4);
    const newTag = (chapter: number) => (isNew(chapter) ? h('span', { class: 'robot-tag', 'data-testid': 'robot-new' }, t('robot.new')) : null);
    const radio = (name: string, value: string, label: string, checked: boolean, ok: boolean, intro: number, change: () => void) =>
      h(
        'label',
        { class: `robot-option${ok ? '' : ' locked'}` },
        h('input', { type: 'radio', name, value, checked, disabled: !ok, 'data-testid': `robot-${name}-${value}`, onchange: change }),
        iconEl(name === 'chassis' ? chassisIconSpec(value) : partIconSpec(value), 40),
        label,
        newTag(intro),
      );
    const snap = snapIds;
    snapIds = [];
    const bench = h(
      'div',
      { class: 'robot-bench-wrap' },
      benchEl({
        t,
        build,
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
      h('fieldset', {}, h('legend', {}, t('robot.build.chassis')), ...(['light', 'medium'] as const).map((c) => radio('chassis', c, t(`robot.chassis.${c}`), build.chassis === c, build.gear.length <= CHASSIS[c].slots, INTRODUCED_IN.chassis[c], () => apply({ ...build, chassis: c })))),
      h('fieldset', {}, h('legend', {}, t('robot.build.locomotion')), ...(['wheels', 'legs', 'treads'] as const).map((l) => radio('locomotion', l, t(`robot.loco.${l}`), build.locomotion === l, true, INTRODUCED_IN.locomotion[l], () => apply({ ...build, locomotion: l })))),
      h(
        'fieldset',
        {},
        h('legend', {}, t('robot.build.gear', { used, n: slots })),
        ...GEAR_ORDER.map((g) => {
          const on = build.gear.includes(g);
          return h(
            'label',
            { class: 'robot-option' },
            h('input', { type: 'checkbox', checked: on, 'data-testid': `robot-gear-${g}`, onchange: (e: Event) => apply({ ...build, gear: (e.target as HTMLInputElement).checked ? [...build.gear, g] : build.gear.filter((x) => x !== g) }) }),
            iconEl(partIconSpec(g), 40),
            t(`robot.gear.${g}`),
            newTag(INTRODUCED_IN.gear[g]),
          );
        }),
        build.gear.includes('blaster')
          ? h('label', { class: 'robot-option' }, h('input', { type: 'checkbox', checked: build.blasterMark === 2, onchange: (e: Event) => apply({ ...build, blasterMark: (e.target as HTMLInputElement).checked ? 2 : 1 }) }), t('robot.mk2'), newTag(INTRODUCED_IN.blasterMark2))
          : null,
      ),
      build.addons.length > 0 ? h('p', { class: 'robot-addons' }, `${t('robot.build.addons')}: ${build.addons.map((a) => t(`robot.addon.${a}` as MessageKey)).join(', ')}`) : null,
      note,
    );
    return { bench, parts };
  }

  // ---------------------------------------------------------------- the editor

  function editor(initial: string, build: () => Build, onInput: (text: string) => void, testId = 'robot-code'): Editor {
    return createEditor(t as (key: MessageKey) => string, initial, build, onInput, testId, () => apiEntries(build()).map((e) => ({ sig: e.sig, desc: t(`robot.api.${e.id}` as MessageKey) })));
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
   * earlier enemies of the chapter. Each plays in the line-by-line viewer. `chips` are the fight pills under the
   * controls (one per fight, ticked when seen); `panel` (summary, next/skip, auto-play) lives in the Mehr sheet.
   */
  interface Mount {
    arena: HTMLElement;
    explain: HTMLElement;
    controls: HTMLElement;
    more: HTMLElement;
    listing: HTMLElement;
  }
  interface QueueHooks {
    /** "Watch" in the summary: leave the sheet, show the fight. */
    watch(): void;
  }
  function variationQueue(items: QueueItem[], build: Build, script: string, tooLong: Node | null, mount: Mount, hooks: QueueHooks): { status: HTMLElement; chips: HTMLElement; panel: HTMLElement; dispose: () => void } {
    const outcomes = evaluateQueue(items, build, script);
    const done = new Set<number>();
    let current = 0;
    let auto = true;
    let viewer: Viewer | undefined;
    let autoTimer: ReturnType<typeof setTimeout> | undefined;
    const progress = h('span', { class: 'robot-vq-progress', 'data-testid': 'robot-vq-progress' });
    const stateTag = h('span', { class: 'robot-vq-state', 'data-testid': 'robot-vq-state' });
    const reasonBox = h('p', { class: 'robot-note', 'data-testid': 'robot-vq-reason' });
    const status = h('div', { class: 'robot-queue', 'data-testid': 'robot-queue' }, h('div', { class: 'robot-vq-head' }, progress, stateTag), reasonBox);
    const chips = h('div', { class: 'robot-layouts', role: 'group', 'aria-label': t('work.fights'), 'data-testid': 'robot-vq-chips' });
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
      progress.textContent = t('robot.vq.short', { k: current + 1, n: items.length });
      progress.title = t(item.regression ? 'robot.vq.progress.old' : 'robot.vq.progress', { k: current + 1, n: items.length, title: item.enemy.title[lang], v: item.n, m: item.of });
      const state = finished ? (out.won ? 'won' : 'lost') : 'running';
      stateTag.textContent = t(`robot.vq.state.${state}` as MessageKey);
      stateTag.dataset.state = state;
      reasonBox.textContent = finished && out.reason ? lossText(out.reason, item.enemy) : '';
      reasonBox.hidden = reasonBox.textContent === '';
      chips.replaceChildren(
        ...items.map((it, i) => {
          const o = outcomes[i]!;
          const seen = done.has(i);
          const state = seen ? (o.won ? 'won' : 'lost') : 'pending';
          return h(
            'button',
            {
              class: `level-dot layout${seen ? (o.won ? ' won' : ' lost') : ''}${it.regression ? ' old' : ''}`,
              'data-testid': it.regression ? `robot-vq-chip-${it.key}` : `robot-layout-${it.n}`,
              'aria-pressed': String(i === current),
              'aria-label': `${labelOf(it)}, ${t(`robot.vq.state.${state}` as MessageKey)}`,
              title: labelOf(it),
              onclick: () => load(i, false),
            },
            seen ? (o.won ? '✓' : '✗') : String(i + 1),
          );
        }),
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
          h('button', { class: 'run-control', 'data-testid': `robot-vq-watch-${o.item.key}`, onclick: () => (load(i, false), hooks.watch()) }, t('robot.vq.watch')),
        );
      const lostRows = outcomes.flatMap((o, i) => (o.won ? [] : [row(o, i)]));
      const wonRows = outcomes.flatMap((o, i) => (o.won ? [row(o, i)] : []));
      summary.replaceChildren(
        h('h4', {}, t('robot.vq.summary', { won, n: items.length })),
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
      mount.explain.replaceChildren(viewer.explain);
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

    const panel = h('div', { class: 'robot-queue-panel', 'data-testid': 'robot-queue-panel' }, summary, h('div', { class: 'robot-actions' }, skipBtn, nextBtn, allBtn, h('label', { class: 'robot-option' }, autoBox, t('robot.vq.auto'))));
    load(0, false);
    return { status, chips, panel, dispose: () => (cancelAuto(), viewer?.dispose()) };
  }

  // ---------------------------------------------------------------- a battle step

  function outcomeFor(run: RunReport, report: EnemyReport, enemyStep: Step): { text: string; ok: boolean; extra: Node[]; rule?: Node } {
    const enemy = enemyStep.enemy!;
    const n = report.fights.length;
    const lost = report.fights.filter((f) => !f.won).length;
    const extra: Node[] = [];
    if (run.won) {
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
    /** Training fights are not stored. */
    training?: boolean;
  }

  /**
   * One task = one page, like every other game: header with the level pills, the task sentence with the pictures, the arena
   * (a preview before the first fight), the four run controls, the script editor and ONE primary button:
   * "Kampf starten", then "Weiter" after a win or "Skript verbessern" after a loss. No zones, steps or tabs.
   */
  function showBattle(step: Step, opts: BattleOpts = taskOpts(step)) {
    const enemy = step.enemy!;
    /** idle: the script can be run; won / lost: a fight was played and its result shows. */
    let state: 'idle' | 'won' | 'lost' = 'idle';
    let nextAction: { label: string; go: () => void } | undefined;
    let ed: Editor | undefined;
    let area: HTMLTextAreaElement;
    const btn = (label: string, id: string, onclick: () => void = () => {}, cls = 'run-control') => h('button', { type: 'button', class: cls, 'data-testid': id, onclick }, label);
    const sheetClose = t('work.close');

    // ---- the task: the pictures, the title and the sentence, "Teile" for the build
    const partsSheet = createSheet(t('robot.build'), sheetClose, 'robot-parts-sheet');
    const partsBtn = btn(t('work.parts'), 'robot-build-open', partsSheet.open);
    partsBtn.setAttribute('aria-haspopup', 'dialog');
    const youHolder = h('span', { class: 'rb-you' });
    const task = h(
      'section',
      { class: 'rb-task' },
      h(
        'div',
        { class: 'rb-pictures' },
        youHolder,
        h('span', { class: 'rb-vs', 'aria-hidden': 'true' }, '⚔'),
        h('div', { class: 'robot-foes', 'data-testid': 'robot-foes' }, ...enemy.enemies.map((def) => iconEl(specOf(enemyBuild(def)), 44, { enemy: true, label: () => t('robot.enemy') }))),
        partsBtn,
      ),
      h('p', { class: 'rb-task-text', 'data-testid': 'robot-catch' }, h('strong', {}, `${titleOf(step)}: `), enemy.catchLine[lang]),
    );

    function drawRobot() {
      const focused = (document.activeElement as HTMLElement | null)?.dataset?.testid;
      const { bench, parts } = buildPanel(drawRobot);
      partsSheet.body.replaceChildren(bench, parts);
      youHolder.replaceChildren(iconEl(specOf(game.build()), 44, { label: () => t('robot.you') }));
      ed?.refresh();
      if (state === 'idle') drawPreview();
      if (focused) root.querySelector<HTMLElement>(`[data-testid="${focused}"]`)?.focus({ preventScroll: true });
    }

    // ---- the arena, the run controls, the fight pills, the verdict
    const arenaHolder = h('div', { class: 'robot-viewer rb-arena' });
    const explainHolder = h('div', { class: 'rb-explain' });
    const controlsHolder = h('div', { class: 'rb-controls-holder' });
    const moreBtn = btn('⋯', 'robot-more-open', () => moreSheet.open());
    moreBtn.setAttribute('aria-label', t('work.more'));
    moreBtn.title = t('work.more');
    moreBtn.setAttribute('aria-haspopup', 'dialog');
    const controlRow = h('div', { class: 'rb-controlrow' }, controlsHolder, moreBtn);
    const statusHolder = h('div', { class: 'robot-queue-holder' });
    const chipsHolder = h('div', { class: 'rb-chips' });
    const result = h('div', { class: 'robot-result', 'data-testid': 'robot-result', hidden: true });
    const moreHolder = h('div');
    const listingMount = h('div');

    // ---- the "Mehr" sheet: the fights, speed and variables, the versions (only what exists)
    const moreSheet = createSheet(t('work.more'), sheetClose, 'robot-more-sheet');
    const fightsSection = h('section', { hidden: true, 'data-testid': 'robot-fights' }, h('h3', {}, t('work.fights')));
    const fightsHolder = h('div');
    fightsSection.append(fightsHolder);
    const speedSection = h('section', { hidden: true }, h('h3', {}, t('work.speed')), moreHolder);
    const historySection = h('section', { hidden: true, 'data-testid': 'robot-history-section' }, h('h3', {}, t('robot.history')));
    const historyHolder = h('div');
    historySection.append(historyHolder);
    moreSheet.body.append(fightsSection, speedSection, historySection);

    // ---- the script: the editor, or the listing with the running line while a fight is shown
    const errorHolder = h('div', { class: 'robot-error-holder' });
    const listingHolder = h('div', { class: 'robot-listing-holder', hidden: true, role: 'button', tabindex: 0, 'aria-label': t('work.edit'), title: t('work.edit'), 'data-testid': 'robot-view-toggle' });
    listingHolder.append(listingMount);
    listingHolder.addEventListener('click', () => showEditor(true));
    listingHolder.addEventListener('keydown', (e) => ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') && (e.preventDefault(), showEditor(true)));
    ed = editor(game.script(), () => game.build(), (text) => (game.setScript(text), toIdle()));
    area = ed.area;
    area.addEventListener('focus', toIdle);

    function showEditor(edit: boolean) {
      ed!.el.hidden = !edit;
      listingHolder.hidden = edit;
      if (edit) area.focus();
    }

    // ---- the one primary button
    const primary = h('button', { type: 'button', class: 'primary rb-primary' }) as HTMLButtonElement;
    function paintPrimary() {
      const label = state === 'idle' ? t('robot.run') : state === 'lost' ? t('work.improve') : (nextAction?.label ?? t('robot.toMap'));
      primary.textContent = label;
      primary.dataset.testid = state === 'idle' ? 'robot-run' : state === 'lost' ? 'robot-improve' : 'robot-next';
      primary.setAttribute('data-testid', primary.dataset.testid);
      primary.dataset.state = state;
    }
    primary.addEventListener('click', () => {
      if (state === 'idle') return (game.setScript(area.value), fight());
      if (state === 'lost') return showEditor(true);
      if (nextAction) nextAction.go();
      else opts.back();
    });
    /** Editing the script starts the next try: the primary is "Kampf starten" again. */
    function toIdle() {
      if (state === 'idle') return;
      state = 'idle';
      paintPrimary();
    }
    paintPrimary();

    /** The arena before the first fight: both robots on the field, the controls waiting. */
    function drawPreview() {
      try {
        const first = game.variationQueue(step)[0];
        if (!first) return;
        const viewer = createViewer(playItem(first, game.build(), '', true).battle, '', { t, speed, preview: true });
        arenaHolder.replaceChildren(viewer.el);
        explainHolder.replaceChildren();
        controlsHolder.replaceChildren(viewer.controls);
      } catch {
        // no preview: the fight shows the arena
      }
    }

    function renderHistory() {
      const history = game.history();
      historySection.hidden = history.length === 0;
      moreBtn.hidden = history.length === 0 && state === 'idle' && !ranOnce;
      historyHolder.replaceChildren(
        h(
          'ol',
          { 'data-testid': 'robot-history' },
          ...history
            .map((entry, i) =>
              h(
                'li',
                {},
                h('span', {}, `${titleOf(game.step(entry.step)!)} · ${t(`robot.history.${entry.result}` as MessageKey)} · ${entry.script.split('\n').filter((l) => l.trim()).length}`),
                h('button', { class: 'run-control', 'data-testid': `robot-restore-${i}`, onclick: () => (game.restore(i), ed!.set(game.script()), renderHistory(), moreSheet.close(), showEditor(true)) }, t('robot.history.restore')),
              ),
            )
            .reverse(),
        ),
      );
    }
    let ranOnce = false;

    function fight() {
      const run = opts.run();
      if (!run) return;
      errorHolder.replaceChildren();
      if (run.error) {
        renderHistory();
        errorHolder.replaceChildren(errorBox(run.error));
        showEditor(true);
        errorHolder.scrollIntoView({ block: 'nearest' });
        return;
      }
      const report = run.report!;
      const { text, ok, extra, rule } = outcomeFor(run, report, step);
      stop();
      ranOnce = true;
      moreSheet.close();
      const queue = variationQueue(
        game.variationQueue(step),
        game.build(),
        game.script(),
        report.tooLong ? h('p', { class: 'robot-loss' }, t('robot.outcome.tooLong', { lines: report.lines, max: enemy.needs?.maxLines ?? 0 })) : null,
        { arena: arenaHolder, explain: explainHolder, controls: controlsHolder, more: moreHolder, listing: listingMount },
        { watch: () => (moreSheet.close(), arenaHolder.scrollIntoView({ block: 'start' })) },
      );
      cleanup = queue.dispose;
      const regression = enemy.regression === false ? null : h('p', { class: 'robot-note' }, run.broken.length === 0 && run.won ? t('robot.regression.ok') : '');
      state = ok ? 'won' : 'lost';
      nextAction = ok ? opts.next() : undefined;
      result.hidden = false;
      result.replaceChildren(
        h('p', { class: `verdict ${ok ? 'correct' : 'wrong'}`, 'data-testid': 'robot-outcome', 'data-state': ok ? 'won' : 'lost', 'aria-live': 'polite' }, text, run.won ? h('span', { class: 'rb-stars', 'data-testid': 'robot-stars', title: t('robot.stars', { n: run.stars }) }, ` ${'★'.repeat(run.stars)}${'☆'.repeat(3 - run.stars)}`) : null),
        ...extra,
      );
      statusHolder.replaceChildren(queue.status);
      chipsHolder.replaceChildren(queue.chips);
      fightsHolder.replaceChildren(...[rule ?? null, regression, queue.panel].filter((n): n is HTMLElement => n !== null));
      fightsSection.hidden = speedSection.hidden = false;
      paintPrimary();
      renderHistory();
      showEditor(false);
      requestAnimationFrame(() => arenaHolder.scrollIntoView({ block: 'start' }));
    }

    const left = h('div', { class: 'rb-main' }, task, arenaHolder, controlRow, explainHolder, chipsHolder, statusHolder, result);
    const right = h('div', { class: 'rb-code' }, errorHolder, ed.el, listingHolder, primary);
    const page = h('div', { class: 'rb-page', 'data-testid': 'robot-work' }, left, right, partsSheet.dialog, moreSheet.dialog);
    drawRobot();
    showWork(h('div', { class: 'rb-work' }, stepBar(step, opts), page));
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
        h('button', { class: 'primary', 'data-testid': 'robot-train-daily', onclick: () => play(game.trainingStep('daily')) }, t(stats.dailyDone ? 'robot.training.dailyDone' : 'robot.training.daily')),
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

  /** The header of a task: back, the level pills of its chapter (like the other games), no title row. */
  function stepBar(step: Step, opts: BattleOpts): HTMLElement {
    const header = h(
      'header',
      { class: 'subpage-header' },
      h('button', { class: 'icon-button', 'aria-label': t('nav.back'), title: t('nav.back'), onclick: opts.back }, svg(BACK)),
      h('h1', { tabindex: -1, 'data-testid': 'robot-step-title' }, titleOf(step)),
    );
    if (opts.training) return h('div', { class: 'game-bar' }, header);
    const progress = game.progress();
    const chapter = game.steps.filter((s) => s.chapter === step.chapter);
    const strip = levelStrip(
      t,
      chapter.map((s) => ({
        solved: progress.solved.includes(s.id),
        open: game.unlocked(s.id),
        current: s.id === step.id,
        go: () => (game.open(s.id), showStep(s.id)),
      })),
    );
    return h('div', { class: 'game-bar' }, header, strip);
  }

  function showStep(id: string) {
    const step = game.step(id)!;
    game.open(id);
    const c = step.challenge;
    // A bug hunt starts from the player's own working script with the bug put in (unless they are already mid-fix).
    if (c?.kind === 'glitch' && !game.progress().solved.includes(id) && checkGlitch(c, game.script(), game.build())) game.setScript(injectGlitch(c, game.script()));
    showBattle(step);
    root.querySelector<HTMLElement>('[data-testid="robot-step-title"]')?.focus();
  }

  showMap();
  return { root, dispose: stop };
}

