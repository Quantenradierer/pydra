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
| Parts as host objects: wheels, spider legs, **treads** (+3 armor, 2-tick turns, `push()`), blaster (+ burst Mk II), cannon, eyes (+ wide-angle, shield scanner), hammer, shield, GPS, **armor plates** (free like all gear), `clock`; "not equipped" messages; uncharged actions lose the tick | `parts.ts`, `build.ts` |
| Battle runner recording frames (positions, events, script line, sensor reads, say() bubbles) | `battle.ts` |
| Robot art: registry + sockets + renderer, used by the build screen, arena, cards, Home (see *Robot art*) | `robot/art/`, `views/robot-bench.ts`, `views/robot-gallery.ts` |
| Canvas replay viewer: scrub/step/play, code line highlight, sensors, text log of every tick | `replay.ts`, `views/robot.ts` |
| **Line-by-line fights**: the interpreter emits a deterministic **trace** (`py/trace.ts`: line, call with args/result, set, branch/loop pass, enter/leave) that `runBattle({trace: true})` stores per tick in `Frame.trace` (`Frame.after` = lines after the winning action; capped at `TRACE_CAP`, off for fast checks). `stepper.ts` cuts frames into *beats* (one per executed line, one `resolve` per tick) and computes variables, call stack and per-line hints at any beat; `narration.ts` words them. The viewer (`views/robot-viewer.ts`): highlighted line with inline hints (`distance() → 3`, ✓ wahr, `x = 3`), call pills and move ghost on the arena, variable strip, call stack, "what happens now", sensors/say, play/pause, one step (line or round), restart, to the end, speed button (default 800 ms per step, `SPEED_MS`), "Tick N" + "Zeile L · Schritt n von m". Plays at once when the fight starts; the listing replaces the editor in the same box, the arena sits under the task sentence | `py/trace.ts`, `stepper.ts`, `narration.ts`, `views/robot-viewer.ts`, `replay.ts` |
| **One fight per challenge** (rb21): every task (battle, bug hunt, special rule) is exactly one fight on one map; there is no fight list, no `Kampf k von n`, no earlier-enemy re-test. The level pills of the game bar are the only list | `fight.ts` (`fightEnemy`, `layoutOf`), `views/robot.ts` (`playFight`) |
| **62 battles**: Chapter 0 (9, incl. Backstep Dummy), 1 (9), 2 (10, incl. Growing Shots), Practice Field I (6), **Chapter 3 (10)**, **Chapter 4 (9)**, **Exams (8 fights + boss Final Exam)**; one map each (`map`) | `content/chapter0.ts` ... `chapter4.ts`, `proving1.ts`, `proving2.ts` |
| Build/code/battle/improve loop; "never a blank file" persistence; stars; script history with restore; points/XP via the existing points system (`game: 'robot'`); **Basics Certificate** banner after the Final Exam | `game.ts`, `fight.ts` |
| **Challenges** (the player always writes or edits code; Line Up and Predict were removed, as were hints): Workshop (painting) was removed: everything in Robot Battler is write the script, press Fight, watch the robot battle. 6 Glitch and 4 Constraint remain, and both are real fights on the normal battle screen (see below); Constraint (line limits, `without`, no repeated number) | `content/challenges.ts`, `challenges.ts` |
| **Training Grounds** (from Chapter 2): endless seeded fights built from the frame of the latest chapter, plus a daily fight (seed from the date); every generated fight has a winning script and is tested for 60 seeds | `training.ts`, `RobotGame.trainingStep/runTraining` |
| Tests: 500+ robot unit tests (incl. `trace.test.ts`, `stepper.test.ts`) (every enemy is won by its solution and not won by the previous solution; chapter-specific rule tests in `chapters.test.ts`), Playwright `e2e/robot-order.spec.ts` (page order, one list, no fight list, bug-hunt text), `e2e/robot.spec.ts` (one-page layout, loop, builder, bug-hunt fight, Chapter 3, Chapter 4 to the certificate, Training Grounds, stepping view on phone and desktop, call stack) | |

