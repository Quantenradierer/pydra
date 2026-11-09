# Robot Battler – UX audit (rb15)

Method: production build served on a free port, Chromium via Playwright, every Robot Battler state and every other Pydra game
(quiz, puzzle `game`, order, predict, hunt, daily, diff, functions) at 360x740 and 1280x800, German and English; every
screenshot viewed. Files: `<scratchpad>/shots/{phone,desk}-*.png` (scratchpad =
`/tmp/claude-1000/-var-home-leto-projects-pythontrainer/1cdeb72f-8760-429a-a58c-71bab7782b58/scratchpad`, `shots/log.txt`
holds the page heights). Names below are given without the `phone-`/`desk-` prefix; both viewports show the problem unless noted.

## What the other games do (the reference)

Back arrow + a row of **level pills** (`.level-strip`, 1..N) in one line; the task is the picture/code itself; **one** `primary`
button under the content (`Prüfen`, `Ausführen`, `Weiter`); run controls are one compact row of four icon `.run-control`s;
feedback is a `verdict` line + text below; no titles repeated, no bottom bar, no zone tabs. The page is one column, 740 px or less
(only quiz-answered 1024 px, diff 1099 px, because of the explanation).

## Findings

| # | Screen | Problem | Screenshot | Fix | Prio |
|---|---|---|---|---|---|
| 1 | Work screen, phone | **The doubled tab indication.** Top: `1 Bauen · 2 Skript · 3 Kampf · 4 Verbessern` (`rb-steps`). Bottom: `Aufgabe · Roboter · Skript · Kampf` (`rb-tabs`). Same navigation, two vocabularies (4 steps vs 4 zones that do not map: Task and Robot are both "Bauen", "Verbessern" has no zone), both highlighted at once, and only the bottom one is clickable. | `robot-fc-robot`, `robot-before-code`, `robot-fight-lost` | Delete the top step indicator completely (`rb-steps`, `PHASES`, `aria-current="step"`). Keep one bar (see target design). | P0 |
| 2 | Work screen, desktop | The step indicator sits top right although all zones are visible at once; "Kampf" lit up tells the player nothing and looks like a tab bar that does not switch anything on 3 of the 4 clicks. | `robot-before-task`, `robot-fight-lost` | Gone with #1; desktop needs no navigation at all. | P0 |
| 3 | Work screen, phone | Layout is unlike every other game: zone header with title + purpose line + tool buttons per zone, a card in a card (`Aufgabe` → `Der Haken`), a sticky action bar, a tab bar: five stacked chrome rows (header, steps, zone head, action bar, tab bar) = ~250 px of 740 px before content. Other games: one 44 px header line. | `robot-fc-code`, `robot-fight-lost` | One header line (back + title + level pills), content, one action bar (target design). Remove zone purpose lines ("Sieh zu, was dein Skript macht.", "Schreibe, was dein Roboter tun soll.") – they repeat what the screen shows. | P0 |
| 4 | Whole screen | Title repeated 3 times: app bar "Erster Kontakt", zone title "Aufgabe", card title "Der Haken"; plus tab "Aufgabe" = 4th mention. | `robot-first-contact` | Header title = task name only; no zone title and no card title ("Der Haken" becomes a plain sentence, label "Haken" only in the task zone). | P1 |
| 5 | Code zone | **Two help entries**: tool button `Befehle` (drawer with the command list) and strip button `? Hilfe` (sheet with the same commands plus Python blocks). Both titled "Hilfe: Befehle"/"Befehle deines Roboters". | `robot-code-focus`, `robot-code-help`, `robot-api-drawer` | Keep only the `? Hilfe` sheet; remove the `Befehle` drawer (`robot-api-open`, API drawer). | P0 |
| 6 | Code zone | `Versionen` drawer is empty most of the time ("Noch keine Version") and competes with the help as a second header button. After a fight "Skript ändern" and "Kampf starten" are both in the action bar although the editor is hidden by the listing. | `robot-history-drawer`, `robot-code-after-fight` | Move `Versionen` into the `?`-sheet-style "More" menu only once a version exists; the listing needs no toggle button (see #11). | P2 |
| 7 | Code zone, strip | The suggestion strip shows a cut-off chip (`backwa…`) and the `? Hilfe` button floats at the right edge; the chips look like buttons but are partly hidden. | `robot-code-focus` | Strip scrolls under a fade; `? Hilfe` stays pinned left of the strip as an icon button `?`. | P2 |
| 8 | Fight zone, phone | The arena is **cropped** (about 60% visible, `robot-fight-start`): result banner, queue bar, 4-icon + 4-text controls and the tab bar eat the screen; the player has to scroll the zone body to see the robots. | `robot-fight-start`, `robot-fight-during`, `robot-fight-lost` | Order: arena first (square, full width), then ONE row of four `.run-control` icons as in the other games, then result. Move queue ("Kampf 1 von 6") into the level pills. | P0 |
| 9 | Fight zone | Control overload: `Abspielen`, `Zeile zurück`, `Nächste Zeile`, `Von vorn`, `Eine Runde zurück`, `Eine Runde vor`, `Zum Ende` = 7 buttons in two rows, with 3 disabled at all times, three-line wrapped labels. Other games: 4 icons. | `robot-fight-lost` | Four icons (restart, play/pause, step, to end) = the existing `.run-controls`; step granularity (line vs round) is a toggle in the details sheet. | P1 |
| 10 | Fight zone | Queue bar is cramped and truncated: `Kam…` (title cut off), `verloren` chip clipped by `Überspringen`, `Nächster Kampf` squeezed in. The result banner has a second primary button (`Skript verbessern`) while the action bar has `Kampf starten` – two primaries. | `robot-fight-lost`, `robot-fight-won` | Result = one verdict line (`verloren`/`gewonnen ★★★`) under the arena; exactly one primary after a fight: win → `Weiter`, loss → `Skript verbessern` (goes to the editor). `Überspringen` / `Nächster Kampf` move into the fights sheet. | P0 |
| 11 | Code zone after fight | The editor is replaced by the listing, a toggle `Skript ändern` brings it back. The listing is a second copy of the code (code zone shows it, fight zone says "Die Aktion dieser Runde passiert jetzt…"). Players edit the script they cannot see while fighting. | `robot-code-after-fight` | Put the highlighted listing directly under the arena in the fight view (the other games show the code under the board); the code zone always shows the editor. | P1 |
| 12 | Fight zone | Drawers `Kämpfe (6)` and `Details`: label "Kämpfe (6)" and the heading "Alle Kämpfe" repeat "Kampf"; `Details` opens "Tempo, Variablen und Verlauf" – the label does not announce its content. Speed slider shows a second, unlabeled slider (scrub). | `robot-more-drawer`, `robot-fights-drawer` | `Kämpfe` → part of the level pills; `Details` → `Tempo & Variablen`; remove the second slider. | P2 |
| 13 | Task zone | Mostly empty: one card in a 740 px screen (`before-task`), then a bottom button `Weiter zum Skript`. Same for the Robot zone: big picture + helper text + button. Two full screens to read one sentence and see the robot. | `robot-first-contact`, `robot-fc-robot` | One start screen: task sentence + robot picture + the code editor on the same page (phone: stacked, 1 screen); build changes via the robot picture's `Teile` button. No separate task/robot "step". | P0 |
| 14 | Task zone, challenges | Text column collapses: `Der Haken` + 3 robot icons next to a long English-mixed text shrinks to a 100 px wide column (word per line, 10+ lines) in Training and Constraint challenges. Training enemy text is English in the German UI ("dummies ahead, a tough one on the right"). | `robot-training-fight`, `robot-gl-foward-task` | Icons above the text, not beside; i18n the training description. | P1 |
| 15 | Task map | Home card, chapter fold list, 6 "Sonderregel"/"Nebenmission" entries per chapter with a two-line title + subtitle each: 2106 px (phone) / 1894 px (desktop) page height; title wraps ("Kapitel 0: Befehle nacheinander" in 3 lines), `Kapitel 0` is open while all others are locked yet also listed. Other games: pills 1..N. | `robot-map`, `robot-map-fresh` | Pills 1..N per chapter + the next task as one big card (`Weiter: Erster Kontakt`); folds only for finished chapters; side missions in one `Nebenmissionen` fold. Page ≤ 740 px. | P1 |
| 16 | Home | Home is 1858 px tall for all games (not Robot-specific). The Robot card is the only one with a picture inside the title line. | `home`, `home-seeded` | Out of scope, note only. | P3 |
| 17 | Header | Robot map header is "← Roboter-Kampf" in a 28 px display size; work screen "← Erster Kontakt" in 20 px, others have no title at all. Three type sizes for the same slot. | `robot-map-fresh` vs `robot-first-contact` | Use `header.ts` heading for all Robot screens (same size). | P2 |
| 18 | Buttons | Robot has 5 button styles: blue filled sticky (`Kampf starten`), blue pill (`Skript verbessern`), outlined chips (`Befehle`), outlined squares (4 tabs), pale disabled run buttons with text. Other games: `primary` + `run-control`. The action bar is left-aligned and not full width in the fight zone (`Kampf starten` shrinks next to `Skript ändern`). | `robot-fc-fight`, `robot-fight-lost` | `primary` (full width) + `run-control` only; secondary actions in the `?` / `⋯` sheet. | P1 |
| 19 | Disabled controls | `Weiter zum Skript` on the empty fight zone and `Kampf starten` in the fight zone on a fresh task: the fight zone says "Starte den Kampf und sieh deinem Roboter zu." in a box and then 400 px of empty space. | `robot-fc-fight` | Show the arena with the two robots before the first fight (preview), the same way the other games show the board before "Ausführen". | P1 |
| 20 | Help sheet | Dialog covers 80% of the phone, contains a tab row clipped on the right (`Python Vergleiche Fahren` + cut-off chip), the title "Hilfe: Befehle" twice (sheet title and section), and a hint line. | `robot-code-help`, `en-help` | Title once; scrollable tab row with a fade; no hint line (the strip already says it). | P2 |
| 21 | English | Tab and chips are consistent, but task text stays German ("Der Haken", "Schlage die Attrappenreihe…") in the English UI. | `robot-en-task`, `robot-cn-row-3-task` | Missing en strings for task titles/texts of challenges. | P1 |
| 22 | Result screen | Stars/outcome are a pale banner inside the fight zone with a truncated sentence (`Verloren: 3 von 3 Kämpfen....`); other games use the `verdict` line + explanation + one `Weiter`. | `robot-fight-won`, `robot-fight-lost` | `verdict correct/wrong` line, stars on the same line, one primary. | P1 |

## Scroll and clarity

* Page height: every Robot work screen is exactly the viewport (740/800) – good – but the *content* scrolls inside zones:
  robot zone (picture + text + button), build drawer (list of 12 radio rows, 440 px), help sheet, fight zone (arena cropped,
  needs scroll to see the robots). The task map is the only page scroll (2106 px).
* The player must scroll to find: the arena in the fight zone (#8), the remaining chips of the strip (#7), the second half
  of the help sheet, the next task in the map (#15).
* Unclear labels: `Befehle` (#5), `Details` (#12), `Verbessern` step vs `Skript verbessern` button vs `Skript` tab, `Aufgabe` tab vs `Aufgabe` title,
  `Von vorn` vs `Zeile zurück` vs `Eine Runde zurück`, `Versionen`.

## Target design (the one pattern, the same as the other games)

**Header** (shared `header.ts`, one line): ← back · task name · *level pills* (`.level-strip`: the chapter's tasks 1..N,
current filled, solved with ✓, locked greyed) – exactly like puzzle/order/hunt/predict. No step indicator, no zone title row.

**Phone: one scrolling column per task, no tab bar, no sticky second bar.** Order:
1. task sentence (one line, `Der Haken` is just its first words) and the enemy/robot pictures in one row;
2. the arena (square, full width) showing both robots before the first fight;
3. the four `.run-controls` icons (only enabled once a fight exists; the arena is the same widget for preview and replay);
4. the code editor (the editor with its strip; `?` opens the one help sheet);
5. ONE `primary` full-width button: `Kampf starten`; after a fight it becomes `Weiter` (win) or `Skript verbessern` (loss,
   scrolls to and focuses the editor); the `verdict` line (stars) appears directly above it.
Robot parts: `Teile` as a text button on the robot picture (sheet), not a zone. The listing with the highlighted line replaces
the editor's text while a replay is active (same box), nothing else moves.

**Desktop (≥ 960 px):** the same elements in two columns (left: task, arena, controls, verdict; right: editor + help + primary);
no navigation of any kind. Page does not scroll.

**Exactly one place for zone/step navigation: none** – the task is a single page and the pills navigate between tasks (the same
as in the other games). This removes `rb-steps`, `rb-tabs`, `zone-tab-*` and the zone header (e2e `zone()` becomes a no-op on both
viewports; keep the helper's signature to minimise churn).

**One primary action per screen:** map → `Weiter: <Aufgabe>`; task before fight → `Kampf starten`; after win → `Weiter`; after
loss → `Skript verbessern`. Everything else is secondary (help `?`, parts `Teile`, fights/speed/variables in one `⋯` sheet).

**Implementation order:** (1) remove top step indicator and `Befehle` drawer (#1, #2, #5, P0, cheap); (2) fight layout and one primary
(#8, #9, #10, #22); (3) merge task + robot + code into one page, remove tab bar (#3, #13); (4) map as pills (#15); (5) i18n and polish
(#14, #20, #21). Keep ids (`robot-run`, `robot-code`, `robot-outcome`, …) so the e2e suite only needs the zone-navigation helpers changed.

## Resolution (rb16-uxfix)

All findings are resolved, except #16 (won't fix). The implementation follows the target design; where it deviates, the reason is given.
Shots: `<scratchpad>/shots2/{a..e}-{de,en}-{phone,desk}-*.png` (360x740 and 1280x800, both languages), compared with the other games' shots.

| # | Status | How |
|---|---|---|
| 1, 2 | resolved | `rb-steps`, `PHASES`, `aria-current="step"` on the steps and the whole `robot-work.ts` zone shell are deleted. The only step indicator is the level pills (`level-strip`, exactly once; e2e `expectOneNavigation`). |
| 3 | resolved | One `game-bar` (back + pills), content, one primary button. No zone header, zone purpose lines, sticky action bar or tab bar. Chrome above the content: ~46 px. |
| 4 | resolved | The h1 is screen-reader-only like in the other games; the task name appears once, as the bold start of the task sentence. No zone title, no card title, the label "Der Haken" is gone. |
| 5 | resolved | The `Befehle` drawer (`robot-api-open`, `apiList`) is deleted; the `?` sheet is the only command list. |
| 6 | resolved | `Versionen` is a section of the `Mehr` sheet and only exists once a version exists; the listing replaces the editor in the same box (tap it to edit), so there is no `Skript ändern` toggle button any more. |
| 7 | resolved | `?` is an icon button at the left of the strip; the chip row (and the help tab row) fades out at the right edge. |
| 8 | resolved | Order: arena (square, full width, ≤ 28 dvh high), one row of icon controls, then the rest; arena fully visible without scrolling. The queue is a row of round fight pills. |
| 9 | resolved | Four icons (↺ ▶/⏸ → ⇥). Line vs round is a toggle in the `Mehr` sheet (`robot-grain-*`). The back-steps were dropped on purpose (restart + step replace them): **won't-fix: step back** (`prevBeat` was deleted). |
| 10 | resolved | One `verdict correct|wrong` line with the stars; one primary: `Weiter: …` after a win, `Skript verbessern` after a loss. `Überspringen` / `Nächster Kampf` live in the `Mehr` sheet. |
| 11 | resolved (deviation) | The listing replaces the editor **in the same box** (as in the target design's last sentence), not under the arena: the script is in one place only. |
| 12 | resolved | The fights are the pills; `Details` is `Mehr` with the sections `Kämpfe`, `Tempo & Variablen`, `Versionen`; the scrub slider is deleted. |
| 13 | resolved | Task, robot picture (`Teile` opens the parts sheet), arena and editor are one page. |
| 14 | resolved | Pictures above the text; the training description is bilingual (`training.ts` `Words`, unit test `content-i18n.test.ts`). |
| 15 | resolved | `Weiter: <Aufgabe>` card, one fold per chapter with round pills 1..N (name = label / title); only the chapter in progress is open, finished and locked ones are closed. Fresh game: ~620 px; the seeded all-chapters-in-progress shot is longer. |
| 16 | won't fix | The Home screen is shared by all games and out of scope. |
| 17 | resolved | The map uses `subpageHeader`; the work screens use the shared `game-bar` (the same as every other game); one type size per slot. |
| 18 | resolved | `button.primary` (full width) and `.run-control` only; secondary actions are in the sheets. |
| 19 | resolved | The arena shows both robots before the first fight (viewer in `preview` mode, controls disabled). |
| 20 | resolved | `createSheet`: title once, no hint line, tab row fades. |
| 21 | resolved / verified | All enemy and challenge texts exist in both languages (unit test `content-i18n.test.ts`); the remaining English text was the training description (#14). |
| 22 | resolved | See #10. |

Cleanup: `work.*` zone / phase / tab messages, `robot.outcome.idle`, the step-back messages, the old `.robot-step*`, `.robot-api*`, `.robot-history*`, `.rb-zone*`,
`.rb-tabs`, `.rb-steps` styles and the three duplicated level-strip builders (puzzle, order, predict) are gone.

## rb19 (4th complaint) - superseded rows

The *Mehr* sheet, the step-size toggle, the second sheet sections, the queue menu and the "Teile" button named in the rows above no longer
exist; see `docs/robot-battler.md` ("Removed in rb19"). The fight now plays at once and the verdict follows the playback.
