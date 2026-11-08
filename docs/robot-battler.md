# Robot Battler

Pydra's fifth game (route `#/robot`, Home card "Roboter-Kampf" / "Robot Battler"). The player builds a robot, writes
**one** Python script that drives it, watches the battle as a replay with the active code line highlighted, and improves
the same script enemy after enemy. The design is the Claude Doc "Robot Battler – Game Design Document"; this file is the
status and the handover. Everything lives in `web/src/robot/` (engine, interpreter, content) plus `web/src/views/robot.ts`.

Decisions for the doc's open questions: the UI is Pydra's de/en with **English function names**; player-vs-player is out
of scope; `try / except` stays outside the subset (friendly "not available" message).

## Status: about half of the MVP

| Done | Where |
| --- | --- |
| Deterministic grid/tick engine: HP, armor, walls, rubble, pits, simultaneous resolution, shields, seeded RNG, tick limit | `engine.ts`, `rng.ts`, `layout.ts` (ASCII maps, seeded mirroring) |
| Python interpreter for the teaching subset, **resumable** (generators pause at action calls, per-tick step budget), friendly errors (de/en) with did-you-mean, pre-battle checker, CPython golden tests (200 snippets) | `py/` (`lexer`, `parser`, `interp`, `builtins`, `values`, `check`, `errors`), `friendly.ts`, `messages-errors.ts` |
| Parts as host objects: wheels, spider legs, blaster (+ burst Mk II), cannon, eyes (+ wide-angle, shield scanner), hammer, shield, GPS, `clock`; "not equipped" messages; uncharged actions lose the tick | `parts.ts`, `build.ts` |
| Battle runner recording frames (positions, events, script line, sensor reads, say() bubbles) | `battle.ts` |
| Canvas replay viewer: scrub/step/play, code line highlight, sensors, text log of every tick | `replay.ts`, `views/robot.ts` |
| Chapter 0-2 enemies (26) + Proving Grounds I (6) = **32 battles**, three layouts each | `content/chapter0.ts`, `chapter1.ts`, `chapter2.ts`, `proving1.ts` |
| Build/code/battle/improve loop; "never a blank file" persistence; regression re-test of earlier enemies of the chapter on every run (a win that breaks one does not count); stars; 3-step hint ladder; script history with restore; points/XP via the existing points system (`game: 'robot'`) | `game.ts`, `fight.ts` |
| **12 challenges**: 2 Line Up, 3 Predict, 3 Glitch, 2 Workshop (paint brush), 2 Constraint | `content/challenges.ts`, `challenges.ts` |
| Tests: 360+ unit tests in `web/src/robot/*.test.ts` (every enemy is won by its solution, regression-safe, and not won by the previous solution), Playwright `e2e/robot.spec.ts` | |

Deviations from the doc, on purpose: chassis HP is 8/12 (the table), not "10 default"; battles run on the main thread (they
are tiny: the engine is pure and worker-ready, see Remaining work); the editor is a `<textarea>` (no CodeMirror
dependency); `wait()` costs one tick ("free" in the doc means "needs no part"); `distance()` returns 0 when nothing is in
range; a win ends the battle at once, but free statements right after the winning action (e.g. `say("done")`) still run.

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
  enemies: [{ hp: 2, armor: 0, face: 'W', gear: ['blaster','eyes'], script: 'fire()' }],   // 'D' = enemies[0], '1'-'9' = n-th
  maps: [mk(8, 8, ['^', 3, 7], ['D', 3, 4]), …],     // 1-3 ASCII layouts (. # ~ rubble o pit, ^ > v < player, D/1-9 enemies)
  maxTicks: 30,                                       // optional, loses at this tick
  needs: { say: true, sayPrefix: 'Distance: ', sayOnce: 'done', maxLines: 6 },
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
Chapter text: add `robot.chapter.N` in `messages-ui.ts`; `unlockLevel()` in `game.ts` maps chapter 25 (Proving Grounds I) to 2.
A challenge (`content/challenges.ts`) sits `after` an enemy id and has `kind` lineup | predict | glitch | workshop | constraint;
logic and checks are in `challenges.ts` (predict answers are computed by running the script, so they cannot be wrong).
Every new step also needs nothing else: `RobotGame` builds its step list from the two data files, and Home/points/profile
pick the new total up automatically.

