# Pydra: Python Trainer

Pydra (Py + Hydra) is a multiple-choice trainer for absolute Python beginners,
in German (default) and English. It is an installable PWA that works fully
offline: 80 questions in 8 topics, 10 random questions per session, with an
explanation after every answer. Live at https://pydra.quantenradierer.de/.

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
| `session.ts`                    | Picks and shuffles questions                                        |
| `trainer.ts`                    | Quiz flow and stats                                                 |
| `storage.ts`                    | localStorage access                                                 |
| `update.ts`                     | Service worker update rule (never reload during a quiz)             |
| `feedback/`                     | Feedback client and offline queue                                   |
| `i18n.ts`                       | UI texts in German and English                                      |
| `icons/hydra.svg`, `scripts/icons.mjs` | Icon artwork and the PNG generator (`npm run icons -w web`)  |

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
| `npm start`        | Serves the build (`STATIC_DIR`, `DATA_DIR`, `PORT`, `FEEDBACK_TOKEN`) |
| `npm run test:e2e` | Playwright e2e tests (run `npm run build` first)   |

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

## Feedback API

| Request                  | What it does                                                                 |
| ------------------------ | ---------------------------------------------------------------------------- |
| `POST /api/feedback` `{ "text": "…" }` | Stores anonymous feedback: 1–2000 characters, at most 5 per minute per IP. |
| `GET /api/feedback`      | Returns all entries, newest first. Needs `Authorization: Bearer $FEEDBACK_TOKEN`; disabled when the token is empty. |
| `GET /api/health`        | Returns `{ "ok": true, "app": "Pydra" }` when SQLite answers.                 |
