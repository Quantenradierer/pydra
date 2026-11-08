import type { App, Screen } from '../app.ts';
import { h, svg } from '../dom.ts';
import { BACK } from '../icons.ts';
import type { MessageKey } from '../i18n.ts';
import { apiEntries } from '../robot/api.ts';
import { START_BUILD, UNLOCK_CHAPTER, CHASSIS, addonsFor, type Build, type GearId } from '../robot/build.ts';
import { checkConstraint, checkGlitch, checkLineUp, checkPredict, checkWorkshop, injectGlitch, predictAnswer, shuffledLines } from '../robot/challenges.ts';
import type { Challenge } from '../robot/content/challenges.ts';
import type { EnemyReport } from '../robot/fight.ts';
import { friendlyError } from '../robot/friendly.ts';
import type { RunReport, Step } from '../robot/game.ts';
import { describeFrame, drawFrame } from '../robot/replay.ts';
import { precheck as precheckFn, type BattleResult } from '../robot/battle.ts';
import type { RbError } from '../robot/py/errors.ts';
import { subpageHeader } from './header.ts';

const TICK_MS = 450;
const GEAR_ORDER: GearId[] = ['blaster', 'cannon', 'eyes', 'hammer', 'shield', 'gps'];

/** Robot Battler: a map of tasks, and for each task the build / code / battle / improve loop. */
export function robotScreen(app: App): Screen {
  const { t, lang } = app;
  const game = app.services.robot;
  const root = h('main', { class: 'screen game robot' });
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
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
    const sections = chapters.map((chapter) =>
      h(
        'section',
        { class: 'robot-chapter' },
        h('h2', {}, t(`robot.chapter.${chapter}` as MessageKey)),
        h(
          'ul',
          { class: 'robot-steps' },
          ...game.steps
            .filter((s) => s.chapter === chapter)
            .map((s) => {
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
                    class: `robot-step${solved ? ' solved' : ''}${s.kind === 'battle' ? '' : ' challenge'}`,
                    'data-testid': `robot-step-${s.id}`,
                    disabled: !open,
                    onclick: () => {
                      game.open(s.id);
                      showStep(s.id);
                    },
                  },
                  h('span', { class: 'robot-kind' }, t(`robot.kind.${s.kind}` as MessageKey)),
                  h('span', { class: 'robot-title' }, titleOf(s)),
                  s.enemy?.regression === false ? h('span', { class: 'robot-side' }, t('robot.side')) : null,
                  h('span', { class: 'robot-state' }, [state, stars > 0 ? '★'.repeat(stars) : ''].filter(Boolean).join(' ')),
                ),
              );
            }),
        ),
      ),
    );
    show(subpageHeader(app, t('lesson.robot.title')), h('div', { class: 'robot-map', 'data-testid': 'robot-map' }, ...sections));
  }

  // ---------------------------------------------------------------- build panel

  /** The panel closes when the screen redraws after a change; remember to open it again, with the last note. */
  let buildOpen = false;
  let buildNote = '';

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
      buildNote = game.setBuild(withAddons) ? '' : withAddons.gear.length > CHASSIS[withAddons.chassis].slots ? t('robot.build.full') : t('robot.build.locked');
      onChange();
    };
    const radio = (name: string, value: string, label: string, checked: boolean, ok: boolean, change: () => void) =>
      h(
        'label',
        { class: `robot-option${ok ? '' : ' locked'}` },
        h('input', { type: 'radio', name, value, checked, disabled: !ok, 'data-testid': `robot-${name}-${value}`, onchange: change }),
        label,
      );
    return h(
      'details',
      { class: 'robot-build', 'data-testid': 'robot-build', open: buildOpen },
      h('summary', {}, t('robot.build')),
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

  function apiPanel(build: Build): HTMLElement {
    return h(
      'section',
      { class: 'robot-api', 'data-testid': 'robot-api' },
      h('h3', {}, t('robot.api')),
      h('dl', {}, ...apiEntries(build).flatMap((e) => [h('dt', {}, h('code', {}, e.sig)), h('dd', {}, t(`robot.api.${e.id}` as MessageKey))])),
    );
  }

  // ---------------------------------------------------------------- the editor

  function editor(initial: string, onInput: (text: string) => void, testId = 'robot-code'): HTMLTextAreaElement {
    const area = h('textarea', { class: 'robot-code', rows: 10, spellcheck: false, autocapitalize: 'off', autocomplete: 'off', 'aria-label': t('robot.code'), 'data-testid': testId }) as HTMLTextAreaElement;
    area.value = initial;
    area.addEventListener('input', () => onInput(area.value));
    area.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || e.shiftKey) return;
      e.preventDefault();
      area.setRangeText('    ', area.selectionStart, area.selectionEnd, 'end');
      onInput(area.value);
    });
    return area;
  }

  // ---------------------------------------------------------------- the replay

  /** The viewer: canvas, controls, the script with the active line, sensors and the log of the tick. */
  function replay(battle: BattleResult, script: string, trail?: ReadonlySet<string>): HTMLElement {
    const lines = script.split('\n');
    const last = battle.frames.length - 1;
    let index = 0;
    const canvas = h('canvas', { class: 'robot-canvas', role: 'img', 'aria-label': t('robot.canvas'), 'data-testid': 'robot-canvas' }) as HTMLCanvasElement;
    const position = h('p', { class: 'run-position', 'data-testid': 'robot-position', 'aria-live': 'off' });
    const listing = h('ol', { class: 'robot-listing', 'data-testid': 'robot-listing' }, ...lines.map((l, i) => h('li', { 'data-line': String(i + 1) }, h('code', {}, l || ' '))));
    const sensors = h('ul', { class: 'robot-sensors', 'data-testid': 'robot-sensors' });
    const log = h('ul', { class: 'robot-log', 'data-testid': 'robot-log' });
    const slider = h('input', { type: 'range', min: 0, max: last, value: 0, 'aria-label': t('robot.replay'), 'data-testid': 'robot-slider' }) as HTMLInputElement;
    const playBtn = h('button', { class: 'run-control', 'data-testid': 'robot-play' }, t('robot.play'));

    function render() {
      const frame = battle.frames[index]!;
      drawFrame(canvas, battle, index, trail);
      position.textContent = t('robot.tick', { n: index, total: last });
      slider.value = String(index);
      const active = frame.lines.player;
      for (const li of listing.children) li.classList.toggle('active', active != null && li.getAttribute('data-line') === String(active));
      listing.dataset.active = active == null ? '' : String(active);
      sensors.replaceChildren(...(frame.sensors.player ?? []).map((s) => h('li', {}, h('code', {}, s))));
      log.replaceChildren(...describeFrame(frame, t).map((s) => h('li', {}, s)));
    }
    const go = (i: number) => {
      index = Math.max(0, Math.min(last, i));
      render();
    };
    const pause = () => {
      stop();
      playBtn.textContent = t('robot.play');
    };
    playBtn.addEventListener('click', () => {
      if (timer) return pause();
      if (index >= last) index = 0;
      playBtn.textContent = t('robot.pause');
      timer = setInterval(() => {
        if (index >= last) return pause();
        go(index + 1);
      }, TICK_MS);
    });
    slider.addEventListener('input', () => {
      pause();
      go(Number(slider.value));
    });
    const btn = (label: MessageKey, id: string, fn: () => void) => h('button', { class: 'run-control', 'data-testid': id, onclick: () => (pause(), fn()) }, t(label));
    render();
    return h(
      'section',
      { class: 'robot-replay', 'aria-label': t('robot.replay') },
      h('div', { class: 'robot-stage' }, canvas, h('div', { class: 'robot-side-panel' }, h('h3', {}, t('robot.code')), listing)),
      h('div', { class: 'run-controls' }, btn('robot.restart', 'robot-restart', () => go(0)), btn('robot.back', 'robot-back', () => go(index - 1)), playBtn, btn('robot.forward', 'robot-forward', () => go(index + 1)), btn('robot.end', 'robot-end', () => go(last))),
      slider,
      position,
      h('div', { class: 'robot-cols' }, h('div', {}, h('h3', {}, t('robot.sensors')), sensors), h('div', {}, h('h3', {}, t('robot.log')), log)),
    );
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
    if (failed.unmet === 'say') return { text: t('robot.outcome.say'), ok: false, extra };
    if (failed.unmet === 'sayPrefix') return { text: t('robot.outcome.sayPrefix', { text: enemy.needs?.sayPrefix ?? '' }), ok: false, extra };
    if (failed.unmet === 'damage') return { text: t('robot.outcome.damage', { max: enemy.needs?.maxDamage ?? 0 }), ok: false, extra };
    if (failed.unmet === 'waste') return { text: t('robot.outcome.waste'), ok: false, extra };
    if (failed.unmet === 'uses') return { text: t('robot.outcome.uses', { words: (enemy.needs?.uses ?? []).map((w) => `"${w}"`).join(', ') }), ok: false, extra };
    if (failed.unmet === 'without') return { text: t('robot.outcome.without', { words: (enemy.needs?.without ?? []).map((w) => `"${w}"`).join(', ') }), ok: false, extra };
    if (failed.unmet === 'repeat') return { text: t('robot.outcome.repeat'), ok: false, extra };
    if (failed.unmet === 'sayOnce') return { text: t('robot.outcome.sayOnce', { text: enemy.needs?.sayOnce ?? '' }), ok: false, extra };
    if (b.error) {
      extra.push(rawError(b.error));
      return { text: t('robot.outcome.stop', { line: b.error.line, message: errorText(b.error) }), ok: false, extra };
    }
    if (b.budgetLine !== undefined) return { text: t('robot.outcome.budget', { line: b.budgetLine, message: t('robot.err.loop-budget') }), ok: false, extra };
    return { text: t('robot.outcome.lost', { lost, n }), ok: false, extra };
  }

  function showBattle(step: Step) {
    const enemy = step.enemy!;
    const result = h('div', { class: 'robot-result', 'data-testid': 'robot-result' }, h('p', { 'data-testid': 'robot-outcome', 'aria-live': 'polite' }, t('robot.outcome.idle')));
    const hintBox = h('div', { class: 'robot-hints', 'data-testid': 'robot-hints' });
    const historyBox = h('details', { class: 'robot-history', 'data-testid': 'robot-history' });
    let area: HTMLTextAreaElement;

    const hintText = (n: number): Node =>
      n === 1 ? h('p', {}, t('robot.hint.1', { text: enemy.twist[lang] })) : n === 2 ? h('p', {}, t('robot.hint.2', { text: enemy.idea[lang] })) : h('div', {}, h('p', {}, t('robot.hint.3')), h('pre', {}, h('code', {}, enemy.skeleton)));
    function renderHints() {
      const shown = game.hint(step.id);
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
      const run = game.run(step.id);
      if (!run) return;
      renderHistory();
      if (run.error) {
        result.replaceChildren(errorBox(run.error));
        return;
      }
      const report = run.report!;
      const { text, ok, extra } = outcomeFor(run, report, step);
      const failedFirst = Math.max(0, report.fights.findIndex((f) => !f.won));
      const viewer = h('div', { class: 'robot-viewer' });
      const script = game.script();
      function pick(i: number) {
        viewer.replaceChildren(replay(report.fights[i]!.battle, script));
        for (const [j, b] of tabs.entries()) b.setAttribute('aria-pressed', String(i === j));
      }
      const tabs = report.fights.map((f, i) =>
        h('button', { class: `run-control layout${f.won ? ' won' : ' lost'}`, 'data-testid': `robot-layout-${i + 1}`, 'aria-pressed': 'false', 'aria-label': t(f.won ? 'robot.layout.won' : 'robot.layout.lost', { n: i + 1 }), onclick: () => pick(i) }, `${f.won ? '✓' : '✗'} ${t('robot.layout', { n: i + 1 })}`),
      );
      const regression = enemy.regression === false ? null : h('p', { class: 'robot-note' }, run.broken.length === 0 && run.won ? t('robot.regression.ok') : '');
      const next = run.won ? nextStep(step) : undefined;
      result.replaceChildren(
        ...[
        h('p', { class: ok ? 'robot-win' : 'robot-loss', 'data-testid': 'robot-outcome', 'data-state': ok ? 'won' : 'lost', 'aria-live': 'polite' }, text),
        ...extra,
        regression,
        h('div', { class: 'robot-layouts', role: 'group' }, ...tabs),
        viewer,
        next ? h('button', { class: 'robot-next', 'data-testid': 'robot-next', onclick: () => (game.open(next.id), showStep(next.id)) }, `${t('robot.next')}: ${titleOf(next)}`) : null,
        ].filter((n): n is HTMLElement => n !== null),
      );
      pick(failedFirst);
    }

    const build = game.build();
    show(
      stepHeader(step),
      h('section', { class: 'robot-card' }, h('h3', {}, t('robot.twist')), h('p', { 'data-testid': 'robot-twist' }, enemy.twist[lang])),
      buildPanel(() => showStep(step.id)),
      apiPanel(build),
      h('section', { class: 'robot-editor' }, h('h3', {}, t('robot.code')), h('p', { class: 'robot-note' }, t('robot.code.hint')), (area = editor(game.script(), (text) => game.setScript(text)))),
      h(
        'div',
        { class: 'robot-actions' },
        h('button', { class: 'robot-run', 'data-testid': 'robot-run', onclick: () => (game.setScript(area.value), fight()) }, t('robot.run')),
        h('button', { class: 'run-control', 'data-testid': 'robot-hint', onclick: () => (game.hint(step.id) < 3 && game.nextHint(step.id), renderHints()) }, t('robot.hint')),
      ),
      hintBox,
      result,
      historyBox,
    );
    renderHints();
    renderHistory();
  }

  /** The next unsolved battle after this step, for the "Next" button. */
  function nextStep(step: Step): Step | undefined {
    const i = game.steps.indexOf(step);
    return game.steps.slice(i + 1).find((s) => s.kind === 'battle' && game.unlocked(s.id) && !game.progress().solved.includes(s.id));
  }

  function stepHeader(step: Step): HTMLElement {
    return h(
      'header',
      { class: 'subpage-header' },
      h('button', { class: 'icon-button', 'aria-label': t('nav.back'), title: t('nav.back'), onclick: () => (game.open(step.id), showMap()) }, svg(BACK)),
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
        show(...head, h('p', { class: 'robot-note' }, t('robot.constraint.rule', { n: c.maxLines })), apiPanel(game.build()), area, h('button', { class: 'robot-run', 'data-testid': 'robot-check', onclick: () => out.replaceChildren(...constraintResult(c, area.value, step)) }, t('robot.run')), out, back);
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

