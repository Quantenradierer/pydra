# Pydra: requirements

The agreed product and engineering requirements for Pydra. Change this file
when a requirement changes; the code, tests and the other docs follow it.

## Product

- **Name:** Pydra (Py + Hydra). Full title "Pydra: Python Trainer", short name "Pydra".
- **URL:** https://pydra.quantenradierer.de/, served at the root (`/`).
- **Repository and image:** GitHub `Quantenradierer/pydra`, image `ghcr.io/quantenradierer/pydra`.
- **Audience:** absolute Python beginners.
- **Form:** an installable PWA that works fully offline, in German (default) and English.

## Lessons

Home offers the daily challenge, three lessons and four games. The three lessons use the same quiz screen, answer feedback,
explanations, hydra, resume and stats rules (below); they differ in which
questions a session asks.

| Lesson    | Name (de / en)                     | A session                                                               |
| --------- | ---------------------------------- | ----------------------------------------------------------------------- |
| `mixed`   | Quiz / Quiz                        | 10 random questions from the 80 (see Quiz session)                      |
| `functions` | Funktionen lesen / Reading functions | one function read line by line: one question per line, in order, then one about the whole function |
| `diff`    | Finde den Unterschied / Spot the difference | 10 random questions from the 71 "spot the difference" questions (see below) |
| game      | Hydra auf Fischfang / Hydra goes fishing | the hydra game: its own screen and progress (see below) |
| hunt      | Hydra-Jagd / Hydra hunt            | the warrior game: same screen, its own world, levels and progress (see below) |
| order     | Code-Puzzle / Code puzzle          | the warrior's world, but the lines of the program are to be put in order (see below) |
| predict   | Was sagt die Hydra? / What does the hydra say? | read a short program and type what it prints (see below) |

### Daily challenge (`daily`, "Tages-Challenge")

(Not to be confused with the daily *tasks* of the points system.)

- One short program a day, the same for everyone on that local date, and five
  multiple-choice questions that follow the code as it changes, easy to hard:
  1. **Trace:** only the first 3 lines are shown; "what value does `x` have after them?"
  2. **Extend:** the whole program, the new lines marked (green bar and `+`); "what does it print?"
  3. **What if:** one line changed (marked); what does it print now?
  4. **Difference:** version A (the program) and B (one change), side by side like Spot the difference; what does B do differently?
  5. **New requirement:** a requirement in words; which replacement of the marked line(s) fulfils it? The choices are code.
- Every step is an ordinary 4-choice question with a de + en explanation, shown with the quiz screen
  (feedback, explanation, hydra with 5 heads, keys 1-4). A wrong answer does not end the challenge.
  The button on the question screen reads "Pause" and keeps the run.
- **Pick of the day:** `dailyIndex(day, pool)` (`web/src/daily/select.ts`, pure, tested), the same for everyone on a
  local date. A gentle start in two parts:
  - **Intro week:** 7 extra snippets `intro-01`..`intro-07` (`level` 0, `content/daily/intro.json`) are played one per
    day from `INTRO_START = '2026-11-06'` (2026-11-06..2026-11-12), in this order: variables and assignment,
    `+ - *`, text with `+` and `len`, `if`/`else` with one comparison, `for ... in range(3)`, a small list
    (index, `append`, `len`), a function with one parameter and `return`. 4-7 lines, ONE idea each, numbers up to
    15, no f-strings, slicing, `while`, `import`, `elif`, `and`/`or`/`not` (tested); easy questions, short
    explanations, a one-line change in step 5. They are NOT part of the regular cycle, so a returning player never
    gets an "x = 1" day again.
  - **Regular cycle** (levels 1-3, 45 snippets) from 2026-11-13 on: played in cycles of the pool size, each cycle in
    another fixed seeded shuffle **inside a level**, easy to hard: first all level 1, then 2, then 3 (21 / 16 / 8).
    Nothing repeats before the pool is used up and two days in a row (also across the intro week and a cycle border)
    never share a topic. A new player who joins later simply gets today's snippet of the global cycle (so at worst a
    level 3 day in the last quarter of a cycle); the same date gives the same snippet on every device. Dates before
    the launch date use the cycles backwards (no topic guarantee across their borders).
  - Levels: 1 = one idea, 2 = typical, 3 = harder (slicing + f-strings, `break`, `dict.get` counting, set
    operations, `pop`/`insert`, functions that print instead of returning, `elif` chains with indented updates).
    Level 3: strings-05, loops-04, loops-05, collections-05, dicts-sets-03, dicts-sets-04, functions-04,
    control-flow-04.
