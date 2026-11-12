# Factory (working title "Hydra-Werk" / "Hydra Works")

A design for a new game: the learner programs a small factory **machine by machine**. The lessons form a dependency
graph: a lesson opens when the lessons below it are solved, starts with the code the learner wrote there, and adds one
thing to it. Later lessons call the functions the learner built earlier.

**Status: design only. Nothing is built.** `docs/requirements.md` is not changed until the game exists.

## Principles

1. **One block, a few machines.** A block is a belt, a grabber and a smelter. Every machine is programmed separately
   first, then both together.
2. **Every command is one visible movement.** There are five given commands in the whole first layer. A lesson adds at
   most one new word (a command, a keyword or a variable).
3. **The learner's code is carried upward.** A lesson's editor opens with the learner's own passing code of the lesson
   below. From the block lessons on, their functions are the only commands they have.
4. **Every new line has a visible reason.** Each lesson begins with the old code failing in front of the learner
   (an error, or too few plates). The lesson is the fix.
5. **`if` / `else` come first, loops late.** No `for` before the block works; `while` is in the second layer.
6. **The picture is the test.** A lesson is passed when the heaps hold what the order sign says, on every belt it is
   tested with.

## The block

Top-down view. The grabber stands in the middle and can face four sides.

```
                 [ coal bunker ]            north
                       |  chute
   belt  ──▶  ( grabber )  ──▶  [ smelter ]  ──▶  plates
   west                          east
                    (floor)                 south
```

| Thing | What the learner sees |
| --- | --- |
| Belt (west) | A queue of items moving towards the grabber: ore (round ochre pebbles) and coal (black angular lumps with a light glint). Both are bigger than a fingertip on a phone and keep their shape in dark mode. The arm has a yellow arrow that points where the grabber faces. |
| Grabber (middle) | An arm that faces west, north, east or south and holds nothing or one item. Starts facing the belt, empty. |
| Coal bunker (north) | Drawn from the first lesson on, empty until G3 uses it. Takes coal. A chute leads to the smelter. Its heap is the smelter's coal heap. |
| Smelter (east) | An ore hatch with a visible ore heap, the coal heap, and a stack of finished plates behind it. |
| Labels | Each heap has a count label. In the grabber lessons it is plain words (`Erz: 2`, `Kohle: 1`), because the learner has no variables yet. From the first smelter lesson on it is the Python variable (`ore = 2`, `coal = 1`). |
| Order sign | What the lesson asks for: "Order: 1 plate". Green only when the order is met at the end of a passed run; never green next to an error. |

### Commands and variables

| Name | Kind | What it does | First used |
| --- | --- | --- | --- |
| `grab()` | command | The grabber closes. Facing the belt with an item at the front: it holds that item now. | G1 |
| `turn()` | command | A quarter turn clockwise: west → north → east → south → west. | G1 |
| `drop()` | command | The grabber opens. What it holds goes to the place it faces. | G1 |
| `is_coal()` | question | `True` if the grabber holds coal, else `False` (also when it holds nothing). | G3 |
| `smelt()` | command | The smelter burns 2 ore and 1 coal and puts 1 plate on the stack. | S1 |
| `ore` | variable | How many ore lie in the smelter's ore heap. Kept up to date by the factory, read-only. | S1 |
| `coal` | variable | How many coal lie in the coal heap. Kept up to date by the factory, read-only. | S1 |
| `n` | variable | How many plates are ordered. Set by the lesson, read-only. | B2 |

Function names are English and the UI is German / English, as in Robot Battler.

### What happens when a command does not fit

Two rules, so the learner can predict which applies.

**Wasted motion is harmless.** It is shown, nothing else happens, the program goes on:

* `grab()` when the grabber does not face the belt, the belt is empty, or it already holds something.
* `drop()` when the grabber holds nothing.

**Wrong or missing material is an error.** The run stops at that line with a message, the machine shows it (smoke, red
lamp), and nothing is damaged: the next run starts fresh.