## Remaining work (not started)

1. **Chapter 3 – if/elif/else** (`content/chapter3.ts`, add `robot.chapter.3`): Peekaboo, Three-Way, Bubble, Charger,
   boss Gatekeeper (worked example in the doc) and the extras Wall or Not, Health Check, Rhythm Dummy (`clock.tick() % 2`),
   Order Matters, Not Today. Engine/parts for it already exist and are tested: medium chassis, wide-angle eyes
   (`see_left/see_right`), shield scanner (`enemy_shielded`), hammer, shield, `clock`. Enemies that fight back need
   `EnemyDef.script`/`gear` (supported; see `battle.test.ts` "enemies run Python too"). Bubble = `while True: shield.activate(); wait()`.
   Gating note: parts of Chapter 3/4 unlock when the first unsolved main battle is in that chapter (`UNLOCK_CHAPTER`).
2. **Chapter 4 – while / booleans**: Far-Far Dummy, Regenerator, Maze Runner, Patroller, boss Hide & Seek, extras Run to
   the Wall, Countdown, Sentry Duty, Break Out, Crate Courier. Needs GPS (done), burst blaster Mk II (done), and for
   Crate Courier a **gripper + crates** (not implemented: engine has no items). Treads (+3 armor, `push()`) are not implemented.
3. **Proving Grounds II** (8 mixed fights + boss Final Exam, "Basics Certificate") and the missing PG-I fights (doc: 6 +
   boss; done: 5 + boss, all in the Chapter 2 frame because one script must win them – `content/proving1.ts`, `mix`).
4. **Missing Chapter 0-2 enemies**: Chapter 0 *Backstep Dummy* (`backward()`; needs a layout where backing up matters –
   e.g. add a minimum range or a rear target), Chapter 2 *Growing Shots* (`fire(i)` – needs a cannon+blaster build or the
   burst blaster; cooldown makes a clean loop awkward). Chapter 1 and 2 extras not in the table above are done.
5. **Missing challenges** (12 of ~25 done; ids in `content/challenges.ts`): Ch0 extra Line Up / Predict; Ch1 Predict value
   of `x`, Glitch misspelled variable, Glitch `"3" + 3`, Constraint "no number written twice" (needs a new
   `Needs.noRepeatedNumber` check); Ch2 Workshop *Art Studio* stairs and spiral, Glitch wrong indentation variants,
   Constraint Dummy Row in 5 lines (done: 3 lines); Ch3 Predict which branch runs, Glitch `=` vs `==`, Glitch missing colon,
   Workshop *Battery Sorter* (needs gripper); Ch4 Predict loop count, Glitch infinite loop, Constraint Maze Runner without `for`.
6. **Features**: the *gauntlet* as a visible event (boss, then all earlier enemies in a row with a summary; today the
   earlier enemies are re-run silently on every run and only gate the win – `RobotGame.run`); *concept cards* (2-minute
   card per chapter, first-appearance cards for parts); Training Grounds (seeded endless arenas + daily); Throwback and bonus
   enemies; reading the enemy's source after beating it (tier ≥ 3); cosmetics/optional gear earned with stars (the ~20 optional
   gear items of the doc are all missing); stars only count, they unlock nothing yet; script history has no diff view and
   no limit UI beyond 30 entries.
7. **Engineering**: run battles in a **Web Worker** (`runBattle`/`fightEnemy` are pure; move them behind a worker with
   `postMessage`, keep `Frame` JSON-serialisable – `RbError` needs a plain-object form); a **CodeMirror 6** editor with
   gutter line numbers and error marks (the textarea has neither); seeded `mirror` layouts for Chapters 3+; Mk III upgrades
   and Chapters 5-9 (Mk II long-range eyes, directional shield, functions `def`, classes `__init__` for Chapter 8: the parser
   rejects `class` today).
8. **Tests to add with new content**: nothing new is needed for enemies/challenges (the data-driven tests pick them up);
   add golden snippets to `py/golden-snippets.ts` and run `npm run golden -w web` for every new Python feature.