Deviations from the doc, on purpose: chassis HP is 8/12 (the table), not "10 default"; battles run on the main thread (they
are tiny: the engine is pure and worker-ready, see Remaining work); the editor is a `<textarea>` (no CodeMirror
dependency); `wait()` costs one tick ("free" in the doc means "needs no part"); `distance()` returns 0 when nothing is in
range; a win ends the battle at once, but free statements right after the winning action (e.g. `say("done")`) still run.
Chapter 3 uses a 9x8 arena (robot at (4, 6)) so left and right are symmetric; every fight is won with the default build; shield and hammer are optional
(the medium chassis has three slots). Chapter 3-4
extras are side missions (`side: true`) with their own set-up, like the Chapter 2 extras. Practice Field I and the Exams are review fights: each takes the map and enemies of one Chapter 2 / 3 / 4 enemy (`like` in `proving1.ts` / `proving2.ts`) and is won by one general script.

**One fight per challenge (rb21)**: an enemy has ONE `map` (it was three layouts) and the earlier enemies of the chapter are no longer re-run; the chosen map is the one that still teaches the topic (Peekaboo: enemy to the right, Three-Way: to the left). Old saves keep working: they only store solved ids, stars and script; ids that no longer exist are dropped by `parseProgress`.

### Screen layout (information architecture)

**One task = one page, the same pattern as the other games** (`views/robot.ts` `showBattle`; styles `robot-work.css`; texts
`robot/messages-work.ts`, `messages-ui.ts`). Nothing on it is decoration: every element is something the player asked for.
Shared pieces reused from the other games: `game-bar` (back arrow + level pills, `views/level-strip.ts`), the `.run-controls` icon buttons,
`button.primary`, the `verdict correct|wrong` line, `.level-dot` pills, and the native-`<dialog>` bottom sheet `views/robot-sheet.ts`.

Top to bottom on a phone (one scrolling column):

1. **Header** (`game-bar`): back + the pills 1..N of the chapter's tasks: the ONLY list on the page (one fight per task, so there is no fight list).
   The h1 (task name) is there for screen readers only.
2. **Equipment row** (`robot-equipment`): directly under the pills, one compact button "Ausrüstung / Equipment" with the equipped parts (drive + gear) as small
   icons; it opens the parts sheet.
3. **Goal line** (`robot-catch`, at most two lines on a phone, `task-text.test.ts` limits it to 96 characters): `robot.goal.one|many` ("Zerstöre den Gegner.") + the
   task's one short catch sentence (`catchLine`). A bug hunt says only "Das Skript hat einen Fehler. Finde ihn." (`GLITCH_PROMPT`); a special rule says its rule
   ("Höchstens 3 Zeilen Code."). Nothing generated, nothing about the bug.
4. **Arena**: a preview with both robots before the fight; the fight afterwards (same widget).
5. **Run controls**: ↺ restart, ▶/⏸ play / pause, → step (one code line), ⇥ to the end, and the **speed button** (`⏱ mittel`, cycles
   langsam 1200 ms / mittel 800 / schnell 450 / sehr schnell 150 per step; `SPEED_MS`, `DEFAULT_SPEED`). "What happens now" under it.
6. **Script**: the editor (suggestion strip + `?` help sheet) or, while a fight shows, the listing with the executing line highlighted.
7. **Verdict** (`robot-outcome`, stars, the star rule) and **ONE primary button**: `Kampf starten` -> while the fight plays `Zum Ergebnis`
   (skips to the end) -> after a win `Weiter: Aufgabe n` (or back to the tasks) / after a loss `Skript verbessern`. Editing the script (or
   focusing the editor) stops the fight, hides the verdict and makes it `Kampf starten` again.

**Desktop (>= 960 px)**: pills and equipment row on top, then two columns (left: goal, arena, controls; right: script, verdict, primary); the page does not scroll at 1280x800.

