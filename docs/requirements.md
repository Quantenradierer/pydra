# Pydra: requirements

The agreed product and engineering requirements for Pydra. Change this file
when a requirement changes; the code, tests and the other docs follow it.

## Product

- **Name:** Pydra (Py + Hydra). Full title "Pydra: Python Trainer", short name "Pydra".
- **URL:** https://pydra.quantenradierer.de/, served at the root (`/`).
- **Repository and image:** GitHub `Quantenradierer/pydra`, image `ghcr.io/quantenradierer/pydra`.
- **Audience:** absolute Python beginners.
- **Form:** an installable PWA that works fully offline, in German (default) and English.

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
- Header: progress (e.g. 3/10) and a "Quit" button. Quit asks no
  confirmation: it discards the session and returns home. Stats of questions
  already answered are kept.
- Resume: the session is saved to localStorage after every answer, including
  whether the feedback is showing, and resumed automatically on launch without
  a prompt, on the same screen. A saved session that references an unknown
  question id, or fails validation, is silently discarded and Home is shown.

### Microcopy

| Moment           | English                | German                   |
| ---------------- | ---------------------- | ------------------------ |
| Correct answer   | Head of the class!     | Köpfchen!                |
| Wrong answer     | Head-scratcher, huh?   | Kopf hoch!               |
| Summary headline | 7 of 10 heads slain    | 7 von 10 Köpfen erlegt   |

The summary number is the score. The summary has a "Play again" button and a
way home.

## Screens

- **Home:** title and hydra logo, Start button, one stats line in the active
  language (e.g. "12 sessions · best 9/10 · 74% correct"; a friendly line
  when no session has been played yet), a gear icon to Settings and a
  speech-bubble icon to Feedback.
- **Quiz:** as above.
- **Summary:** as above.
- **Settings:**
  - DE/EN toggle;
  - "Reset progress" with a confirm dialog: wipes stats, counters and any
    saved session, keeps the language;
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
- lifetime counters: sessions played, best score, total answers, total correct;
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

- A flat, geometric four-headed hydra (four necks fanning from one body, one
  per answer choice) in Python blue `#3776AB` and yellow `#FFD43B` on a dark
  rounded square.
- SVG source plus generated PNGs: 192, 512, maskable 512 (content inside the
  80% safe zone), apple-touch-icon and favicon. A script renders them; the
  outputs are committed. The same hydra is the logo on Home.

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
    - a content validation test over all 80 questions.
  - **Playwright e2e,** against the built app served by the Node server:
    - a full 10-question run;
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
