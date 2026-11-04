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

Home offers three lessons. The first two use the same quiz screen, answer feedback,
explanations, hydra, resume and stats rules (below); they differ in which
questions a session asks.

| Lesson    | Name (de / en)                     | A session                                                               |
| --------- | ---------------------------------- | ----------------------------------------------------------------------- |
| `mixed`   | Quiz / Quiz                        | 10 random questions from the 80 (see Quiz session)                      |
| `functions` | Funktionen lesen / Reading functions | one function read line by line: one question per line, in order, then one about the whole function |
| game      | Hydra auf Fischfang / Hydra goes fishing | the hydra game: its own screen and progress (see below) |

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
  - Reading functions: e.g. "2 of 4 functions read · 80% correct"; "No
    function read yet." before the first answer.
  - Hydra goes fishing: e.g. "3 of 19 levels solved · 60% correct" (share of
    right picks); "No level played yet." before the first pick.
- **Quiz:** as above.
- **Game:** as above, with a back button to Home (pushed onto the history
  like Settings).
- **Summary:** as above.
- **Settings:**
  - DE/EN toggle;
  - hydra game speed: slow (default) / normal / fast, saved as `gameSpeed`
    and kept by Reset progress;
  - "Reset progress" with a confirm dialog: wipes stats, counters, any
    saved session and the game's progress, keeps the language;
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
  functions);
- the game's progress (see the game above);
- the last result (lesson, score, total) for the summary;
- per-question stats `{ seen, correct, lastSeen }` keyed by question id
  (collected now, not yet used to pick questions);
- the feedback queue.

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
    - a content validation test over all 80 questions.
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