| Error | Message (en) |
| --- | --- |
| Coal dropped into the ore hatch | "Coal does not belong in the ore hatch (line 4)." |
| Ore dropped into the coal bunker | "Ore does not belong in the coal bunker (line 4)." |
| `smelt()` with fewer than 2 ore | "The smelter needs 2 ore, it has 1 (line 1)." |
| `smelt()` with no coal | "The smelter needs 1 coal, it has 0 (line 2)." |
| `drop()` towards the belt | "Towards the belt there is no place for it to fall (line 3)." |
| `drop()` towards the floor side | "On the floor in the south there is no place for it to fall (line 5)." |

The reason is shown once: in the verdict below the code. The caption during playback only says that the program stops
there. Python errors (syntax, unknown name, a loop that never ends) use the friendly messages Robot Battler already has.
Assigning to `ore`, `coal` or (where the lesson has it) `n` is rejected before the run: '"ore" is counted by the
factory itself, you cannot change it.' So is a `def` or a parameter named like a command the lesson has or, in the
block lessons, like a function of "Your machines"; G4 may not define `make_plate` and S4 may not define `feed`.

### How a program is run

A lesson runs the learner's program in one of two ways. The lesson text says which.

* **Once.** The program runs one time from the first line to the last.
* **Once per item.** The factory starts the program again for every item: for each item that reaches the front of the
  belt (grabber lessons), or each time an item lands in the smelter (smelter lessons). Variables do not survive from
  one start to the next; `ore` and `coal` do, because the factory keeps them.

A lesson is tested on several **belts** (different items or a different order). The first belt is played step by step.
The others are then run without animation; if one fails, that one is played, its number is shown ("Band 2 von 3"), and
the verdict says "It fails on this belt". The lesson is passed only if every belt passes.