- **Content:** 45 regular snippets in `web/src/content/daily/<topic>.json` (types 4, operators 5, strings 6,
  control-flow 6, loops 7, collections 6, dicts-sets 6, functions 5), ids `<topic>-NN`, each with `level` 1-3, 5-9
  lines, all lines at most 40 characters, plus the 7 intro snippets (4-7 lines). A snippet holds the program (`code`), `variant` (step 3), `altered` (step 4), the replaced
  `requirement` lines and the five steps; the programs shown are derived from them, so step 1 is always the first 3
  lines of step 2. Every value, output and every requirement choice was verified by running the code with
  `python3` (the right choice meets all checks, each wrong one fails at least one). Wrong choices are typical
  beginner mistakes; the right choice is not systematically the longest (tested).
- **One attempt a day** counts: the result (5 booleans) is locked after the last answer and shown on Home
  ("Noch nicht gespielt" / "Läuft: 3/5" / "Heute geschafft: 4/5") and on the end screen: score x/5, the hydra, the
  challenge streak and a share line `Pydra Daily 2026-11-07 🐉🐉🐲🐉🐲 4/5` (🐉 right, 🐲 wrong) with a "Copy"
  button (clipboard API, fallback `execCommand`) and a status message. Afterwards the player may replay the day for
  practice: no XP, no change to the locked result (the last practice score is shown).
- **Resume:** the run is saved after every answer and reopened on launch like a quiz; a run of an earlier day is
  dropped. An app update waits while the challenge screen is open.
- **Points:** see "Points, levels and achievements". The challenge pays no `q:` XP and does not count towards the
  daily *tasks* (they are about the quiz and the games).

### Spot the difference (`diff`)

- Every question shows two short Python snippets: version A (the original)
  and version B (the same code with one small change), each 1-5 lines. The
  prompt asks what B does differently; four choices (shuffled), one right,
  wrong ones are typical beginner misconceptions. Quiz screen, feedback,
  explanations, hydra heads, 10-question sessions, resume, stats and points
  are those of the quiz; only the question pool differs.
- The snippets are labelled "Version A (Original)" / "Version B (geändert)"
  and sit side by side where there is room and stacked on phones (360 px).
  They are highlighted like quiz code blocks; the lines that differ between
  A and B are tinted with a yellow bar (the labels name the versions, so
  colour is not the only signal).
- Content: 71 questions in the same 8 topics, in
  `web/src/content/diff/<topic>.json`, ids `diff-<topic>-NN` (unique across
  all questions, so XP is paid once per question). Same shape as a question
  plus `codeB` (`code` is version A). Every claimed output was checked by
  running both snippets with `python3`.
- The header shows the topic. Counters in `counters.diff`.

### Reading functions (walkthroughs)

- 3–5 short beginner functions of 4–8 lines each, without blank lines.
- For every line, in order: "Was macht die markierte Zeile N?" / "What does
  the highlighted line N do?". The function is shown in full with line
  numbers; the line asked about is marked (tinted, with a yellow bar and bold
  text) and named in the prompt, so colour is not the only signal.
- Last: "Was macht die ganze Funktion?" / "What does the whole function do?",
  with no line marked.
- Each step is a normal multiple-choice question: 4 choices (shuffled),
  one correct, an explanation in the same style as the question bank.
- A session plays one function; the hydra has one head per step. The
  function is picked among those played to the end least often, at random
  among ties, so every function comes up once before any repeats. "Play
  again" starts the next one.
