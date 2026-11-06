# Pydra: Python Trainer

Pydra (Py + Hydra) is a multiple-choice trainer for absolute Python beginners,
in German (default) and English. It is an installable PWA that works fully
offline. Lessons and games: a daily challenge (one program a day, five questions that follow it as it grows and changes), a quiz of 10 random questions from 80 in 8 topics,
"Spot the difference" (two almost identical snippets, what does the change do?),
"Reading functions", which walks through a short function line by line and
then asks what the whole function does, and "Hydra goes fishing", a game:
fill the gap in a small program and watch a hydra run it step by step. A
second game, "Hydra hunt", works the same way with a warrior who slays
snake-like hydras and collects gold; in the third, "Code puzzle", the
warrior's program is all there but shuffled, and the lines must be put in
order. Every answer gets an explanation. Live at https://pydra.quantenradierer.de/.

The agreed requirements are in [docs/requirements.md](docs/requirements.md);
deployment is described in [DEPLOY.md](DEPLOY.md).

## Structure

npm workspaces, Node 24:

| Path      | What                                                                                 |
| --------- | ------------------------------------------------------------------------------------ |
| `shared/` | API types and validation used by web and server (`src/api/feedback.ts`)              |
| `web/`    | The PWA: Vite + vanilla TypeScript + `vite-plugin-pwa`, questions in `src/content/`  |
| `server/` | Hono server: feedback API, health check, static files of the built PWA, SQLite       |
| `e2e/`    | Playwright tests against the production build served by the real server             |

In `web/src`:

| File or folder                  | What it does                                                        |
| ------------------------------- | ------------------------------------------------------------------- |
| `app.ts`                        | Hash router                                                         |
| `views/`                        | The screens                                                         |
| `content/lessons.ts`            | The lessons and the content they play (`CONTENT`)                   |
| `content/diff.ts`, `content/diff/` | The "Spot the difference" questions (`code` = version A, `codeB` = B) |
| `daily/`, `content/daily.ts`, `content/daily/` | The daily challenge: pick of the day (`select.ts`), run and result (`challenge.ts`), the 45 snippets (levels 1-3) and the 7 intro-week snippets |
| `session.ts`                    | Builds sessions (random or in order) and shuffles choices           |
| `trainer.ts`                    | Quiz flow and stats                                                 |
| `storage.ts`                    | localStorage access                                                 |
| `update.ts`                     | Service worker update rule (never reload during a quiz)             |
| `points/`                       | XP, levels, daily tasks, achievements (pure engine + service)       |
| `feedback/`                     | Feedback client and offline queue                                   |
| `hydra/`                        | The quiz hydra: neck geometry, head states from the session, SVG; its animations are in `style.css` |
| `game/`                         | The hydra games: Python-subset interpreter (`python.ts`), what every level has (`puzzle.ts`), progress (`progress.ts`, `game.ts`). Fishing: pool simulation (`world.ts`), levels (`levels.ts`), the pool SVG (`arena.ts`). Hunt: simulation (`hunt.ts`), levels (`hunt-levels.ts`), the map SVG (`hunt-arena.ts`) and the warrior (`hero.ts`). Code puzzle: levels (`order-levels.ts`) and progress (`order.ts`), screen `views/order.ts`. The shared screen is `views/puzzle.ts`, set up by `views/game.ts` and `views/hunt.ts` |
| `i18n.ts`                       | UI texts in German and English                                      |
| `icons/hydra.svg`, `scripts/icons.mjs` | Icon artwork (also inlined as the Home logo) and the PNG generator (`npm run icons -w web`) |

## Development

```sh
npm install
npm run dev:server   # API on http://localhost:3000 (builds the server first)
npm run dev          # Vite dev server; proxies /api to port 3000
```

| Command            | What                                               |
| ------------------ | -------------------------------------------------- |
| `npm run check`    | TypeScript in all workspaces and e2e               |
| `npm test`         | Vitest unit tests                                  |
| `npm run build`    | Builds `web/dist` and `server/dist/main.js`        |
| `npm start`        | Serves the build (`STATIC_DIR`, `DATA_DIR`, `PORT`, `FEEDBACK_TOKEN`, `OPENAI_API_KEY`, ...) |
| `npm run test:e2e` | Playwright e2e tests (run `npm run build` first)   |