**The verdict** is the stronger block under the code. When the order is not met and the judge has no reason (no
structural check, no error), it names what is short on the played belt: the items still on the belt ("Still on the
belt: 1 ore. The grabber did not take it."), else the heap or the plates that are short ("The smelter has made 0 plates,
the order needs 1 plate."). A missing `def`, a `def` that is never called, or a missing `make_plates(n)` is named by its
own sentence.

**Playback** starts paused on the block before the start. ▶ plays, → steps one line or one command, "To the end" jumps,
"Zum Ergebnis" skips to the verdict. ↺ on the first step goes back to the code; later it starts the program over. Lines
that only define a function (`def`) and a line that repeats the line before it are not steps of their own.
On a phone the block stays on screen while the highlighted line shows: the code listing scrolls inside its own box.

## The lesson graph

```
                          [B3 def make_plates(n)]
                                    ▲
                          [B2 n plates: for]
                                    ▲
                          [B1 the block: one plate]
                            ▲                  ▲
                 [G4 def feed()]       [S4 def make_plate(ore, coal)]
                            ▲                  ▲
                 [G3 coal or ore: if]  [S3 no coal: and]
                            ▲                  ▲
                 [G2 and back again]   [S2 too fast: if]
                            ▲                  ▲
                 [G1 grab and throw]   [S1 the smelter]
```

G1 and S1 are open from the start, so the learner chooses which machine to begin with. A locked lesson stays on the map as a focusable node (`aria-disabled`) that says what it needs ("braucht G4 + S4"); it does not open. A lesson opens when every lesson
directly below it is solved.

## Grabber lessons

### G1: Grab and throw (Greifen und werfen)

* **Needs:** nothing. **Run:** once. **Belt:** one ore.
* **Order:** 1 ore in the smelter.
* **New:** calling commands; lines run top to bottom.
* **Editor starts:** empty.

```python
grab()
turn()
turn()
drop()
```

Typical mistakes are all visible: one `turn()` drops the ore into the coal bunker (error), three drop it on the floor
side (error), a missing `grab()` moves an empty arm (harmless, order not met).

### G2: And back again (Und wieder zurück)

* **Needs:** G1. **Run:** once per item. **Belt:** two ores.
* **Order:** 2 ore in the smelter.
* **New:** the program is started again for each item, so it must end where it began.
* **Editor starts:** the learner's G1 code.
* **What breaks first:** on the second start the grabber still faces the smelter, grabs air, and the second ore stays
  on the belt.

```python
grab()
turn()
turn()
drop()
turn()
turn()
```

### G3: Coal or ore (Kohle oder Erz)

* **Needs:** G2. **Run:** once per item.
* **Belts:** `ore coal ore`, `coal ore ore`, `ore ore coal`.
* **Order:** 2 ore in the smelter, 1 coal in the smelter (via the bunker). The bunker is in the north from G1 on; this is the lesson that sends coal into it.
* **New:** `if` / `else`, and the question `is_coal()`.
* **Editor starts:** the learner's G2 code.
* **What breaks first:** the G2 code throws coal into the ore hatch: error.

```python
grab()
if is_coal():
    turn()
    drop()
    turn()
    turn()
    turn()
else:
    turn()
    turn()
    drop()
    turn()
    turn()
```

Other correct shapes pass too (the picture is the test), for example one shared first `turn()` before the `if`.

### G4: The grabber gets a name (Der Greifer bekommt einen Namen)

* **Needs:** G3. **Run:** once per item. **Belts:** as G3.
* **Order:** as G3, and the program must define `feed` and do its work by calling it.
* **New:** `def`: a command of your own.
* **Editor starts:** the learner's G3 code.

```python
def feed():
    grab()
    if is_coal():
        turn()
        drop()
        turn()
        turn()
        turn()
    else:
        turn()
        turn()
        drop()
        turn()
        turn()

feed()
```

* **Check:** besides the order, `feed` is defined, the top level calls it, and no machine command runs outside
  `feed()` (neither at the top level nor in a helper the top level calls). One call of `feed()`, with only `feed` and
  the helpers it calls, must move exactly one item to its right place and leave the grabber empty and facing the belt
  (the block lessons rely on this); a variable of the top level that `feed` uses is named as the reason. If the order
  is not met and `feed` is missing or never called (for example the call is indented under the `def`), the message
  says that.
* **Reward:** the grabber gets a name plate `feed` and a `feed()` button appears in the toolbox.

## Smelter lessons

In these lessons the learner does not program the grabber. A grey "factory grabber" feeds the smelter by itself, so the
smelter branch can be played before, after or alongside the grabber branch. The name plates follow the lesson: `feed()`
shows on the grabber and block lessons, `make_plate()` on the smelter and block lessons.

### S1: The smelter (Der Schmelzofen)

* **Needs:** nothing. **Run:** once. **Start:** `ore = 2`, `coal = 3`.
* **Order:** 1 plate.
* **New:** the heap labels are variables; a command changes them.
* **Editor starts:** empty.

```python
smelt()
```

Two lumps leave the ore heap, one leaves the coal heap, a plate appears; the labels go to `ore = 0`, `coal = 2`.
One line only, on purpose: the lesson is for reading the heaps and labels, and it is the code that breaks in S2.

### S2: Too fast (Zu schnell)

* **Needs:** S1. **Run:** once per item that lands. **Start:** `ore = 0`, `coal = 3`.
* **Arriving:** four ores, one after the other.
* **Order:** 2 plates.
* **New:** `if` with a comparison, `>=`.
* **Editor starts:** the learner's S1 code.
* **What breaks first:** after the first ore the S1 code smelts with `ore = 1`: error.

```python
if ore >= 2:
    smelt()
```

### S3: No coal (Keine Kohle)

* **Needs:** S2. **Run:** once per item that lands. **Start:** `ore = 0`, `coal = 0`.
* **Arriving (belts):** `ore ore coal ore coal ore`, `coal ore ore ore ore coal`.
* **Order:** 2 plates.
* **New:** `and`: two conditions at once.
* **Editor starts:** the learner's S2 code.
* **What breaks first:** two ores arrive before any coal, and the S2 code smelts cold: error.

```python
if ore >= 2 and coal >= 1:
    smelt()
```

### S4: The smelter gets a name (Der Ofen bekommt einen Namen)

* **Needs:** S3. **Run:** once per item that lands. **Belts:** as S3.
* **Order:** 2 plates, and the program must define `make_plate` with two parameters and do its work by calling it.
* **New:** `def` with parameters: the function is told what it needs.
* **Editor starts:** the learner's S3 code.

```python
def make_plate(ore, coal):
    if ore >= 2 and coal >= 1:
        smelt()

make_plate(ore, coal)
```

* **Check:** besides the order, `make_plate` is defined with two parameters and called from the top level, and
  `smelt()` runs only inside `make_plate` (not at the top level, not in a helper the top level calls). On its own,
  `make_plate(2, 1)` on heaps of 2 ore and 1 coal makes exactly one plate; `make_plate(1, 1)` and `make_plate(2, 0)` on
  full heaps (4 ore, 2 coal) make none and raise no error, so a function that reads the heap labels instead of its
  parameters does not pass. A missing or uncalled `make_plate` is reported as in G4.
* **Reward:** the smelter gets a name plate `make_plate` and a `make_plate(ore, coal)` button appears.

The parameters are only weakly motivated here (the function could read the heap labels itself). They pay off in the
second layer, when two smelters with different heaps share this function.

## Block lessons

Until here the factory called the learner's code. From here the learner calls it. `feed` from G4 and `make_plate`
from S4, with the helpers each of them calls, are shown above the editor as a folded, read-only part "Your machines";
to change one, the learner goes back to its lesson. A helper both lessons have word for word stands there once; two
different helpers with the same name are reported, with the advice to rename one in G4 or S4.
The toolbox holds only `feed()`, `make_plate(ore, coal)` and what the lesson adds; the five given commands are not
allowed at the top level.

The belt delivers in **groups of two ore and one coal**, in any order inside a group. So one plate is always three
feeds.

### B1: The block (Der Block)

* **Needs:** G4 and S4. **Run:** once.
* **Belts:** `ore coal ore`, `coal ore ore`, `ore ore coal`.
* **Order:** 1 plate.
* **New:** using your own functions together.
* **Editor starts:** empty (under "Your machines").

```python
feed()
feed()
feed()
make_plate(ore, coal)
```

The learner does not think about coal here: the `if` they wrote in G3 sorts it inside `feed()`.

### B2: n plates (n Platten)

* **Needs:** B1. **Run:** once.
* **Belts:** `n = 2` with three groups, `n = 3` with four groups: one group more than ordered. The order sign shows `n`.
* **Order:** `n` plates.
* **New:** `for i in range(n):`.
* **Editor starts:** the learner's B1 code.
* **What breaks first:** the B1 code makes one plate, the order is two.

```python
for i in range(n):
    feed()
    feed()
    feed()
    make_plate(ore, coal)
```

Writing the four lines out cannot pass: `n` differs between the belts, every belt has material for one plate more
than ordered, and the order is exact. Three copies make three plates where two are ordered.

### B3: The block gets a name (Der Block bekommt einen Namen)

* **Needs:** B2. **Run:** once. **Belts:** as B2.
* **Order:** `n` plates, and the program must define `make_plates` with one parameter and call it.
* **New:** a function with a parameter that calls the learner's other functions.
* **Editor starts:** the learner's B2 code.

```python
def make_plates(n):
    for i in range(n):
        feed()
        feed()
        feed()
        make_plate(ore, coal)

make_plates(n)
```

* **Check:** besides the order, `make_plates` is defined with one parameter and called from the top level, and the top
  level calls neither `feed()` nor `make_plate()` itself. On its own, `make_plates(2)` on a belt whose `n` is 3, and
  `make_plates(3)` where `n` is 2, make exactly 2 and 3 plates, so a function that ignores its parameter and reads `n`
  does not pass. A top-level loop of `make_plates(1)` passes: the function itself is right.
* **Reward:** the whole block gets a name plate; `make_plates(n)` is the one command the next layer starts with.

## Carrying code forward

* A lesson stores the learner's last text and their last **passing** text.
* A lesson's editor starts with the passing text of the lesson below it in its branch (G2 from G1, S3 from S2, B2 from
  B1). Once the learner has typed in a lesson, their own text there is kept.