- The quiz header shows the lesson name instead of the topic.
- Data: one JSON file per function in
  `web/src/content/walkthroughs/<id>.json` (`id`, `code`, `lines` with one
  step per line incl. its 1-based `line`, `whole`). The prompts and the
  question ids (`walk-<id>-NN`, `walk-<id>-whole`) are generated.

### Hydra goes fishing (the game)

- A program with one gap `___` and four answers (shuffled once per level
  start). Picking one fills the gap and runs the program: a young hydra
  swims through a small grid pool (at most 7×7 cells) with rocks and fish,
  seen from above, and eats a fish by swimming onto it. Its body grows by
  one cell per fish. The level is solved when the program ends with every
  fish eaten.
- The run plays like a debugger: the line about to run is marked (as in
  walkthroughs), the variables in scope are listed below the code, and the
  position reads "Schritt 3 von 12 · Zeile 4" / "Step 3 of 12 · line 4". It
  plays automatically at the speed set in Settings (slow 1.2 s, normal 0.7 s, fast 0.35 s per step; slow by default); the hydra's head and every body segment glide to the next cell together, never body first; "Von vorn" / "Restart", "Abspielen"
  / "Play" and "Pause", "Schritt" / "Step" and "Zum Ende" / "To the end"
  control it. Keys 1–4 pick an answer.