**The fight (rb19)**: pressing `Kampf starten` plays the fight at once, slowly (`playFight` calls `viewer.play()`; before this
fix the fight loaded *paused* and the verdict showed at once, so "nothing happened"). Each step lights the code line, shows the call pill and
the move / shot on the arena and a sentence of narration; a command line is followed by its round. The verdict, the stars and the points
(`RobotGame.run(id, true)` returns `award()`, which the screen calls when the verdict shows, so the +XP toast does not spoil the result)
come when the fight reached its end or was skipped. Nothing advances by itself. A lost fight says why in the verdict line (unmet rule, error with line, `robot.outcome.dead|timeout`).

**Removed in rb21**: the second list (fight pills, `Kampf k von n`, the loss reason per fight, `variations.ts`), the re-run of earlier chapter enemies (`broken`, `earlierEnemies`, `robot.regression.*`), the three layouts per enemy and `mix`, the 3-sentence goal block, the generated bug description of a bug hunt, the equipment button next to the text (it is the row under the pills now).

**Removed in rb19 (never asked for)**: the two-robots row and the "Teile" button above the arena (the equipment button remains, renamed),
the *Mehr* sheet (fights summary, next / skip / skip all, **"Automatisch weiter"** / `robot.vq.auto`, speed slider, step size, variables, call
stack, sensors, log, script versions), the variation-queue menu, the chapter / task name as text on the task page (the map's start card and the
primary button say `Aufgabe n`). There is no share, export or achievement UI in Robot Battler (the `+XP` toast is the app-wide points system
and now comes with the verdict). Script history is still stored by `RobotGame` but has no screen.

**Inserting code** (`suggest.ts` `insertSnippet`, pure, unit-tested): commands and block snippets never share a line with other code.
Empty line: goes there (one level in after a line ending with `:`); a partly typed word that the snippet completes is replaced; behind
code or mid-line: a new line below with the current indent (+4 after a colon); a selection is replaced; operators and sensor values
(`x = ` + `distance()`) go in at the caret. Block snippets leave the caret in their body.

Tests: `e2e/robot-fight.spec.ts` (samples the arena at several times during a fight: robot positions, highlighted line and step counter
change, no verdict at t=0, verdict last; pause / step / speed / skip; points toast only with the verdict; no share / automatic / pictures
row / chapter name), `e2e/robot.spec.ts` (`expectOneNavigation`, desktop no-scroll, phone one column), `e2e/robot-controls.spec.ts` (dead
controls), `e2e/robot-ux.spec.ts`, `e2e/robot-editor.spec.ts` (tap forward() then backward() = two lines), `e2e/helpers.ts` (`startFight`, `runFight` = start + skip).
Not changed: the Home screen (shared by all games). Still open: no keyboard shortcut for stepping.

**rb20 playtest fixes** (hostile first-time play at 360x740 and 1280x800, de and en, screenshots every 500 ms during fights):
* A lost fight whose script had ended played 200 empty rounds at 800 ms (~160 s of nothing). `stepper.ts` `isIdleBeat` / `idleRunEnd`: a run of rounds with no line,
  no event and no speech is one step ("Dein Skript ist zu Ende ..." / `robot.narr.idle`), the playback and the → button jump over it; any fight is played at the fastest speed
  after `SLOW_STEPS` (40) steps so a never-ending loop does not take minutes (the first steps stay at the chosen speed).
* On a phone the verdict and the primary button were below the fold when a fight ended: the page now scrolls them into view (`scrollIntoView({block:'nearest'})`, no move when visible).
* A bug hunt opened with a script that does not win showed the text "forward() is spelled differently" but no bug: that script is replaced once per visit by the challenge's `fallback`
  (a fix in progress stays). The map card and the next button say "Kapitel 1: Zahlen und Variablen · Aufgabe 1" when the chapter is not the current one ("Aufgabe 1" alone was ambiguous).
