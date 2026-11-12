# Factory: the sawmill (a second block beside the iron block)

A second block that stands next to the iron block of [`factory.md`](factory.md). It makes **another product**
(planks) with **another machine** (a saw), and has its own eight lessons. The layer above needs both products.

**Status: design only. Nothing is built.**

```
                    [ crate workshop: 2 planks + 1 plate = 1 crate ]      layer above (sketch at the end)
                         ▲                                  ▲
        iron block: make_plates(n)                sawmill: saw_logs(n)
        (factory.md, 11 lessons)                  (this file, 8 lessons)
```

The principles, the two misfit rules, the run modes, testing on several belts and carrying code forward are the same
as in `factory.md` and are not repeated here.

## Few names

The sawmill has the **same grabber** as the iron block, with the same three commands. Only the machine behind it is
different. So the whole sawmill adds **one function and one variable**:

| Name | Iron block | Sawmill |
| --- | --- | --- |
| `grab()`, `turn()`, `drop()` | the grabber | the same grabber, the same commands |
| question | `is_coal()` | none |
| machine command | `smelt()` | `cut()` |
| labels | `ore`, `coal` | `length` |
| set by the lesson | `n` | `n` |

Both blocks together: three grabber commands, one question, two machine commands. Everything else the learner
calls is a function they wrote themselves.

## The sawmill

Top-down view, laid out like the iron block.

```
   belt  ──▶  ( grabber )  ──▶  [ saw bench ]  ──▶  planks
   west                          east  |
                                   (chipper)
```

| Thing | What the learner sees |
| --- | --- |
| Belt (west) | A queue of logs. Every log has a length in marks. |
| Grabber (middle) | The grabber of the iron block. Starts facing the belt, empty. |
| Saw bench (east) | One log lies on it beside a ruler, a blade at the end. Label: `length = 4`. |
| Chipper | Stands under the bench. Rests that are too short for a plank fall into it. |
| Plank stack | Finished planks. A plank is exactly **2 marks** long. |
| Order sign | "Order: 2 planks". Turns green when it is met. |

### Commands and variables

| Name | Kind | What it does | First used |
| --- | --- | --- | --- |
| `grab()`, `turn()`, `drop()` | commands | As in the iron block. | G1 |
| `cut()` | command | The saw cuts one plank (2 marks) off the log on the bench and puts it on the stack. | K1 |
| `length` | variable | How many marks of wood lie on the bench. Kept up to date by the factory, read-only. | K1 |
| `n` | variable | How many logs lie on the belt. Set by the lesson. | M2 |

### What happens when a command does not fit

**Wasted motion is harmless:** `grab()` and `drop()` as in the iron block.

**Wrong or missing material is an error:**

| Error | Message (en) |
| --- | --- |
| A log dropped onto the bench while one lies there | "The saw bench is not free (line 4)." |
| `cut()` with less than 2 marks on the bench | "The saw needs 2 marks of wood, it has 1 (line 1)." |
| `drop()` towards the north, the belt or the floor | "There is nothing here to drop it into (line 3)." |

**Two things the bench does by itself**, so that no extra command is needed:

* **A rest falls through.** Less than 2 marks on the bench are a rest. It falls through a grate into the chipper
  when the program ends or when the next log comes, and `length` is 0 again. Until then the learner sees it lying
  there with its label, for example `length = 1`.
* **A full bench stops the work.** When a program started for one log has ended and 2 marks or more still lie on the
  bench, the next log cannot come. The run ends with "There is still wood for a plank on the bench" and the order is
  not met.

Assigning to `length` is rejected before the run.

### How a program is run

**Once**, or **once per log**: for each log that reaches the front of the belt (grabber lessons), or each log that
lands on the bench (saw lessons). In the saw lessons a grey "factory grabber" brings the logs by itself, as in the
smelter lessons.

A belt is written as a list of logs by length: `2 1 2`.

## The lesson graph

