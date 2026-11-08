# Robot Battler

Pydra's fifth game (route `#/robot`, Home card "Roboter-Kampf" / "Robot Battler"). The player builds a robot, writes
**one** Python script that drives it, watches the battle as a replay with the active code line highlighted, and improves
the same script enemy after enemy. The design is the Claude Doc "Robot Battler – Game Design Document"; this file is the
status and the handover. Everything lives in `web/src/robot/` (engine, interpreter, content) plus `web/src/views/robot.ts`.

Decisions for the doc's open questions: the UI is Pydra's de/en with **English function names**; player-vs-player is out
of scope; `try / except` stays outside the subset (friendly "not available" message).

## Status: the MVP content is complete (Chapters 0-4, both Proving Grounds)

| Done | Where |
| --- | --- |
| Deterministic grid/tick engine: HP, armor, walls, rubble, pits, simultaneous resolution, shields, regeneration, push, armor plates, seeded RNG, tick limit | `engine.ts`, `rng.ts`, `layout.ts` (ASCII maps, seeded mirroring) |
| Python interpreter for the teaching subset, **resumable** (generators pause at action calls, per-tick step budget), friendly errors (de/en) with did-you-mean, pre-battle checker, CPython golden tests (200 snippets) | `py/` (`lexer`, `parser`, `interp`, `builtins`, `values`, `check`, `errors`), `friendly.ts`, `messages-errors.ts` |
| Parts as host objects: wheels, spider legs, **treads** (+3 armor, 2-tick turns, `push()`), blaster (+ burst Mk II), cannon, eyes (+ wide-angle, shield scanner), hammer, shield, GPS, **armor plates** (optional, 12 stars), `clock`; "not equipped" messages; uncharged actions lose the tick | `parts.ts`, `build.ts` |
| Battle runner recording frames (positions, events, script line, sensor reads, say() bubbles) | `battle.ts` |
| Canvas replay viewer: scrub/step/play, code line highlight, sensors, text log of every tick | `replay.ts`, `views/robot.ts` |
| **Line-by-line fights**: the interpreter emits a deterministic **trace** (`py/trace.ts`: line, call with args/result, set, branch/loop pass, enter/leave) that `runBattle({trace: true})` stores per tick in `Frame.trace` (`Frame.after` = lines after the winning action; capped at `TRACE_CAP`, off for fast checks). `stepper.ts` cuts frames into *beats* (one per executed line, one `resolve` per tick) and computes variables, call stack and per-line hints at any beat; `narration.ts` words them. The viewer (`views/robot-viewer.ts`): highlighted line with inline hints (`distance() → 3`, ✓ wahr, `x = 3`), call pills and move ghost on the arena, variable strip, call stack, "what happens now", sensors/say, play/pause, line/tick step both ways, restart, speed slider (default very slow, `SPEED_MS`), "Tick N" + "Zeile L · Schritt n von m". Paused at start; phone stacks arena above code | `py/trace.ts`, `stepper.ts`, `narration.ts`, `views/robot-viewer.ts`, `replay.ts` |
| **Variation queue**: after Run the first fight plays; then all other layouts of the enemy and every layout of the earlier chapter enemies (`RobotGame.variationQueue`, `variations.ts`) play one after another (auto-advance, can be switched off), chips show progress/result, Skip / Skip all / Next, and a summary lists won/lost with the reason (script error line, budget, destroyed, timeout, unmet rule) and a "Watch" button per fight | `variations.ts`, `views/robot.ts` (`variationQueue`) |
| **62 battles**: Chapter 0 (9, incl. Backstep Dummy), 1 (9), 2 (10, incl. Growing Shots), Proving Grounds I (6), **Chapter 3 (10)**, **Chapter 4 (9)**, **Proving Grounds II (8 fights + boss Final Exam)**; three layouts each | `content/chapter0.ts` ... `chapter4.ts`, `proving1.ts`, `proving2.ts` |
| Build/code/battle/improve loop; "never a blank file" persistence; regression re-test of earlier enemies of the chapter on every run; stars; 3-step hint ladder; script history with restore; points/XP via the existing points system (`game: 'robot'`); **Basics Certificate** banner after the Final Exam | `game.ts`, `fight.ts` |
| **29 challenges**: 3 Line Up, 7 Predict, 9 Glitch, 5 Workshop (paint brush), 5 Constraint (line limits, `without`, no repeated number) | `content/challenges.ts`, `challenges.ts` |
| **Concept cards**: one per chapter 0-4 and one per new part (cannon, legs, wide-angle + scanner, hammer, shield, GPS, treads, burst blaster); open until read, then a click away | `content/cards.ts`, `cardsBlock()` in the view |
| **Training Grounds** (from Chapter 2): endless seeded fights built from the frame of the latest chapter, plus a daily fight (seed from the date); every generated fight has a winning script and is tested for 60 seeds | `training.ts`, `RobotGame.trainingStep/runTraining` |
| Tests: 500+ robot unit tests (incl. `trace.test.ts`, `stepper.test.ts`, `variations.test.ts`) (every enemy is won by its solution, regression-safe, and not won by the previous solution; chapter-specific rule tests in `chapters.test.ts`), Playwright `e2e/robot.spec.ts` (loop, builder, line-up, Chapter 3, Chapter 4 to the certificate, Training Grounds, stepping view on phone and desktop, call stack, variation queue and summary) | |