* Constraint tasks said their rule twice (prompt + `rule` sentence): the `rule` field is gone. The `Python-Meldung` disclosure has an arrow (it looked like a dead label). The Training
  buttons have a gap. The armor plates label no longer says "ab 12 Sternen" (the lock was removed long ago).
* Known and left: the strip chips are labelled `forward(1)` but insert `forward()` with the caret inside; the points toast (app-wide) stays 4.5 s and can cover the pills.

## Robot art (modular images)

Everything that shows a robot or a part - build screen, part lists and icons, arena, replay, enemy card,
Home card - goes through **one renderer**: `web/src/robot/art/compose.ts` (`robotSvg` / `robotEl` / `iconEl`). Top-down SVG,
100 x 100 box, the robot faces east; the arena rotates the whole picture for N/E/S/W. No binary images, no fonts.

* `types.ts` - `ChassisArt` (hull SVG, six named **sockets** `top front back left right underside`, each with `x, y, rot, scale, layer`,
  plus the gear `slots` in fill order), `PartArt` (`draw(tier)`, `fits` sockets, optional `muzzle`), `RobotSpec`.
* `sockets.ts` - socket transform, `anchorPoint` (a part point in the chassis box), `assignSockets` (which gear sits in which slot:
  a small backtracking match over `fits`), `emptySockets`, `paintOrder` (layer order; the locomotion layer is behind the body).
* `chassis/{light,medium,heavy}.ts`, `parts/*.ts` (wheels, legs, treads, hover, blaster, cannon, eyes, hammer, shield, gps, plates) -
  **one file per image**; `registry.ts` is the list. `heavy` and `hover` are art for Chapter 5+ (the game has no such ids yet).
* Palette and state classes: `robot-art.css` (CSS variables `--rb-*`; shapes use `f-body f-hi f-lo f-metal f-dark f-acc f-glow f-hot f-light`
  and `ln`; the enemy palette is `.rb-enemy`). The robot always sits on a dark "stage" (`.rb-stage`), so it reads in light and dark mode.
  Tiers: Mk II blaster, wide and scanner eyes are drawn differently (`Tier` argument).
* Build screen (`views/robot-bench.ts`): the big robot has tap targets on every socket and the drive strip; empty slots are dashed plug
  outlines; tapping one lists the gear that would click into it (`gearForSocket`), tapping a part offers "Remove", tapping the strip
  chooses the drive. New parts get the snap-in animation (`.rb-snap`, off with `prefers-reduced-motion`).
* Arena (`robot/art/arena.ts`): an absolutely positioned layer over the board canvas; each robot is built from `BattleResult.builds`,
  moves/turns with CSS transitions, shows HP, shield bubble (`shield-up`), the destroyed state (`dead`) and one-tick effects from the
  engine events (`fx-fire` muzzle flash, `fx-smash` hammer swing, `fx-hit` flash, `fx-move`). Shots start at the weapon's muzzle.
* Dev gallery: `#/dev/robots` (not linked anywhere) shows every chassis and part at 24-240 px, player and enemy, in light and dark.

**Adding the artwork for a new part is an art-only change**: write `parts/<id>.ts` exporting a `PartArt` (draw around the origin, +x
pointing away from the robot, use the `kit.ts` helpers and `f-*` classes) and add it to `PART_LIST` in `registry.ts`; check it in the
gallery. For a new chassis add `chassis/<id>.ts` and a line in `CHASSIS_ART`. The game side (`build.ts`, `parts.ts`) only needs the id.
`art.test.ts` fails if a game part id has no art.

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
* **Progress** – `RobotGame` (`game.ts`) stores `{build, script, history, solved, stars, misses, runs, wins}` under
  `pydra.v1.robot` (`GAME_DATA_KEYS`), parsed defensively. `stats()` feeds Home and the points context; a first win calls
  `onPoints({type:'level', game:'robot', id, clean})`. Gear is free (see *Free gear* below); `INTRODUCED_IN` in `build.ts` only says which chapter introduces a part (level =
  chapter of the first unsolved main battle).