- A wrong answer really runs and the hydra misbehaves: it swims into a wall
  (with a red bump), circles, stops short, or Python stops with an error.
  When the run ends, the outcome is stated in text (e.g. "Autsch! In Zeile
  4 schwimmt die Hydra gegen die Wand."), followed by a note on why that
  answer went wrong, and "Probier eine andere Antwort." The answer is marked
  ✗.
- Every answer can be picked at any time, also while another run plays, after
  the level is solved, and again after it was tried: picking re-runs the
  program with that answer, so players can compare how the answers behave.
  Replays never change the score: a tried wrong answer picked again counts
  nothing; once a level is solved (now or earlier), picks count neither as
  picks nor as mistakes, can never un-solve it, and wrong answers just get
  their ✗; the right one shows ✓ from then on, and "Nächstes Level" stays
  available.
- The right answer is never revealed before it is picked: no mark, note or
  run shows it, however many wrong answers come first. While a run plays,
  an answer whose outcome the player has not seen yet shows no verdict until
  its run ends (already seen answers keep their mark).
- Every wrong answer of a level behaves visibly differently (path, fish
  eaten or outcome); a unit test checks this for every level.
- The right answer shows ✓, "Satt! Die Hydra hat alle Fische gefressen.",
  the explanation and "Nächstes Level" / "Next level" (on the last level:
  a closing line and a way home).
- 19 levels in this order, one concept each, getting harder: sequence,
  `for` with `range`, the loop body, `while`, `if`, variables, functions
  with a parameter, return values, nested loops, strings with
  `if`/`elif`/`else`, `for` over a list, list indexes, adding up with `+=`,
  `range` with a step, leaving a loop (`break` vs `continue`), `and`/`or`,
  functions calling functions, default values, and `while` with a counter
  and `len` through a list. Every program also runs the same way in real
  Python (checked for every answer when levels change). A strip of level buttons on the game screen (always one line, scrolling
  sideways with the current level in view) opens every solved level and the
  first unsolved one; a solved level replays from
  scratch. The level title is a small pill on the arena's corner; tapping it
  drops down the intro and the list of the hydra's commands.
- Layout: the game screen fills the visible viewport (`dvh`, safe-area
  insets) and never scrolls, on phones (360×640 up to 412×915) and desktop:
  a slim bar (back button + one-line level strip), the arena as large as
  fits (up to 40 % of the height, full width), one row with the step text
  and four icon buttons (restart, play/pause, step, to the end; the words
  are their labels), the code (readable, the running line kept in view),
  a one-line variables list, the answers in a 2×2 grid and one slot below
  them that shows the task first, then verdict, explanation and "next"
  (scrolls inside itself if long).
- The programs run in a small interpreter for a Python subset
  (`web/src/game/python.ts`: ints, bools, arithmetic, comparisons,
  `not`/`and`/`or`, assignment, `+=`/`-=`, `if`/`elif`/`else`, `while`,
  `for … in range(…)`, `def`, `return`, `pass`); anything else is a syntax
  error. World commands: `move()`, `turn_left()`, `turn_right()`,
  `wall_ahead()`, `fish_ahead()`. The trace of every answer is computed from
  its code; a run that reaches exactly the same state twice (or 300 steps)
  ends as an endless loop. Every answer's outcome was checked against real
  Python running the same world.
- On phones (< 700 px wide) the arena, run controls, a small scrolling code
  view and the variables stay pinned at the top while the answers (a 2×2
  grid) scroll beneath, so a run can be watched without scrolling; a pick
  scrolls the arena into view if needed. Checked at 360×640.
- Progress (`game` in storage): levels solved, picks and right picks, and the
  level in progress with its answer order and the wrong answers tried. It
  is saved after every pick; opening the game continues that level, also
  after a reload. An app update waits while the game screen is open.

### Hydra hunt (the second game)

- The same screen, rules for answers, progress and layout as Hydra goes
  fishing (one gap, four answers that really run step by step, level
  strip, speed); only the world, the picture and the levels differ.
  Progress is saved as `hunt`; Reset progress wipes it too.
- The player guides a warrior on a grass grid with rocks, gold and
  hydras. A hydra is a snake: a head and a body a few cells long. Commands:
  `move_north()`, `move_east()`, `move_south()`, `move_west()` (one cell),
  `attack()` and `body_here()`.
- Rules: the warrior may walk on a hydra's body; `attack()` there slays the
  hydra with one blow. Stepping onto the head of a living hydra gets him
  eaten (a slain hydra's head is harmless). `attack()` where there is no
  living body strikes the air and ends the run. Walking onto gold picks it
  up. Walking into a rock or off the map ends the run. A level is solved
  when the program ends with every hydra slain and all gold taken.
- 11 levels for beginners: commands one after another, minding the head
  (and gold), `for` with `range`, two lines in a loop body, a function, a
  parameter, `while not body_here()`, `if body_here()`, nested loops, a
  list of numbers, a growing variable. Every answer's outcome was checked
  against real Python running the same world.

### Code puzzle (the third game)

- The world, picture, commands and rules of Hydra hunt, but no gap and no
  answers: every line of the program is there, shown in a shuffled order
  that does not solve the level. Each line has ▲/▼ buttons (labelled
  "Move line N up/down"); a line keeps its indentation when it moves.
  "Run" runs the program as arranged, step by step with the same run
  controls; moving a line ends the run shown. Any order that slays every
  hydra and takes all the gold solves the level (not only the one in the
  data).
- After a failed run the outcome and a hint (which never gives the order
  away); after a win a short explanation and "Next level".
- Misplaced indentation fails like in Python, with its exact
  `IndentationError` messages (unexpected indent, expected an indented
  block after …, unindent does not match …).
- 8 levels: order of commands, minding the head, round a corner, what
  goes in a loop, order inside a loop, define before calling, `while not
  body_here()`, and `if` in a loop. Both the shown order and the right one
  were checked against real Python.
- Progress (`order` in storage): levels solved, runs and winning runs, and
  the current level with its arrangement (kept across reloads). Home shows
  e.g. "1 of 8 levels solved · 5 runs". Reset progress wipes it.

### What does the hydra say? (the fourth game)

- A short program (at most 6 lines) that prints 1 to 4 lines. The quiz
  hydra has one head per printed line, numbered from left to right; the
  player types each line into a numbered "Output" box and presses "Check"
  (Enter moves to the next box, and checks in the last one). Empty boxes
  are not checked.
- A check runs the program step by step with the same run controls,
  highlighted line, variables and speed as the other games. Each time it
  prints, the head of that line falls (right) or grows back (wrong) and
  its box turns green or red. A line is right when it is exactly what
  Python prints; only spaces around it are ignored.
- After a miss: how many lines are right, a word on near misses (the text
  in quotes, other upper/lower case, other spaces), the level's hint and a
  nudge to step through the run. The right output is never shown, except
  that after two wrong checks of a level a "Show the output" button
  reveals it; it still has to be typed to solve the level. After a win a
  short explanation and "Next level". Changing a line ends the run shown.
- 16 levels, one concept each: print shows text, calculations, text vs.
  calculation, `True`/`False`, a changing variable, a value worked out
  once, `//` `%` and precedence, `+` on texts, several values in one
  print, `if`/`else`, `range`, print after a loop, print inside a loop,
  a `while` countdown, `len` and indexing, a function that returns.
  Every output is checked against the interpreter and was verified with
  real `python3`.
- Progress (`predict` in storage): levels solved, checks and right checks
  of unsolved levels (practice on a solved level counts nothing), and the
  current level with the typed lines and its misses, kept across reloads.
  Home shows e.g. "1 of 16 levels solved · 50% correct". Reset progress
  wipes it.

## Content

- 80 multiple-choice questions, 10 per topic, in 8 topics:

  | Topic          | Covers                                                  |
  | -------------- | ------------------------------------------------------- |
  | `types`        | variables and basic types: int, float, str, bool, type() |
  | `operators`    | arithmetic, `//`, `%`, `**`, precedence, `==` vs `is`   |
  | `strings`      | indexing, slicing, f-strings, methods                   |
  | `control-flow` | if/elif/else, truthiness                                |
  | `loops`        | for, while, range, break/continue                       |
  | `collections`  | lists and tuples: indexing, slicing, mutability, append |
  | `dicts-sets`   | dicts and sets: key access, `.get`, membership          |
  | `functions`    | def, return, arguments, default values                  |

- Every question has exactly 4 choices, exactly one correct answer, an
  explanation and an optional code snippet.
- Beginner level and factually correct: every "what does this print?" answer
  is verified by running it with `python3`.
- No "all of the above" or "none of the above".
- Code snippets are language-neutral (the same for de and en, English identifiers).
- Prompt, choices and explanation exist in `de` and `en`. German is natural
  and uses the du-form. Choices that are code or values may use the same
  string in both languages.
- Explanations are detailed but explain-like-I'm-five: they walk through the
  code, name the underlying rule in plain words, define every technical term
  and use an everyday analogy where it helps. Inline code is written in
  backticks and shown as code; a blank line separates up to two paragraphs.
- Data: one JSON file per topic in `web/src/content/questions/<topic>.json`,
  loaded and typed by one module. Question shape:

  ```ts
  {
    id: string;              // e.g. "strings-03", stable and unique
    topic: Topic;
    prompt: { de: string; en: string };
    code?: string;
    codeB?: string;          // spot the difference only: version B (`code` is A)
    choices: { de: string; en: string }[]; // length 4
    answerIndex: 0 | 1 | 2 | 3;
    explanation: { de: string; en: string };
  }
  ```

## Quiz session

This section describes the `mixed` lesson; the `functions` lesson differs
only as described under Lessons (number and order of questions, header text).

- A session has 10 questions picked uniformly at random from the 80, with no
  repeats within a session.
- The choices of each question are shuffled (the answer index is remapped).
- After a choice is tapped:
  - the choices lock;
  - the correct choice turns green and a wrong pick red, and each carries a
    ✓/✗ icon (colour is never the only signal);
  - a microcopy line and the explanation appear;
  - focus moves to the feedback region;
  - a "Next" button appears ("Finish" on question 10).
- No auto-advance.
- Keyboard: keys 1–4 pick a choice, Enter or Space activate Next.
- Header: the quiz hydra and a "Quit" button; below it, progress (e.g. 3/10)
  and the topic. Quit asks no confirmation: it discards the session and
  returns home. Stats of questions already answered are kept.
- The quiz hydra has one head per question, rising from a swamp on a dark
  panel. It is decorative (`aria-hidden`); progress and answers are announced
  as text.
  - The current question's head glows and sways; upcoming heads are dimmed.
  - A right answer slashes the head off: it falls into the swamp and leaves a
    stump with a yellow wound for the rest of the session.
  - A wrong answer regrows the head: it is slashed, falls, and a yellow head
    grows back from the stump.
  - Head states are derived from the saved session, so a resumed session shows
    the same stumps and regrown heads without replaying an animation.
  - The animations (under a second) play with the answer feedback and never
    block Next, the keys or Quit. With `prefers-reduced-motion: reduce` the
    heads change state without motion.
  - It fits the header row, so the quiz needs no more height than without it.
- Resume: the session is saved to localStorage after every answer, including
  whether the feedback is showing, and resumed automatically on launch without
  a prompt, on the same screen. A saved session that references an unknown
  question id, or fails validation, is silently discarded and Home is shown.
  The session records its lesson; a walkthrough session must match one
  function's steps exactly, in order. Sessions saved before lessons existed
  count as `mixed`.

### Microcopy

| Moment           | English                | German                   |
| ---------------- | ---------------------- | ------------------------ |
| Correct answer   | Head of the class!     | Köpfchen!                |
| Wrong answer     | Head-scratcher, huh?   | Kopf hoch!               |
| Summary headline | 7 of 10 heads slain    | 7 von 10 Köpfen erlegt   |

The summary number is the score. The summary shows the hydra with `score`
heads slashed (spread evenly) and the rest regrown, a "Play again" button and
a way home.

## Screens

- **Home:** title and hydra logo (its necks sway gently), one button per
  lesson (name and one-line description) with its stats line below, in the
  active language, a gear icon to Settings and a speech-bubble icon to
  Feedback.
  - Quiz: e.g. "12 sessions · best 9/10 · 74% correct"; a friendly line when
    no session has been played yet.
  - Spot the difference: like the quiz (e.g. "1 session · best 9/10 · 90% correct").
  - Reading functions: e.g. "2 of 4 functions read · 80% correct"; "No
    function read yet." before the first answer.
  - Hydra goes fishing and Hydra hunt: e.g. "3 of 19 levels solved · 60%
    correct" (share of right picks); "No level played yet." before the
    first pick.
- **Daily challenge card:** the first card of Home, above Lessons, with its state line (`start-daily`, `stats-daily`).
- **Quiz:** as above.
- **Daily challenge:** the quiz screen with the code of the step; after the last answer the result screen (see above).
- **Game:** as above, with a back button to Home (pushed onto the history
  like Settings).
- **Summary:** as above.
- **Settings:**
  - DE/EN toggle;
  - hydra game speed: slow (default) / normal / fast, saved as `gameSpeed`
    and kept by Reset progress;
  - "Reset progress" with a confirm dialog: wipes stats, counters, any
    saved session and both games' progress, keeps the language;
  - "Install app" button, shown only when the browser fires
    `beforeinstallprompt`, hidden after install or when unavailable (so never
    on iOS).
- **Feedback:** see below.

## Language

- German by default, always; the browser locale is not detected.
- The choice is stored in localStorage and `<html lang>` is updated.
- All UI strings live in one small typed i18n table (de and en), no library.

## Storage

localStorage only, in one versioned namespace (`pydra.v1.`), parsed
defensively: corrupt or foreign data is ignored and never throws.

- language;
- the in-progress session;
- lifetime counters per lesson: sessions played, best score, total answers,
  total correct (`counters` for the quiz, `counters.functions` for reading
  functions, `counters.diff` for spot the difference);
- the games' progress (`game`, `hunt` and `order`, see the games above);
- the daily challenge (`daily`: the run in progress `{day, snippet, practice, items, index}`, the locked `result` and the last `practice` round, each `{day, snippet, right[5]}`), parsed defensively; Reset progress wipes it;
- the last result (lesson, score, total) for the summary;
- per-question stats `{ seen, correct, lastSeen }` keyed by question id
  (collected now, not yet used to pick questions);
- the points (`points`, see below) and the player name (`playerName`, a setting that Reset progress keeps);
- the feedback queue.

## Points, levels and achievements

All on the device (localStorage key `points`, name in `playerName`); no accounts,
nothing is sent. Code: `web/src/points/`.

- **XP.** A question answered right pays 10 XP the first time (never again, also
  not after a wrong try first); a level solved the first time pays 20 XP, 30 if
  no wrong pick or check came before (the code puzzle always pays 20); a quiz
  round with every answer right pays 25 XP, once a day. Replays pay nothing,
  like they never change a game's score. Everything but daily tasks is
  multiplied by the streak bonus: +10 % per day in a row, at most +70 %.
- **Daily challenge.** Finishing it pays 50 XP plus 10 per step answered right (so 50-100), once per local day
  (id `d:<day>`, replays and practice pay nothing), with the streak bonus. It counts as activity for the streak.
  A separate challenge streak counts consecutive days finished (`challenge`, `bestChallenge`, `challenges` in the points).
- **Streak.** A day counts when a question was answered right or a level solved (or the daily challenge finished).
  It is broken when neither today nor yesterday counts.
- **Player level.** Level n starts at `round(180 * (n - 1)^1.5)` XP (level 2:
  180, level 10: 4860, level 25: 21,164, level 50: 61,740). Levels 1-50 each carry
  their own title (Hydra-Ei … Ewige Hydra); higher levels keep the last one. The
  curve is tuned for a player who answers 10 questions right every day without
  breaking the streak: 10 × 10 XP × the streak bonus (+10 % a day up to +70 %) is
  110 XP on day 1, 170 XP from day 7 on, 4890 XP after 30 days (level 10) and
  61,840 XP after 365 days (level 50, the last title). Each title takes a few days
  early on and about 11 days near the end. Only the first right answer of a
  question pays, so a year of daily XP in this amount comes from the daily
  challenge (up to 100 XP, plus the bonus) and the daily tasks, not from
  answering the same questions again.
- **Daily tasks.** Up to three per local day, made on the first activity or
  visit of the day and the same all day: right quiz answers, levels solved in
  any game, levels solved in one game (only games with unsolved levels, and
  only if at least two have). Targets follow the median of the days played in
  the last 7 days (+20 %, but +0 % when under 60 % of the answers were right),
  within 3-20 answers and 1-6 levels; new players get 5 and 2. Each task done
  pays 50 XP.
- **Achievements.** 24, in bronze, silver and gold (gold = rare): answers,
  levels, streak, perfect rounds, daily tasks, the daily challenge (first one, 7 days in a row [gold], 30 finished [gold]), player level (10 and 50 [gold]), and every level of
  one game. The profile shows the earned ones with their date; the rarest earned
  title appears under the level.
- **Profile** (`#/profile`, from the chip on Home): name (1-20 characters,
  optional, shown on Home and in the greeting), level and XP bar, streak, today's
  tasks, achievements.
- **Toast.** A short note (`aria-live="polite"`, no focus change) after an event
  that paid XP or unlocked something: XP, level up, task done, achievement.
- **Existing players.** On the first start with points, the questions answered
  right and levels solved so far are credited (no streak, no toast).
- **Reset progress** deletes the points; the name stays.

## Look and accessibility

- Mobile first, one column, centred with a maximum width of about 640px on
  desktop, large tap targets.
- Light and dark themes from `prefers-color-scheme` (CSS variables), no manual toggle.
- Real `<button>` elements, visible focus, an aria-live feedback region,
  sufficient contrast.
- Code snippets in `<pre><code>`, highlighted with highlight.js core and only
  the Python language, readable in both colour schemes. No Monaco, no Pyodide.

## Icon

- A flat five-headed hydra in Python blue `#3776AB` and yellow `#FFD43B` on a
  dark rounded square: serpent necks in S-curves, alternately blue and
  yellow, rising from one body with a curled tail and yellow belly plates;
  dragon heads with a horn, an open jaw and slit-pupil eyes.
- SVG source plus generated PNGs: 192, 512, maskable 512 (content inside the
  80% safe zone), apple-touch-icon and favicon. A script renders them; the
  outputs are committed. The same hydra is the logo on Home, inlined from the
  SVG source; the quiz hydra reuses its head shape.

## Feedback

- Text only. The speech-bubble button on Home opens the Feedback screen:
  textarea, live character counter (max 2000, counted in code points), Send
  button, result message (sent / rejected / rate-limited / queued) and the
  number of pending entries.
- If sending fails because of the network or a server error, the text is
  queued in localStorage and sent in order when the connection returns (on
  the `online` event, at app start and after a successful send).
  - Flushing stops at the first network failure.
  - Entries the server rejects permanently (4xx other than rate limiting) are
    dropped.
  - Rate-limited entries are kept.

## Server API

Hono on Node 24 with `node:sqlite`. API types and validation live in
`shared/src/api/`.

- `POST /api/feedback`:
  - anonymous, body `{ text }`;
  - text trimmed, 1–2000 code points;
  - 5 posts per minute per client IP (taken from `X-Forwarded-For` or `X-Real-IP`);
  - returns 201 `{ id, createdAt }`.
- `GET /api/feedback`: needs `Authorization: Bearer $FEEDBACK_TOKEN`; disabled
  (401) when the variable is empty; returns JSON, newest first.
- `GET /api/health`: queries SQLite, returns `{ ok: true, … }`.
- Static serving of the built app with SPA fallback:
  - `index.html`, `sw.js`, `manifest.webmanifest` and the Workbox files are sent with `no-cache`;
  - hashed files under `/assets/` are sent with `public, max-age=31536000, immutable`.
- The SQLite file lives in `DATA_DIR` (a volume).

## PWA

- Vite and TypeScript, no UI framework (vanilla TS views, a tiny router), with
  `vite-plugin-pwa` (Workbox).
- The whole app is precached, so it works fully offline (questions are bundled).
- Manifest: name "Pydra: Python Trainer", short_name "Pydra", `start_url: '/'`,
  `scope: '/'`, `display: standalone`, colours matching the dark theme, the
  icons above.
- `/api/*` is excluded from the navigation fallback.
- Updates:
  - when a new service worker is found outside a quiz, the app reloads at once;
  - during a quiz, the reload waits until the quiz ends (summary shown, or back home);
  - the app checks for updates on launch, when it becomes visible again, and every hour.

## Engineering

- npm workspaces `shared/`, `web/`, `server/`; root package `pydra`; Node 24.
- Root scripts: `dev`, `build`, `test`, `check`, `start`, `test:e2e`.
- Tests run locally only, never in CI:
  - **Vitest:**
    - session builder;
    - storage and auto-resume;
    - counters and stats;
    - update-manager rule;
    - feedback validation;
    - rate limiter;
    - feedback store;
    - token check;
    - feedback queue;
    - i18n completeness;
    - quiz hydra geometry and head states;
    - the game's interpreter, world simulation and progress, and every
      level: the right answer solves it, each wrong answer fails with its
      own behaviour, and no note of a wrong answer names the right one;
    - a content validation test over all 80 questions;
    - the daily challenge: pool validation, the pick of the day, the run, its saved data, XP, streak and achievements.
  - **Playwright e2e,** against the built app served by the Node server:
    - a full 10-question run, including the hydra heads and the summary hydra;
    - slashed and regrown heads, restored after a reload without animation;
    - a game level: wrong answers run and fail, the right answer is never
      marked before it is picked, tried answers survive a reload, every
      answer stays pickable and replays after solving change no score;
    - the game speed setting, and a 360×640 phone: one-line level strip,
      arena, code and answers visible together without scrolling;
    - keyboard;
    - Quit;
    - auto-resume;
    - language switch;
    - reset;
    - feedback sending;
    - offline-queued feedback;
    - offline app load;
    - update rule.

## Deployment

- One Docker image (multi-stage `node:24-alpine`):
  - bundled server and static PWA, no `node_modules`;
  - runs as `USER node`;
  - `DATA_DIR=/data` volume, `PORT=3000`;
  - `HEALTHCHECK` on `/api/health`.
- GitHub Actions builds and pushes only (no tests, type checks or lint) on
  push to `main`, with tags `<git sha>` and `latest`.
- On the server, `compose.prod.yaml` runs:
  - the `pydra` service, bound to `127.0.0.1:3001`;
  - Watchtower (`nickfedor/watchtower`, scope `pydra`), which pulls new images automatically.
- Caddy terminates TLS and proxies `pydra.quantenradierer.de` to the container.