Deviations from the doc, on purpose: chassis HP is 8/12 (the table), not "10 default"; battles run on the main thread (they
are tiny: the engine is pure and worker-ready, see Remaining work); the editor is a `<textarea>` (no CodeMirror
dependency); `wait()` costs one tick ("free" in the doc means "needs no part"); `distance()` returns 0 when nothing is in
range; a win ends the battle at once, but free statements right after the winning action (e.g. `say("done")`) still run.
Chapter 3 uses a 9x8 arena (robot at (4, 6)) so left and right are symmetric; its final build is blaster + eyes + shield
(the medium chassis has three slots), so the hammer is an alternative for the Charger, not a requirement. Chapter 3-4
extras are side missions (`regression: false`) with their own set-up, like the Chapter 2 extras. Proving Grounds II mixes
Chapter 3 and 4 fights (their frames are the only ones one script can win together); `id#n` in `mix` picks layout n.

## Architecture

```
script ──parse──▶ AST ──checkProgram──▶ friendly error?
                    │
build ─▶ createEnv (parts.ts): globals + objects (host functions)       tick loop (battle.ts)
                    ▼                                                     per tick, per robot:
        Program.runUntilAction(1000) ◀──── Brain ◀────────────────────── intent (Step[] queue)
                    │ ActionRequest (pauses mid-expression)               ▼
                    └──────────────────────────────────────────────▶ World.step(intents) ─▶ events ─▶ Frame
```

* **Interpreter** – a generator-based tree walker (`interp.ts`). `Program.runUntilAction(maxSteps, resume)` runs until a
  host function returns an `ActionRequest`, the script ends, fails or burns the budget (1 000 statements/calls per tick →
  "loop that never acts" message). Values: ints are JS numbers, floats `PyFloat`, plus `PyTuple`, `PyDict`, `PyRange`.
  Supported: int/float/str/bool/None, arithmetic incl. `//` `%` `**`, chained comparisons, `and/or/not/in/is`, ternary,
  `if/elif/else`, `for` (range, list, str, dict, tuples unpacking), `while`, `break/continue`, `def` (defaults, kwargs,
  closures, `global`), recursion limit, lists/tuples/dicts with methods, slicing, f-strings with format specs, `print`
  (→ speech bubble). Not available (friendly message): import, try/except, lambda, class, with, comprehensions, yield, async.
* **Golden tests** – `py/golden-snippets.ts` holds the snippets, `py/golden.json` the CPython 3.14 output (stdout, error
  type, error line), recorded by `npm run golden -w web` (`scripts/golden.mjs` + `scripts/golden-runner.py`).
  `py/py.test.ts` runs every snippet in the TS interpreter and compares; it also re-runs CPython when `python3` exists.
* **Parts** – `createEnv()` in `parts.ts` returns the Python globals for a build. An action method returns a list of
  steps (one per tick; a step may be a function evaluated when its tick comes, so cooldowns are right). Cooldown `N` means
  usable again `N` ticks later; a shield raised on tick t blocks on tick t+1.
* **Engine** – `World.step(intents)`: turns/shields, then moves (conflicts fail), then all attacks at once, damage applied
  together; win = all enemies down and the player standing; time out (200 ticks, or `maxTicks`) = loss.
* **Progress** – `RobotGame` (`game.ts`) stores `{build, script, history, solved, stars, hints, misses, runs, wins}` under
  `pydra.v1.robot` (`GAME_DATA_KEYS`), parsed defensively. `stats()` feeds Home and the points context; a first win calls
  `onPoints({type:'level', game:'robot', id, clean})`. Parts unlock by chapter (`UNLOCK_CHAPTER` in `build.ts`, level =
  chapter of the first unsolved main battle).
* **PWA/offline** – nothing is fetched; all content is bundled in the main chunk and precached like the rest.

## Data format: adding content

An enemy is a plain object (`content/types.ts` → `EnemyData`) appended to `ENEMIES` in `content/index.ts` (order = play order):