Lessons of the iron block are in round brackets. The grabber is **shared**: the sawmill's one grabber lesson starts
from G2.

```
     (iron block: G3, G4, S1–S4, B1–B3)          [M3 def saw_logs(n)]
                    ▲                                      ▲
                    │                            [M2 n logs: for]
                    │                                      ▲
                    │                            [M1 the sawmill: one log]
                    │                              ▲                ▲
                    │                              │        [K4 def saw_log()]
                    │                              │                ▲
                    │                    [L1 def load()]    [K3 long logs: while]
                    │                              ▲                ▲
                    └──────── (G2) ────────────────┘        [K2 stumps: if]
                                ▲                                   ▲
                              (G1)                          [K1 the saw]
```

K1 is open from the start, beside G1 and S1.

## Grabber lesson

### L1: The loader gets a name (Der Lader bekommt einen Namen)

* **Needs:** G2. **Run:** once per log.
* **Belts:** `4 4`, `2 4 2`.
* **Order:** every log at the saw, and the program must define `load` and do its work by calling it.
* **New:** `def`: a command of your own.
* **Editor starts:** the learner's G2 code. Without any change it already carries the logs: the grabber is the same.

```python
def load():
    grab()
    turn()
    turn()
    drop()
    turn()
    turn()

load()
```

* **Check:** `load` is defined, the top level calls it and uses no grabber command itself. One call of `load()` moves
  exactly one log onto the bench and leaves the grabber empty and facing the belt.
* **Reward:** the sawmill's grabber gets the name plate `load`.

There is no sorting in the sawmill. The `if` of this block is at the saw.

## Saw lessons

### K1: The saw (Die Säge)

* **Needs:** nothing. **Run:** once. **Bench:** one log, `length = 2`.
* **Order:** 1 plank.
* **New:** the ruler and the label `length`; a command changes it.
* **Editor starts:** empty.

```python
cut()
```

The blade comes down, a plank goes to the stack, the label goes from `length = 2` to `length = 0`.

### K2: Stumps (Stummel)

* **Needs:** K1. **Run:** once per log.
* **Logs:** `2 1 2`, `1 2 2`.
* **Order:** 2 planks.
* **New:** `if` with a comparison, `>=`.
* **Editor starts:** the learner's K1 code.
* **What breaks first:** a stump of 1 mark lands on the bench and the K1 code cuts: error.

```python
if length >= 2:
    cut()
```

The stump is not cut, the program ends, and the stump falls through the grate.

### K3: Long logs (Lange Stämme)

* **Needs:** K2. **Run:** once per log.
* **Logs:** `4`, `2 6`, `5 2`.
* **Order:** 2 planks, 4 planks, 3 planks.
* **New:** `while`: an `if` that is asked again and again.
* **Editor starts:** the learner's K2 code.
* **What breaks first:** the K2 code cuts one plank from the log of 4. Half of the log is still on the bench, the
  work stops: too few planks.

```python
while length >= 2:
    cut()
```

The learner changes one word. The label counts down `4`, `2`, `0` while the same line runs again. The log of 5 leaves
a rest of 1, which falls through. Writing `cut()` several times cannot pass: the logs need between one and three
cuts, and a cut too many is an error.

### K4: The saw gets a name (Die Säge bekommt einen Namen)

* **Needs:** K3. **Run:** once per log. **Logs:** as K3.
* **Order:** as K3, and the program must define `saw_log` and do its work by calling it.
* **New:** `def` (again, or for the first time if the learner started with the saw).
* **Editor starts:** the learner's K3 code.

```python
def saw_log():
    while length >= 2:
        cut()

saw_log()
```

* **Check:** `saw_log` is defined and called from the top level. One call makes as many planks as the log allows. With
  a stump or an empty bench it does nothing and raises no error (the sawmill lessons rely on this).
* **Reward:** the saw gets the name plate `saw_log`.

