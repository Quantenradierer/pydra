# Elevator game ("Hydra-Aufzug" / "Hydra Lift")

A game in the style of [Elevator Saga](https://play.elevatorsaga.com/): the learner writes the Python that runs the
elevators of a building, people appear on the floors and want to go somewhere else, and a challenge is passed when
enough of them got there in time. Much gentler than Elevator Saga: the challenges are grouped by building, and each
building practises one idea in a few variations before the next idea comes.

**Status: built (9 challenges), listed on Home**; the route is `#/elevator`.

## Principles

1. **One new idea per challenge** at most: a Python word, a handler, or a kind of goal.
2. **The code a challenge opens with visibly fails**: the learner's passing code of the challenge before, or a given
   starter (a first line to see something move, or somebody else's code to fix).
3. **Beginner timing**: the reference solution needs at most 70 % of the time limit (a test checks it); elevators
   move slowly and at a constant speed; every run of a challenge sees the same people.
4. **One elevator, one fixed line**: as long as a challenge has one elevator, the program has a read-only first line
   `elevator = elevators[0]`. It is not shown (no box, no explanation): `elevator` simply works. From two elevators on it is gone and the handlers get
   the elevator as a parameter.
5. **A run plays until the time is up** (or until the goal is reached). Mistakes against the goal cost time and show,
   the verdict comes at the end. Only a Python error, or an elevator sent to a floor that does not exist, ends a run
   early: the elevator crashes.
6. **The picture is the test.** Any program that reaches the goal passes; the task text suggests a way, nothing checks
   the code's shape.

## The building

| Rule | Value |
| --- | --- |
| Time | Ticks of 0.1 s. |
| Speed | 1 floor per second, constant. |
| Stop | The doors stay open 1.5 s: riders for this floor get out, people waiting here get in (as many as fit). |
| Capacity | 4 people (a challenge may change it). |
| Who gets in | Everybody, whichever way the car goes next. |
| The list | `go_to_floor(n)` adds `n` at the end of the car's list; a floor already on the list is not added again. The car works through the list in order. The list is shown under the shaft as a Python list. |
| Idle | A car with an empty list stands still with closed doors. It does not open for people on its floor unless that floor is on its list. |
| Buttons | Someone appearing on a floor presses the call button (if it is not lit); whoever gets in presses their floor's button (if it is not lit). A full car leaves people behind; they press the call button again. |
| Trips ("Fahrten") | Every time a car starts driving to another floor. Stopping on the floor it stands on is no trip. |
| Waiting time | From appearing to getting out (as in Elevator Saga). |
| Building site | A challenge may close floors. Nobody appears there or wants to go there. A car sent there drives there and stops in front of barrier tape: nobody gets in or out, the stop is shown in red and costs its 1.5 s. |
| A floor that does not exist | `go_to_floor(9)` with floors 0 to 5 is accepted and goes on the list. When it is 9's turn the car drives up past the top floor and crashes through the roof; `go_to_floor(-1)` drives down past floor 0 into the bottom of the shaft. See "Crash". |

People are planned in advance per challenge, about every `every` seconds someone appears. Patterns:

| Pattern | Who |
| --- | --- |
| `random` | any floor to any other floor |
| `lobby` | from floor 0 up |
| `down` | from an upper floor down to 0 |
| `mixed` | half `lobby`, half `down` (an office in the morning and the evening) |

`stops` limits the floors people use; closed floors are never used.

## The Python side

| Name | Kind | What it does |
| --- | --- | --- |
| `elevators` | list | The cars, `elevators[0]`, `elevators[1]`, …. Read-only. |
| `elevator` | variable | The fixed line `elevator = elevators[0]` while there is one car. Read-only then. |
| `x.go_to_floor(n)` | command | Puts floor `n` on the car's list. Only an `int` (not `True`, not `"2"`, not `2.5`). |
| `x.current_floor()` | question | The floor the car is at (the nearest one while it drives). |
| `x.pressed_floors()` | question | The floors whose button is lit inside, as a sorted list. |
| `waiting(floor)` | question | How many people wait on `floor` right now (0 for nobody, and for a floor that does not exist). A plain function: the waiting people belong to the building, not to a car. Only an `int`, like `go_to_floor`. |
| `on_floor_button(floor)` / `on_floor_button(elevator, floor)` | handler | Called when a rider presses the button of `floor`. |
| `on_call(floor)` | handler | Called when someone on `floor` presses the call button. |

**The program's own lines (no function around them) run from the top every time a car has nothing to do** (its list is
empty and its doors have closed, and once per car at the start): a *run* for that car. There is no `def on_idle()`: a
learner who writes it (as in Elevator Saga) is told the plain lines already do that. Every run starts with fresh
variables. With one car, `elevator` is the fixed line; with two or more, `elevator` is the car the run is for.

**In a run, `go_to_floor(n)` waits**: it puts `n` on the car's list, and the program goes on only when the car has
finished its stop at `n` (the same car or, with `elevators[i].go_to_floor(n)`, that car). So the line that runs is
always the line the elevator is busy with, and the code and the building stay in step. In a handler `go_to_floor(n)`
only puts the floor on the list and the handler goes on (the building calls handlers in between, while runs wait).
When a run has ended and the car has nothing to do, the next run starts from the top. A run that gives its car nothing
to do at all (`if waiting(floor) > 0:` while nobody waits) leaves it standing: the program then runs again one second
later, and again, until it sends the car somewhere. A program of only `def`s is not run again (it would change nothing).

Functions the program defines are the handlers (`on_floor_button`, `on_call`); the building calls the ones of the
latest run. They are known from the start of a run, wherever their `def` stands (a run may wait at a `go_to_floor`
above them). Their parameter names are free, their number is not (one car: no car parameter; two or more: the car
first). A handler that is not defined is simply not called.

## Mistakes

| Situation | Kind | What happens |
| --- | --- | --- |
| Too many trips | goal | The trips counter turns red when the limit is passed; the run goes on; the verdict at the end says so. |
| Somebody takes too long | goal | That person turns red when the limit is passed; the run goes on; the verdict at the end says so. |
| A stop at the building site | goal | A red stop in front of barrier tape; the run goes on; the verdict at the end says so. |
| Time is up | goal | The run ends; the verdict says how many got there. |
| A runtime error in a run or a handler (`NameError`, `TypeError`, `IndexError`, `ZeroDivisionError`, …) | Python | **Crash**, the run ends. |
| A run or a handler that never ends (2000 steps) | Python | **Crash**, the run ends. |
| `go_to_floor("2")`, `go_to_floor(2.5)`, `go_to_floor(True)`, `go_to_floor()`, `go_to_floor(1, 2)` | Python | **Crash** at once, the run ends: "go_to_floor() braucht eine ganze Zahl, nicht '2' (Zeile 3)." |
| `go_to_floor(9)` with floors 0 to 5, `go_to_floor(-1)` | building | The car drives there in its turn and **crashes** through the roof / into the bottom of the shaft; the run ends. The message names the line that put the floor on the list: "Eine Etage 9 gibt es nicht, das Haus geht nur bis 5. Der Aufzug ist durchs Dach gekracht (Zeile 3)." |
| Syntax error, `def on_idle():`, `def on_floor_buton():`, a handler with the wrong number of parameters, `go_to_floor(1)` without the car, assigning `elevator` or `elevators` | before the start | The program cannot start: the message with its line, nothing runs, nothing crashes. |

### Crash

1. The line turns red, the caption shows the friendly message.
2. The building shakes briefly, the alarm lamp flashes red.
3. Sparks at the cable, the car drops to the bottom of its shaft, dust rises, the car lands crooked. The riders stay
   in.
4. The verdict: "Dein Aufzug ist abgestürzt: …" with the message and the line.

Which car crashes: the car of the run or of `on_floor_button` (with one car always that one), or
the car that drove to the floor that does not exist. An error where no car is involved (`on_call`, the top of the
program) crashes all cars.

## The challenges

Grouped by building, one building per idea: the Gartenhaus for `go_to_floor`, the Schule for the order of the lines
as the route, the Hochhaus for `for` and `if`. Each building has its own accent colour (its name label, its heading in
the list) and the list shows the buildings as headings. A challenge opens when the one before it is solved.

Every challenge has a fixed UUID: progress, code and points are stored under it, never under its number. The number
shown (the # below) is its place in the list. A challenge added in between is new for everybody (it opens when the one
before it is solved); the others keep their progress. A removed challenge's progress is dropped when read.

| # | Building | Title | Floors / cars | Who travels | Goal | New | Starts with | Reference | What fails at the start |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Gartenhaus | Hoch und runter | 2 / 1 | random | 5 people in 60 s | `go_to_floor` | given: the solution (`go_to_floor(0)`, `go_to_floor(1)`), to show what the game is about | `go_to_floor(0)`, `go_to_floor(1)` | nothing: it passes as given; 2 is the first one the learner writes |
| 2 | Gartenhaus | Alle wohnen oben | 2 / 1 | down | 6 in 60 s | – | given: `elevator.go_to_floor(1)` | 1, 0 | it goes up once, takes them, never comes down |
| 3 | Gartenhaus | Das Dachgeschoss | 3 / 1 | random | 8 in 70 s | – | code of 2 | 0, 1, 2 | floor 2 is never visited |
| 4 | Schule | Vier Etagen | 4 / 1 | random | 8 in 80 s | – | code of 3 | 0, 1, 2, 3 | floor 3 is never visited |
| 5 | Schule | Alle wollen runter | 4 / 1 | downward: everybody to a lower floor, from 0 to the top | 10 in 60 s, nobody longer than 15 s | the order of the lines is the route | code of 4 | 3, 2, 1, 0 | riders go up first, somebody takes too long |
| 6 | Schule | Alle wollen hoch | 4 / 1 | upward: everybody to a higher floor, from the top to 0 | 10 in 60 s, nobody longer than 15 s | – | code of 5 | 0, 1, 2, 3 | riders go down first, somebody takes too long |
| 7 | Hochhaus | Sechs Etagen | 6 / 1 | random | 10 in 110 s | `for` | code of 6 | `for floor in range(6)` | floors 1, 2, 4, 5 are never visited |
| 8 | Hochhaus | Zwanzig Etagen | 20 / 1 | upward | 20 in 170 s | – (use the loop from 7, or write 20 lines) | code of 7 | `for floor in range(20)` | `range(6)` never reaches floors 6–19 |
| 9 | Hochhaus | Nur wo jemand wartet | 20 / 1 | down, somebody about every 10 s | 6 in 170 s, nobody longer than 90 s | `if`, `>`, `waiting(floor)` | code of 8 | `for floor in range(20)` with `if waiting(floor) > 0:`, then `go_to_floor(0)` | the loop from 8 stops on every floor: somebody waits ~120 s; without the trip to 0 nobody gets out |

The numbers (how often people appear, the limits) are tuned with the reference solutions and the start code; the
tuned values are in `web/src/elevator/challenges.ts`, and `challenges.test.ts` checks every row's last two columns.
Tuning notes: 14 uses random traffic, because with mixed traffic every lobby call has `floor % 3 == 0` and the
reference sends the whole lobby to `elevators[0]`. A hint only names a handler the learner has met (the "buttons lit"
hint appears from 8 on).

## The screen

* **List:** the challenges under their building's name, each with building size, goal and state (locked / open /
  solved with the best time), and a "Continue" button.