* **PWA/offline** – nothing is fetched; all content is bundled in the main chunk and precached like the rest.

## Data format: adding content

An enemy is a plain object (`content/types.ts` → `EnemyData`) appended to `ENEMIES` in `content/index.ts` (order = play order):

```ts
{
  id: 'peekaboo', title: T('Guck-guck', 'Peekaboo'), catchLine: T('…', '…'), // catchLine = the task card
  enemies: [{ hp: 2, armor: 0, face: 'W', gear: ['blaster','eyes'], script: 'fire()', regen: { every: 2, amount: 1 } }],   // 'D' = enemies[0], '1'-'9' = n-th
  map: mk(8, 8, ['^', 3, 7], ['D', 3, 4]),            // the ASCII map (. # ~ rubble o pit, ^ > v < player, D/1-9 enemies)
  maxTicks: 30,                                       // optional, loses at this tick
  needs: { say: true, sayPrefix: 'Distance: ', sayOnce: 'done', maxLines: 6,
           maxDamage: 4, noWaste: true, uses: ['while'], without: ['for'], noRepeatedNumber: true },
  solution: '…',                                      // a script that beats this enemy with the DEFAULT build (light chassis, wheels, blaster + eyes)
  breaks: true,                                       // the previous solution must NOT win (set false for practice enemies)
  side: true,                                         // side mission with its own set-up, it does not hold back the next task
  par: 5,                                             // lines for the "few lines" star
}
```

