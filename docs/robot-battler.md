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
| Robot art: registry + sockets + renderer, used by the build screen, arena, cards, Home (see *Robot art*) | `robot/art/`, `views/robot-bench.ts`, `views/robot-gallery.ts` |
| Canvas replay viewer: scrub/step/play, code line highlight, sensors, text log of every tick | `replay.ts`, `views/robot.ts` |
| **Line-by-line fights**: the interpreter emits a deterministic **trace** (`py/trace.ts`: line, call with args/result, set, branch/loop pass, enter/leave) that `runBattle({trace: true})` stores per tick in `Frame.trace` (`Frame.after` = lines after the winning action; capped at `TRACE_CAP`, off for fast checks). `stepper.ts` cuts frames into *beats* (one per executed line, one `resolve` per tick) and computes variables, call stack and per-line hints at any beat; `narration.ts` words them. The viewer (`views/robot-viewer.ts`): highlighted line with inline hints (`distance() → 3`, ✓ wahr, `x = 3`), call pills and move ghost on the arena, variable strip, call stack, "what happens now", sensors/say, play/pause, line/tick step both ways, restart, speed slider (default very slow, `SPEED_MS`), "Tick N" + "Zeile L · Schritt n von m". Paused at start; the listing lives in the Code zone, the arena in the Fight zone | `py/trace.ts`, `stepper.ts`, `narration.ts`, `views/robot-viewer.ts`, `replay.ts` |
| **Variation queue**: after Run the first fight plays; then all other layouts of the enemy and every layout of the earlier chapter enemies (`RobotGame.variationQueue`, `variations.ts`) play one after another (auto-advance, can be switched off), chips show progress/result, Skip / Skip all / Next, and a summary lists won/lost with the reason (script error line, budget, destroyed, timeout, unmet rule) and a "Watch" button per fight | `variations.ts`, `views/robot.ts` (`variationQueue`) |
| **62 battles**: Chapter 0 (9, incl. Backstep Dummy), 1 (9), 2 (10, incl. Growing Shots), Proving Grounds I (6), **Chapter 3 (10)**, **Chapter 4 (9)**, **Proving Grounds II (8 fights + boss Final Exam)**; three layouts each | `content/chapter0.ts` ... `chapter4.ts`, `proving1.ts`, `proving2.ts` |
| Build/code/battle/improve loop; "never a blank file" persistence; regression re-test of earlier enemies of the chapter on every run; stars; script history with restore; points/XP via the existing points system (`game: 'robot'`); **Basics Certificate** banner after the Final Exam | `game.ts`, `fight.ts` |
| **Challenges** (the player always writes or edits code; Line Up and Predict were removed, as were hints): 9 Glitch (fix the buggy script by editing it), 7 Workshop (paint brush, blank editor), 5 Constraint (line limits, `without`, no repeated number) | `content/challenges.ts`, `challenges.ts` |
| **Training Grounds** (from Chapter 2): endless seeded fights built from the frame of the latest chapter, plus a daily fight (seed from the date); every generated fight has a winning script and is tested for 60 seeds | `training.ts`, `RobotGame.trainingStep/runTraining` |
| Tests: 500+ robot unit tests (incl. `trace.test.ts`, `stepper.test.ts`, `variations.test.ts`) (every enemy is won by its solution, regression-safe, and not won by the previous solution; chapter-specific rule tests in `chapters.test.ts`), Playwright `e2e/robot.spec.ts` (zones, loop, builder, Workshop challenge, Chapter 3, Chapter 4 to the certificate, Training Grounds, stepping view on phone and desktop, call stack, variation queue and summary) | |

Deviations from the doc, on purpose: chassis HP is 8/12 (the table), not "10 default"; battles run on the main thread (they
are tiny: the engine is pure and worker-ready, see Remaining work); the editor is a `<textarea>` (no CodeMirror
dependency); `wait()` costs one tick ("free" in the doc means "needs no part"); `distance()` returns 0 when nothing is in
range; a win ends the battle at once, but free statements right after the winning action (e.g. `say("done")`) still run.
Chapter 3 uses a 9x8 arena (robot at (4, 6)) so left and right are symmetric; its final build is blaster + eyes + shield
(the medium chassis has three slots), so the hammer is an alternative for the Charger, not a requirement. Chapter 3-4
extras are side missions (`regression: false`) with their own set-up, like the Chapter 2 extras. Proving Grounds II mixes
Chapter 3 and 4 fights (their frames are the only ones one script can win together); `id#n` in `mix` picks layout n.