`saw_log` has no parameter on purpose. A parameter `length` would hide the label: the loop would test its own copy,
which never changes, and never end.

## Sawmill lessons

From here the learner calls their own functions. `load` and `saw_log` are shown above the editor as the folded,
read-only part "Your machines". The given commands are not allowed at the top level. All three lessons run **once**.

### M1: The sawmill (Das Sägewerk)

* **Needs:** L1 and K4.
* **Belts:** `4`, `5`.
* **Order:** 2 planks.
* **New:** using your own functions together.
* **Editor starts:** empty (under "Your machines").

```python
load()
saw_log()
```

### M2: n logs (n Stämme)

* **Needs:** M1.
* **Belts:** `n = 2`: `5 4`; `n = 3`: `4 1 2`.
* **Order:** all `n` logs gone from the belt; 4 planks, 3 planks.
* **New:** `for i in range(n):`.
* **Editor starts:** the learner's M1 code.
* **What breaks first:** the M1 code handles one log, the others stay on the belt.

```python
for i in range(n):
    load()
    saw_log()
```

On the second belt the stump of 1 lies on the bench, `saw_log()` cuts nothing, and the stump falls through when the
next log comes. Nothing breaks, because the learner's `while` in `saw_log` already asks before it cuts.

### M3: The sawmill gets a name (Das Sägewerk bekommt einen Namen)

* **Needs:** M2. **Belts:** as M2.
* **Order:** as M2, and the program must define `saw_logs` with one parameter and call it.
* **New:** a function with a parameter (again, if the learner has done the iron block).
* **Editor starts:** the learner's M2 code.

```python
def saw_logs(n):
    for i in range(n):
        load()
        saw_log()

saw_logs(n)
```

* **Reward:** the whole sawmill gets a name plate. `saw_logs(n)` is the command the layer above starts with.

## The layer above (sketch)

A workshop behind both blocks, fed by the plate stack and the plank stack. It adds one command, `nail()`, and the
stack labels `plates` and `planks`.

| Lesson | Needs | New | Idea |
| --- | --- | --- | --- |
| The crate | B3 and M3 | `nail()` | 1 crate from 2 planks and 1 plate. Both stacks are filled already. |
| Not enough planks | The crate | calling both blocks from one program | The stacks start empty: `make_plates(1)`, `saw_logs(1)`, then `nail()`. |
| Until it is enough | Not enough planks | `while` across blocks | Logs differ, so nobody knows how many are needed: `while planks < 2: saw_logs(1)`. |
| n crates | Until it is enough | a calculation, `*` | `while planks < 2 * n:`. |

## How this fits the other files

* `factory.md`: the iron block. Unchanged.
* `factory-layer2.md` (garbage, untidy belt, copper): side branches inside the iron block, not needed for the crate
  workshop. It adds `is_ore()` and `need`; if names are to stay few, that file needs the same pass as this one.

## Implementation notes

The grabber, its three commands, the run modes, frames, judging and "Your machines" come from the iron block's
engine. New are the saw bench (with `length`, the grate and the full-bench stop), logs as belt items with a length, and the
eight lessons. Whether this needs a small shared "block" interface in `web/src/factory/` is
decided when the iron block's engine is finished and reviewed.

Tests as for the iron block: each lesson is passed by its reference solution on every belt and not by the starting
code named under "Editor starts"; every rule in the tables above; `saw_log()` on a stump and on an empty bench.

## Open questions

1. **Product:** planks from a sawmill, crates above. Or another pair?
2. **`while` is the third saw lesson.** It comes after `if` and is the same line with one word changed. Late enough,
   or should it wait for the layer above?
3. **No `if` / `else` in the sawmill.** With `is_rotten()` gone, `else` is taught only in the iron block (G3). Fine,
   or should the saw get an `else` back?
4. **K1 and K4** are small (one line; `def` a second time). Keep them for learners who start with the saw?
5. **`factory-layer2.md`:** keep as side branches, cut its names down too, or drop it?