```ts
{
  id: 'peekaboo', title: T('Guck-guck', 'Peekaboo'), twist: T('…', '…'), idea: T('…', '…'), // hint 1 = twist, 2 = idea
  skeleton: 'if see() == "enemy":\n    ???',        // hint 3
  enemies: [{ hp: 2, armor: 0, face: 'W', gear: ['blaster','eyes'], script: 'fire()', regen: { every: 2, amount: 1 } }],   // 'D' = enemies[0], '1'-'9' = n-th
  maps: [mk(8, 8, ['^', 3, 7], ['D', 3, 4]), …],     // 1-3 ASCII layouts (. # ~ rubble o pit, ^ > v < player, D/1-9 enemies)
  maxTicks: 30,                                       // optional, loses at this tick
  needs: { say: true, sayPrefix: 'Distance: ', sayOnce: 'done', maxLines: 6,
           maxDamage: 4, noWaste: true, uses: ['while'], without: ['for'], noRepeatedNumber: true },
  solution: '…', solutionBuild: { gear: ['cannon','eyes'] },  // a script that beats this and all earlier enemies of the chapter
  breaks: true,                                       // the previous solution must NOT win (set false for practice enemies)
  regression: false,                                  // side mission with its own set-up, not part of the chapter run
  par: 5,                                             // lines for the "few lines" star
}
```

`enemies.test.ts` checks automatically that the solution wins every layout, beats all earlier non-side enemies of its
chapter (the line limit / `sayOnce` of old enemies are ignored there), and that the previous solution does not win.
Enemy scripts use the same API as the player (`script`, `gear`, `locomotion`); a failing enemy script throws in tests.
`layout.ts` can mirror a map per seed (`mirror: true` on the layout) – unused so far because Chapters 0-2 are fixed-pose.
Chapter text: add `robot.chapter.N` in `messages-ui.ts`; `unlockLevel()` in `game.ts` maps chapter 25 (Proving Grounds I) to 2 and 45 (Proving Grounds II) to 4. A concept card is one entry in `content/cards.ts`.
`needs` rules: `maxDamage` (HP lost per layout), `noWaste` (no shot into a raised shield), `uses` / `without` (words in the code, comments and strings ignored; `"while True"` and `"fire(i)"` work), `noRepeatedNumber`. A mixed Proving Grounds fight lists `mix: ['peekaboo#2', 'bubble']` (first layout, or the n-th with `#n`) and no maps of its own.
A challenge (`content/challenges.ts`) sits `after` an enemy id and has `kind` lineup | predict | glitch | workshop | constraint;
logic and checks are in `challenges.ts` (predict answers are computed by running the script, so they cannot be wrong).
Every new step also needs nothing else: `RobotGame` builds its step list from the two data files, and Home/points/profile
pick the new total up automatically.

## Remaining work

1. **Engineering** (not started, deliberately left): run battles in a **Web Worker** (`runBattle`/`fightEnemy` are pure; move
   them behind a worker with `postMessage`, keep `Frame` JSON-serialisable - `RbError` needs a plain-object form); a
   **CodeMirror 6** editor with gutter line numbers and error marks (the textarea has neither). Everything fits in a few
   milliseconds on the main thread today, so neither blocks a release.
2. **Not built from the design doc**: Crate Courier and Battery Sorter (need a gripper and crates: the engine has no items);
   the other ~18 optional gear items (railgun, flamethrower, hook, EMP, mines, boomerang, ears, thermal camera, analyzer,
   hacking module, smoke, cloak, decoy, turbo, jump jets, teleporter, scout drone, repair drone) and cosmetics earned with
   stars - armor plates (`STAR_GATE` in `build.ts`) is the template for a passive item, `parts.ts` for an active one;
   Throwback and bonus enemies; the gauntlet is now visible as the variation queue (every enemy, not only the boss); the trace is not shown for *enemy* scripts (only the player's); reading the enemy's
   source after beating it (tier >= 3); seeded `mirror` layouts for Chapters 3+ (the Chapter 3-4 layouts are fixed so that
   each side is tested on purpose); script history has no diff view.
3. **Chapters 5-9** (functions, lists, dictionaries, state, Arena League), Mk III upgrades and the Chapter 5+ parts
   (hover jets, repair kit, radar, missile pod, heavy chassis, directional shield, ...). The parser rejects `class` today
   (needed for Chapter 8).
4. **Tests to add with new content**: nothing new is needed for enemies/challenges (the data-driven tests pick them up);
   add golden snippets to `py/golden-snippets.ts` and run `npm run golden -w web` for every new Python feature. Rules that are
   the point of a twist deserve an explicit case in `chapters.test.ts` (see Bubble: blind shooting; Gatekeeper: waiting).