### Screen layout (information architecture)

The battle screen (`views/robot.ts` `showBattle`, shell in `views/robot-work.ts`, styles in `robot-work.css`, texts `robot/messages-work.ts`)
has **four zones**, each with a plain title and a one-line purpose, plus a **step indicator** (`Bauen / Skript / Kampf / Verbessern`,
en `Build / Code / Fight / Improve`, `aria-current="step"`, set from where the player is: robot zone = Build, code = Code, a fight = Fight,
code again after a lost fight = Improve):

| Zone | Contains | Sticky action |
| --- | --- | --- |
| **Task** (`zone-task`) | enemy pictures and the catch | "On to the script" |
| **Robot** (`zone-robot`) | the robot picture with tappable sockets + inspector, drawer *All parts* (chassis / drive / gear lists) | "On to the script" |
| **Code** (`zone-code`) | the editor, or the highlighted line-by-line listing during a fight (button *Edit script* / *Show the run*), the error box; drawers *Commands* (API of the equipped parts) and *Versions* | **Start fight** (`robot-run`) |
| **Fight** (`zone-fight`) | result banner (+ stars, *Next* or *Improve script*), queue bar (progress, state, Skip / Next fight), arena, tick counter, "what happens now"; drawers *Fights* (picker, auto-advance, summary with won/lost rows) and *More* (speed, scrub slider, variables, call stack, sensors, log) | Play + line / tick stepping (viewer controls) |

* **Desktop (>= 960 px)**: Task over Robot on the left, Code in the middle, Fight on the right; the page never scrolls, only a zone body
  can (the Robot zone by ~30 px at 1280x800).
* **Phone / tablet portrait**: one zone fills the screen, a bottom tab bar (`zone-tab-*`, 46 px) switches; switching moves focus to the zone
  heading, Run moves to Fight, "Improve script" back to Code. A step starts on Task (on Code if it is already solved).
* Drawers (`work.drawer`) replace the body of their zone, keep the sticky actions, close with the button or Esc and give focus back to
  the opener. The robot screen re-renders only the Robot zone and the commands drawer on a build change (the fight is kept).
* The queue renders into the zones through a `Mount` (arena, controls, more, listing); the viewer (`robot-viewer.ts`) returns those
  parts separately (`el` = arena + narration, `controls`, `more`, `listing`).
* **No hints.** There are no hint buttons, panels or hint data: the player works from the task card (the catch) alone.
* Challenges (glitch, workshop, constraint - all of them need typed code) use one full-height zone: content scrolls, the check button and
  "to the tasks" stay at the bottom; the commands are a closed `<details>`.
* Task map: only playable tasks are listed; finished tasks and locked tasks fold into "N done" / "N still locked".

Naming: Task, Robot, Code/Script, Fight (Aufgabe, Roboter, Skript, Kampf) on every screen; primary buttons: *Start fight*, *Play*, *Next: ...*,
*Improve script*. Page height beyond the viewport, before -> after (360x740 phone / 1280x800 desktop, de): task map 1257 -> 37 / 947 -> 0; level
636 -> 0 / 418 -> 0; code 1810 -> 0 / 1550 -> 0; running fight 3557 -> 0 (fight zone body scrolls 100) / 2787 -> 0 (0); queue summary
4423 -> 0 (drawer 512) / 3390 -> 0 (drawer 124); workshop challenge 1514 -> 0 / 1259 -> 0. Shots: scratchpad `shots2/before-*`, `after-*`, `cur-*`.
Not changed: the Home screen (shared by all games, 1858 px on a phone). Tests: `e2e/robot.spec.ts` (helpers `zone`, `fillCode`, `runFight`,
`openDrawer`, `closeDrawer` in `e2e/helpers.ts`; desktop no-scroll test, phone zone navigation / focus / 44 px / small fight scroll test).
Still open: no keyboard shortcut for stepping; the `<textarea>` has no line numbers; arrow keys do not move between the bottom tabs.

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
  `onPoints({type:'level', game:'robot', id, clean})`. Parts unlock by chapter (`UNLOCK_CHAPTER` in `build.ts`, level =
  chapter of the first unsolved main battle).