`enemies.test.ts` checks automatically that the solution wins the fight and that the previous solution does not win.
Enemy scripts use the same API as the player (`script`, `gear`, `locomotion`); a failing enemy script throws in tests.
`layout.ts` can mirror a map per seed (`mirror: true` on the layout) – unused so far because Chapters 0-2 are fixed-pose.
Chapter text: add `robot.chapter.N` in `messages-ui.ts`; `unlockLevel()` in `game.ts` maps chapter 25 (Proving Grounds I) to 2 and 45 (Proving Grounds II) to 4.
`needs` rules: `maxDamage` (HP lost in the fight), `noWaste` (no shot into a raised shield), `uses` / `without` (words in the code, comments and strings ignored; `"while True"` and `"fire(i)"` work), `noRepeatedNumber`. A challenge (`content/challenges.ts`) sits `after` an enemy id and has `kind` glitch | constraint. Both are fights: `fightOf` (game.ts) derives a side-fight enemy (`side: true`, the rule sentence (a bug hunt: `GLITCH_PROMPT`) as catch line, a constraint's rules merged into `needs`) from the enemy they name, so they use the battle screen, the viewer, stars and history, and `game.run` pays them once. A glitch puts its bug into the player's own script when it opens (only if that script still wins); the player fixes it and fights. No multiple choice, ordering, predict-the-output or painting steps;
logic and checks are in `challenges.ts`.
Every new step also needs nothing else: `RobotGame` builds its step list from the two data files, and Home/points/profile
pick the new total up automatically.

## Script editor suggestions

The editor is a plain `<textarea>` of **fixed height** (`clamp(5.5rem, 31dvh, 13.5rem)`, about 9 lines on a tall phone, text scrolls
inside) with line numbers, ONE suggestion strip under it and a help sheet (`views/robot-editor.ts`, DOM only; logic in the pure
module `robot/suggest.ts`, `suggest.test.ts`; e2e `e2e/robot-editor.spec.ts` on phone, desktop, 360x420 keyboard simulation, de/en).
They are tools, not answers: they list commands and Python shapes, never what a task needs.

- **Line numbers** (`robot-code-lines`), scrolled with the text; no wrapping.
- **Suggestion strip** (`robot-code-strip`, chips `strip-chip`): a single 44 px row directly under the text, horizontally
  scrollable, never wraps, never grows. While a word is typed (or after `part.`) it shows the completions (`completionAt`; `data-mode="complete"`);
  otherwise the most useful next templates for the gear (`nextSnippets`: moving, weapon, eyes, if/while/for/else, `data-mode="next"`).
  No floating popup; focusing opens only the keyboard and the strip. Tap inserts (pointerdown keeps the focus). Keys: **Tab / Enter**
  accept the active chip, **ArrowUp/Down** move through the chips, **Esc** clears the completions, **Ctrl+Space** asks for all;
  without completions Tab indents.
- **`?` button** (`robot-code-more`, accessible name *Hilfe*) at the start of the strip opens a **bottom sheet** (`createSheet`, `robot-code-sheet`, max 72 dvh,
  scrolls inside itself, Esc / `×` / backdrop close; the title once, no hint line, a fading tab row): all templates by group (`snippet-group-*`, `snippet`) and the
  **Befehle deines Roboters** list (`robot-code-help`, entries `cmd`; the only place that lists the commands). Tapping an entry inserts it
  at the caret from before the sheet opened and closes it. Nothing of this is inline, so the page height is the same open or closed.
- **Phone keyboard**: on focus and on `visualViewport` resize the editor and strip are scrolled into view together; with
  the editor and strip stay in view at 360x420 (e2e).
- Page height (code zone body, 360x740): editor block 1189 px -> 280 px.
- The build is read through a getter, so the strip and sheet follow the parts sheet (`Editor.refresh`).

## Free gear

The player can equip **any** part at any time (chassis, drive, gear, Mk II); only slot count and duplicates are refused. No
`locked` state exists any more (`buildProblem` returns `slots` / `duplicate` only, `RobotGame.can` is gone, the 12-star gate of
the armor plates is gone). Chapters only *introduce* parts: `INTRODUCED_IN` (`build.ts`) puts a small "neu / new" tag on the part
in the builder in the chapter that brings it. The eyes' wide-angle and scanner add-ons are part of every pair of eyes
(`see_left()`, `see_right()`, `enemy_shielded()` work from Chapter 0; `addonsFor(gear)`).

**Rule for content: no battle or challenge needs a specific part.** `EnemyData.solution` must win with the *default build*
(`DEFAULT_BUILD` = `START_BUILD`: light chassis, wheels, blaster + eyes); `solutionBuild` no longer exists and rules such as
`uses: ['gps']`, a power argument, or HP-based sayings that only a weak chassis reaches are avoided (`needs.sayIfHpBelow`
makes "say X when HP < n" count only when the robot's HP really fell that low). Parts that a chapter is "about" are optional
shortcuts: Chapter 1 now works with the blaster (the cannon is an extra, armor is no longer used by the dummies), Staircase is a
walled staircase that wheels climb with turns (spider legs are the `move_north()` shortcut), Growing Shots uses a nested loop
instead of `fire(i)`, Charger / Gatekeeper / Run to the Wall are won with blaster, eyes and wheels (hammer, shield, GPS lower
the damage or save code). The burst blaster (Mk II) is a different tool, not a drop-in: scripts must watch `blaster.heat()`.
Tests: `gear.test.ts` (per chapter: every reference solution wins with the default build; the same solutions still win with
the medium chassis and with each other part added; challenges are solvable with the default build; nothing is locked in the
builder), `chapters.test.ts` (optional-gear alternatives: shield, hammer, spider legs), `enemies.test.ts` (all solutions run
on the default build), `e2e/robot.spec.ts` (builder without locks, "neu" tag, Chapter 3 and 4 on the starting robot).

## Wording audit (German / English UI)

Rules: German in Du-form with the plain imperative (`Starte`, `Wähle`, `Versuche`, never `Drück`/`Klick`); short, concrete
words; no English terms in the German UI except the part names (Blaster, GPS, Mk II). One vocabulary for time, explained once
in the fight view (`robot.narr.start`): a **Schritt** (step) is one line of the script or one move in the arena; a **Runde**
(round) is what an action command such as `fire()` costs, then the arena moves. "Tick" does not appear in the UI any more
(`clock.tick()` is the Python function name and stays).

| Old term (de / en) | New term (de / en) |
|---|---|
| Tick / tick | Runde / round |
| Variante / variation | removed (one fight per challenge) |
| Trainingsgelände / Training Grounds | Training / Training |
| Übungsplatz II / Proving Grounds II | Prüfungen / Exams |
| Proving Grounds I | Übungsplatz I / Practice Field I |
| Auflage / Constraint | Sonderregel / Special rule |
| Glitch / Battle (kind labels, en) | Bug hunt / Fight |
| Burst-Blaster / Burst blaster | Salven-Blaster / Salvo blaster |
| Originalfehler / Original error | Python-Meldung / Python message |
| Was passiert / What happens (log) | Verlauf / Log |
| Protokoll | Verlauf |
| Teile / Parts (button, read as "Share!") | Ausrüstung / Equipment |
| Bereiche / Areas; "Dein Weg in vier Schritten" | Bildschirmteile / Screen parts; "Wo du gerade bist" |
| Steckplatz / Platz (mixed) | Platz |
| Code / Script (mixed, en tab) | Script (en tab and text), Skript (de) |
| Drück / Klick / Versuch (colloquial) | Starte / Wähle / Versuche |
| Der Dreh / The twist | Der Haken / The catch |
| Karteikarten / concept cards | removed |

## Dead-controls smoke test

`e2e/robot-controls.spec.ts` visits the task map, the task page before and after a lost and a won fight, the sheets (parts, help, more), challenges and the Training. It
presses every visible, enabled, uncovered button and summary and requires that the DOM, the route, a text field or the
saved game changes; otherwise the control must be disabled. Found and fixed: the replay buttons "Zeile zurück", "Eine
Runde zurück", "Von vorn" at the start and "Zum Ende" / forward at the end did nothing, now disabled.

## Remaining work

1. **Engineering** (not started, deliberately left): run battles in a **Web Worker** (`runBattle`/`fightEnemy` are pure; move
   them behind a worker with `postMessage`, keep `Frame` JSON-serialisable - `RbError` needs a plain-object form); a
   **CodeMirror 6** editor with gutter line numbers and error marks (the textarea has gutter line numbers, but no error marks). Everything fits in a few
   milliseconds on the main thread today, so neither blocks a release.
2. **Not built from the design doc**: Crate Courier and Battery Sorter (need a gripper and crates: the engine has no items);
   the other ~18 optional gear items (railgun, flamethrower, hook, EMP, mines, boomerang, ears, thermal camera, analyzer,
   hacking module, smoke, cloak, decoy, turbo, jump jets, teleporter, scout drone, repair drone) and cosmetics earned with
   stars - armor plates (`plates` in `build.ts`) is the template for a passive item, `parts.ts` for an active one;
   Throwback and bonus enemies; the trace is not shown for *enemy* scripts (only the player's); reading the enemy's
   source after beating it (tier >= 3); seeded `mirror` layouts for Chapters 3+ (the Chapter 3-4 layouts are fixed so that
   each side is tested on purpose); script history has no diff view.
3. **Chapters 5-9** (functions, lists, dictionaries, state, Arena League), Mk III upgrades and the Chapter 5+ parts
   (hover jets, repair kit, radar, missile pod, heavy chassis, directional shield, ...). The parser rejects `class` today
   (needed for Chapter 8).
4. **Tests to add with new content**: nothing new is needed for enemies/challenges (the data-driven tests pick them up);
   add golden snippets to `py/golden-snippets.ts` and run `npm run golden -w web` for every new Python feature. Rules that are
   the point of a catch deserve an explicit case in `chapters.test.ts` (see Bubble: blind shooting; Gatekeeper: waiting).