* "Your machines" in the block lessons always shows the functions of the current passing G4 and S4 code. If the
  learner solves G4 again in another way, the block lessons use the new `feed`.
* The strict checks in G4 and S4 (one call = one item / one plate, no leftovers) are what guarantees that a passing
  function works in every lesson above it.

## Second layer (sketch, not part of the first version)

| Lesson | Needs | New | Idea |
| --- | --- | --- | --- |
| Garbage on the belt | G3 | `elif` | A third kind of item and a bin in the south: three-way sorting. |
| The untidy belt | B1 | `while` | No neat groups any more: `while ore < 2 or coal < 1: feed()`. |
| Two blocks | B3 | reuse across blocks | An iron block and a copper block side by side. A program belongs to exactly one block; the functions are shared. Copper needs 3 ore, so `make_plate` gets a parameter `need`. |
| The gear press | Two blocks | a new machine | Takes plates from both blocks; its lessons start from `make_plates(n)`. |

The factory floor becomes the lesson map in this layer: every solved lesson leaves its machine standing, and the next
free plot shows what can be built.

## Implementation notes

What exists and can be reused:

* **Interpreter:** `web/src/robot/py/` runs real Python for the needed subset (`if`/`elif`/`else`, `and`, `def` with
  parameters, `for`, `while`), pauses at host actions (`Program.runUntilAction`) and emits a line trace. Commands are
  host functions that return an `ActionRequest`; `is_coal()` is a plain host function. `n` is set in
  `Program.module.vars` at the start, `ore` and `coal` by the host after every action.