* **PWA/offline** – nothing is fetched; all content is bundled in the main chunk and precached like the rest.

## Data format: adding content

An enemy is a plain object (`content/types.ts` → `EnemyData`) appended to `ENEMIES` in `content/index.ts` (order = play order):

```ts
{
  id: 'peekaboo', title: T('Guck-guck', 'Peekaboo'), catchLine: T('…', '…'), // catchLine = the task card
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
Chapter text: add `robot.chapter.N` in `messages-ui.ts`; `unlockLevel()` in `game.ts` maps chapter 25 (Proving Grounds I) to 2 and 45 (Proving Grounds II) to 4.
`needs` rules: `maxDamage` (HP lost per layout), `noWaste` (no shot into a raised shield), `uses` / `without` (words in the code, comments and strings ignored; `"while True"` and `"fire(i)"` work), `noRepeatedNumber`. A mixed Proving Grounds fight lists `mix: ['peekaboo#2', 'bubble']` (first layout, or the n-th with `#n`) and no maps of its own.
A challenge (`content/challenges.ts`) sits `after` an enemy id and has `kind` glitch | workshop | constraint (every kind needs code typed by the player; no multiple choice, ordering or predict-the-output steps);
logic and checks are in `challenges.ts`.
Every new step also needs nothing else: `RobotGame` builds its step list from the two data files, and Home/points/profile
pick the new total up automatically.

## Wording audit (German / English UI)

Rules: German in Du-form with the plain imperative (`Starte`, `Wähle`, `Versuche`, never `Drück`/`Klick`); short, concrete
words; no English terms in the German UI except the part names (Blaster, GPS, Mk II). One vocabulary for time, explained once
in the fight view (`robot.narr.start`): a **Schritt** (step) is one line of the script or one move in the arena; a **Runde**
(round) is what an action command such as `fire()` costs, then the arena moves. "Tick" does not appear in the UI any more
(`clock.tick()` is the Python function name and stays).

| Old term (de / en) | New term (de / en) |
|---|---|
| Tick / tick | Runde / round |
| Variante / variation | Spielfeld / map |
| Trainingsgelände / Training Grounds | Training / Training |
| Übungsplatz II / Proving Grounds II | Prüfungen / Exams |
| Proving Grounds I | Übungsplatz I / Practice Field I |
| Auflage / Constraint | Sonderregel / Special rule |
| Glitch / Battle (kind labels, en) | Bug hunt / Fight |
| Burst-Blaster / Burst blaster | Salven-Blaster / Salvo blaster |
| Originalfehler / Original error | Python-Meldung / Python message |
| Was passiert / What happens (log) | Verlauf / Log |
| Protokoll | Verlauf |
| Mehr / More (details drawer) | Details / Details |
| Bereiche / Areas; "Dein Weg in vier Schritten" | Bildschirmteile / Screen parts; "Wo du gerade bist" |
| Steckplatz / Platz (mixed) | Platz |
| Code / Script (mixed, en tab) | Script (en tab and text), Skript (de) |
| Drück / Klick / Versuch (colloquial) | Starte / Wähle / Versuche |
| Der Dreh / The twist | Der Haken / The catch |
| Karteikarten / concept cards | removed |

## Dead-controls smoke test

`e2e/robot-controls.spec.ts` visits the task map, the work screen in every zone (phone: tab by tab) after a lost and a won fight, the drawers (parts, commands, versions, fights, details), challenges and the Training. It
presses every visible, enabled, uncovered button and summary and requires that the DOM, the route, a text field or the
saved game changes; otherwise the control must be disabled. Found and fixed: the replay buttons "Zeile zurück", "Eine
Runde zurück", "Von vorn" at the start and "Zum Ende" / forward at the end did nothing, now disabled.

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
   the point of a catch deserve an explicit case in `chapters.test.ts` (see Bubble: blind shooting; Gatekeeper: waiting).