For local development, put `OPENAI_API_KEY=…` in a git-ignored `.env` in the repo root; `npm start` reads it. Never commit it.

The first time you run the e2e tests, install the browser with `npx playwright install chromium`.

Tests run locally only; CI just builds and publishes the image. Run
`npm run check && npm test && npm run build && npm run test:e2e` before pushing.

## Docker

```sh
FEEDBACK_TOKEN=secret docker compose up --build   # http://localhost:3001
```

The image contains the bundled server and the static PWA. Feedback is stored
in SQLite in the `pydra-data` volume (`/data`).

## Questions

Questions live in `web/src/content/questions/<topic>.json`, one JSON array of
10 questions per topic. The topics are `types`, `operators`, `strings`,
`control-flow`, `loops`, `collections`, `dicts-sets` and `functions`.

```json
{
  "id": "strings-01",
  "topic": "strings",
  "prompt": { "de": "Was gibt dieser Code aus?", "en": "What does this code print?" },
  "code": "word = \"Python\"\nprint(word[1:4])",
  "choices": [
    { "de": "yth", "en": "yth" },
    { "de": "Pyt", "en": "Pyt" },
    { "de": "ytho", "en": "ytho" },
    { "de": "Fehler (IndexError)", "en": "Error (IndexError)" }
  ],
  "answerIndex": 0,
  "explanation": { "de": "…", "en": "…" }
}
```

| Field         | Rules                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| `id`          | `<topic>-NN`. Stable: saved sessions and stats refer to it. Never reuse an id for a different question. |
| `topic`       | One of the 8 topics; it must match the file.                                               |
| `prompt`      | Text in `de` (du-form) and `en`.                                                          |
| `code`        | Optional Python snippet, the same in both languages, with English identifiers. Leave the key out when there is no snippet. |
| `choices`     | Exactly 4, all different, none of them "all/none of the above". Choices that read the same in both languages (values, code) are shown in a monospace font. |
| `answerIndex` | 0 to 3, the index of the correct choice. The app shuffles the choices.                    |
| `explanation` | Text in `de` and `en`, shown after answering. Explain like to a five-year-old: walk through the code, name the rule in plain words, define every term (German and Python name, e.g. "Menge (`set`)"), add an everyday analogy or the typical wrong turn where it helps; about 40–110 words. `` `code` `` renders as inline code, a blank line (`\n\n`) starts a second paragraph (at most 2). |

To add or change a question:

1. Edit the JSON.
2. Run every snippet with `python3` and compare the output with the correct choice.
3. Run `npm test`. `web/src/content/questions.test.ts` checks the structure: 80 questions, 10 per topic, ids, 4 distinct choices, non-empty texts.

If you change the number of questions per topic, update that test as well.
A saved session that refers to a removed id is discarded on the next launch.

To review all questions at once, run:

```sh
node -e 'for (const f of require("fs").readdirSync("web/src/content/questions")) for (const q of require("./web/src/content/questions/" + f)) console.log(`\n## ${q.id}\n${q.prompt.de}\n${q.code ?? ""}\n${q.choices.map((c, i) => (i === q.answerIndex ? "* " : "  ") + c.de).join("\n")}\n${q.explanation.de}`)'
```

## Walkthroughs (Reading functions)

Each function of the "Reading functions" lesson lives in
`web/src/content/walkthroughs/<id>.json` and is listed in
`web/src/content/walkthroughs.ts`:

```json
{
  "id": "average",
  "code": "def average(numbers):\n    total = sum(numbers)\n    count = len(numbers)\n    return total / count",
  "lines": [
    { "line": 1, "choices": [{ "de": "…", "en": "…" }, …], "answerIndex": 1, "explanation": { "de": "…", "en": "…" } },
    …
  ],
  "whole": { "choices": […], "answerIndex": 2, "explanation": { "de": "…", "en": "…" } }
}
```

- `id` is stable: the step question ids `walk-<id>-NN` and `walk-<id>-whole`
  are derived from it and used in saved sessions and stats.
- `code` is one function of 4–8 lines without blank lines; `lines` has one
  step per line, in order.
- Choices, answer index and explanation follow the rules for questions
  above; the prompts are generated. Choices are plain text (no backticks).
- Run every claim in an explanation with `python3`, then `npm test`
  (`walkthroughs.test.ts` checks the structure).

## Game levels (Hydra goes fishing)

The levels live in `web/src/game/levels.ts` (TypeScript, in play order):

```ts
{
  id: 'while',                                  // stable, saved in the progress
  title: { de: 'while: solange …', en: 'while: as long as …' },
  intro: { de: '…', en: '…' },                 // introduces the concept; backticks are code
  map: ['#######', '>FF.FF#', '#######'],       // # rock, . water, F fish, start ^ > v <
  code: 'while ___:\n    move()',             // exactly one gap ___
  choices: [
    { code: 'not wall_ahead()', note: { de: '…', en: '…' } }, // right: the explanation
    { code: 'wall_ahead()', note: { de: '…', en: '…' } },     // wrong: why it went wrong
    …                                                           // 4 choices in all
  ],
  answerIndex: 0,
}
```

- Every choice is really run: `fill(level, i)` puts its code into the gap,
  and `simulate()` in `world.ts` runs it with the interpreter in `python.ts`
  and records a step per line. Only what the interpreter supports can be used
  (see the comment at the top of `python.ts`).
- The right answer must eat every fish; each wrong one must fail, and fail
  differently from the others (path, fish eaten or outcome). A wrong
  answer's note explains what went wrong without naming the right answer.
- Add the expected outcomes of a new level to `EXPECTED` in
  `levels.test.ts`, then run `npm test`.
- Check every answer in real Python too: run the filled program with
  `move`, `turn_left`, `turn_right`, `wall_ahead` and `fish_ahead` defined
  over the same map, and compare outcome, error type and final position
  with `simulate()`.


## Hunt levels (Hydra hunt)

The levels live in `web/src/game/hunt-levels.ts`, in the same shape as the
fishing levels; only the map differs: `#` rock, `.` grass, `@` the
warrior's start, `G` gold, `H` a hydra's head and `o` its body (one line of
cells from the head, not touching another hydra). `simulateHunt()` in
`hunt.ts` runs every answer. The right answer must slay every hydra and
take all the gold; the same rules for wrong answers, notes and `EXPECTED`
(in `hunt-levels.test.ts`) apply, and every answer must end the same way in
real Python.

## Code puzzle levels

The levels live in `web/src/game/order-levels.ts`: a hunt map, the program's
`lines` in a right order (indentation included, 4 spaces per level), the
`start` order they are shown in (it must not solve the level), a `hint`
for failed runs and an `explain` for the win. Add the outcome of the start
order to `START` in `order-levels.test.ts`, and check both orders in real
Python.

## Feedback API

| Request                  | What it does                                                                 |
| ------------------------ | ---------------------------------------------------------------------------- |
| `POST /api/feedback` `{ "text": "…" }` | Stores anonymous feedback: 1–2000 characters, at most 5 per minute per IP. |
| `GET /api/feedback`      | Returns all entries, newest first. Needs `Authorization: Bearer $FEEDBACK_TOKEN`; disabled when the token is empty. |
| `POST /api/ask` | Chat with an AI tutor about one question (streams plain text). Body: `lang`, `question` (prompt, code, choices, and `answered` only after the user answered), `messages`. Needs `OPENAI_API_KEY` (503 otherwise); `OPENAI_MODEL` (default `gpt-5-mini`). Capped: `ASK_RATE_LIMIT` per IP per 10 minutes (default 30) and `ASK_DAILY_LIMIT` over all clients per 24 hours (default 1000), then 429; 64 KB body, 2000 characters per message. |
| `GET /api/health`        | Returns `{ "ok": true, "app": "Pydra" }` when SQLite answers.                 |