* **Challenge page:** the task with a "New: …" tag and the goal; the building, drawn plainly like Elevator Saga so it
  reads well on a phone (the building's name as a small label in its accent colour; floors as flat bands with their
  number and an up and a down call button, lit while somebody waiting there wants to go that way (only drawn, derived
  from the waiting people; `on_call(floor)` still gets just the floor); waiting people showing their target floor;
  closed floors with barrier tape and no buttons; one shaft per car, reaching a thin band above the top floor and
  below floor 0, with the car (floor and direction in its head, sliding doors, riders), lamps for the pressed floor
  buttons, and the car's name and list under the shaft); Elevator Saga's six numbers as a compact block of label and
  value (transported, elapsed time, transported/s, avg and max waiting time, moves), a number turning red when its
  limit is passed; the controls (restart, play / pause, next step in your code, to the end, speed 1× / 2× / 5× /
  10×) and a caption saying what ran (a run for an idle car, or a handler) and what it told the cars so far.
* **Code, played line by line:** whenever the learner's code runs, the building waits and the code is stepped through
  line by line (about half a second per line at 1×, faster at higher speeds): the running line is marked, the floors
  `go_to_floor` got and how each `if` went appear as they happen. "Next step" goes one line further, or to the first
  line of the next run; a crashed run is stepped up to the line that crashes, then the crash plays. On a crash the line
  is red.
* **Verdict:** passed, or what went wrong (time, trips, waiting, building site, a crash with message and line) plus at
  most one hint (the cars stood still, a car never moved, a floor nobody stopped at, buttons lit that nobody drives
  to).

## Code

| Path | What |
| --- | --- |
| `web/src/elevator/sim.ts` | The building (pure): cars, lists, people, buttons, closed floors, crashes, events, stats. |
| `web/src/elevator/run.ts` | Precheck, and the run: the program, the handler calls per event, one snapshot per tick. |
| `web/src/elevator/challenges.ts` | The buildings, the challenges and the people they plan. |
| `web/src/elevator/game.ts` | Judging, progress (last / passing text, best run, solved, misses), points. |
| `web/src/elevator/friendly.ts`, `messages.ts` | The texts (de / en). |
| `web/src/elevator/scene.ts`, `suggest.ts` | The SVG building with the crash; the editor's suggestions. |
| `web/src/views/elevator.ts`, `web/src/elevator.css` | The list and the challenge page with the playback. |
| `web/src/robot/py/interp.ts` | `Program.startCall()`: runs a function of the module after it ended (the handlers). |

## Open questions

1. **Name** of the game, de and en ("Hydra-Aufzug" / "Hydra Lift" for now).
2. **More challenges** later. The engine still has what the removed hotel, office, high-rise and tower challenges
   used (`on_floor_button`, `on_call`, two and three cars) and closed floors (building sites); no challenge uses them now.