* **Stepping view:** the pattern of `robot/stepper.ts` and `views/robot-viewer.ts` (one step per executed line,
  highlighted line, play / pause / step / speed). `factory/beats.ts` `tidyBeats` drops the `def` steps and repeats.
* **Verdict hints:** `factory/friendly.ts` `orderHint` (what is short on the played belt, when the judge gives no reason).
* **Editor:** `views/robot-editor.ts` (text area, line numbers, suggestion strip) with the lesson's toolbox as chips.
* **Errors:** `robot/friendly.ts` for Python errors; the five factory errors get their own `factory.err.*` texts.
* **Progress and points:** the `gameData` storage pattern and the points events of the other games.

What is new:

| Path | What |
| --- | --- |
| `web/src/factory/world.ts` | The pure simulation: belt, grabber, heaps, the two rules for misfitting commands. |
| `web/src/factory/run.ts` | Runs a program on a belt ("once" / "once per item"), records one frame per command. |
| `web/src/factory/lessons.ts` | The eleven lessons: needs, run mode, belts, order, starting code, toolbox, checks, reference solution. |
| `web/src/factory/game.ts` | Progress: solved lessons, last and passing text per lesson, unlocking by `needs`. |
| `web/src/factory/scene.ts` | The SVG block: belt, rotating grabber, heaps with labels, name plates, error states. |
| `web/src/views/factory.ts` | The lesson map (the graph) and the lesson page. |

Tests, following Robot Battler's rule: every lesson is passed by its reference solution on every belt, and **not**
passed by the reference solution of the lesson below it (that is the "what breaks first" promise). Plus unit tests for
the world rules and an e2e run through all eleven lessons.

## Open questions

1. **Name** of the game, de and en.
2. **Home:** listed from the start, or hidden like Robot Battler until it is ready?
3. **Function names** `feed`, `make_plate`, `make_plates`: given by the lesson (as above), or may the learner choose?
   Given names keep the block lessons simple.
4. **S1** is a one-line lesson. Keep it, or start the smelter branch at S2 with `smelt()` already in the editor?
5. **`drop()` towards the belt or the floor** is an error above. The alternative is "the item lies on the floor and the
   order is not met".
6. **Plates as a variable:** should the plate stack also have a label (`plates = 1`)? Nothing in the first layer needs
   it; the untidy-belt lesson might (`while plates < n`).
