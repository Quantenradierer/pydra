# Factory, second layer

The next six lessons after the ten in [`factory.md`](factory.md). They replace the table "Second layer (sketch)" there.
Everything in `factory.md` (principles, the block, the two misfit rules, run modes, belts, carrying code forward) stays
valid; this file only lists what is added.

**Status: design only. Nothing is built.** The first layer is being built from `factory.md`.

## What the layer teaches

| Branch | Lessons | New Python | What appears in the factory |
| --- | --- | --- | --- |
| Garbage | T1 | `elif` | A third kind of item and a bin in the south. |
| Untidy belt | W1, W2, W3 | `while`, `or`, a loop inside a loop | Belts without neat groups. |
| Copper | C1, C2 | one function used on two machines | A second block that smelts copper. |

The gear press is not in this layer. It is the start of the third one (see the end of this file).

## The lesson graph

Lessons of the first layer are in round brackets.

```
                         [C2 the copper block]
                           ▲               ▲
          [W3 n plates, untidy]      [C1 the copper smelter]
             ▲            ▲                    ▲
        (B3)      [W2 coal comes late: or]   (S4)
                          ▲
                  [W1 the untidy belt: while]
                     ▲             ▲
                   (B1)     [T1 garbage: elif]
                                   ▲
                                 (G4)
```

T1 and C1 open as soon as G4 and S4 are solved, so a learner who is stuck in the block lessons still has something
new to do.

## What is added to the block

| Thing | What the learner sees | From |
| --- | --- | --- |
| Garbage | A third kind of item on the belt: a crumpled green lump. | T1 |
| Bin (south) | Stands where the floor was. It takes anything and counts what is in it. | T1 |
| Copper ore | Orange lumps. Only on the belt of a copper block. | C1 |
| Copper block | A second block with its own belt, grabber, bunker and smelter. Its smelter is copper-coloured. | C1 |
| Sign `need` | A sign on every smelter: `need = 2` on the iron smelter, `need = 3` on the copper smelter. | C1 |

### New commands and variables

| Name | Kind | What it does | First used |
| --- | --- | --- | --- |
| `is_ore()` | question | `True` if the grabber holds ore (iron or copper), else `False`. | T1 |
| `need` | variable | How many ore this smelter burns for one plate. Set by the factory, read-only. | C1 |

`smelt()` burns `need` ore and 1 coal. On the iron smelter nothing changes.

### Misfit rules

The two rules stay. Additions:

| Case | What happens |
| --- | --- |
| Garbage dropped into the ore hatch | Error: "Garbage does not belong in the ore hatch (line 9)." |
| Garbage dropped into the coal bunker | Error: "Garbage does not belong in the coal bunker (line 4)." |
| Ore or coal dropped into the bin | No error. The bin takes it, the item is gone, and the order cannot be met any more. |
| `drop()` towards the south | From T1 on the bin stands there, so it is no longer the error "nothing here". |
| `smelt()` on the copper smelter with 2 ore | Error: "The smelter needs 3 ore, it has 2 (line 3)." (the old message, with `need`) |
| Assigning to `need` | Rejected before the run, like `ore` and `coal`. |
| A `while` that never ends because the belt is empty | The run stops: "The belt is empty, but the loop is still waiting (line 2)." |

The last one is shown after the grabber has grabbed air three times in a row inside the same loop, so the learner sees
why before the message appears.

### Which block a program runs on

A program always runs on exactly **one** block. `ore`, `coal`, `need` and `n` are the labels of that block, and
`grab()`, `turn()`, `drop()`, `smelt()` move the machines of that block. A lesson that tests on two blocks runs the
same program text once on each, like it runs it on several belts. No code ever reaches from one block into the other.

### Which version of a function a lesson uses

In this layer `feed` and `make_plate` each get a second version (T1, C1). "Your machines" in a lesson shows, for each
function, the passing version from the **highest lesson below it in the graph** that defines the function:

| Lesson | `feed` from | `make_plate` from |
| --- | --- | --- |
| B1, B2, B3 | G4 | S4 |
| W1, W2, W3 | T1 | S4 |
| C2 | T1 | C1 |

## Garbage

### T1: Garbage on the belt (Müll auf dem Band)

* **Needs:** G4. **Run:** once per item.
* **Belts:** `ore garbage coal ore`, `garbage coal ore ore`, `ore ore coal garbage`.
* **Order:** 2 ore in the smelter, 1 coal in the bunker, 1 garbage in the bin.
* **New:** `elif`, and the question `is_ore()`. The bin appears in the south.
* **Editor starts:** the learner's G4 code.
* **What breaks first:** `is_coal()` is `False` for garbage, so the `else` part throws it into the ore hatch: error.

```python
def feed():
    grab()
    if is_coal():
        turn()
        drop()
        turn()
        turn()
        turn()
    elif is_ore():
        turn()
        turn()
        drop()
        turn()
        turn()
    else:
        turn()
        turn()
        turn()
        drop()
        turn()

feed()
```

* **Check:** as G4. One call of `feed()` moves exactly one item to its right place and leaves the grabber empty and
  facing the belt.
* **Reward:** the bin stays in the block for all lessons above.

This lesson adds two words (`elif` and `is_ore()`), which breaks the rule of one word per lesson. `is_ore()` is the
twin of `is_coal()` and a third kind of item cannot be told apart without a second question. See open question 1.

## The untidy belt

From here the belt has garbage in it and the items come in any order. "Three feeds are one plate" is no longer true.
All three lessons run **once** and use `feed` from T1.

### W1: The untidy belt (Das unordentliche Band)

* **Needs:** B1 and T1.
* **Belts:** `garbage ore coal ore`, `ore garbage garbage coal ore`, `coal ore ore`.
* **Order:** 1 plate, no empty grab.
* **New:** `while`: repeat as long as something is true. (And `<`, the opposite of the `>=` from S2.)
* **Editor starts:** the learner's B1 code.
* **What breaks first:** three feeds bring 1 ore, 1 coal and a piece of garbage. `make_plate` does nothing, no plate.

```python
while ore < 2:
    feed()
make_plate(ore, coal)
```

On these belts the coal always comes before the second ore, so the learner only has to watch one heap.

* **Check:** the order sign reads "1 plate, no empty grab". The belts need four, five and three feeds, and each belt
  ends with the item that completes the plate. So a fixed number of `feed()` lines is either too few on one belt or
  grabs air on another. An empty grab stays harmless (no error), but the sign stays red and says "The grabber grabbed
  air: the belt was already empty". W2 and W3 use the same check.

### W2: The coal comes late (Die Kohle kommt spät)

* **Needs:** W1.
* **Belts:** `ore ore coal`, `ore garbage ore garbage coal`, `coal ore garbage ore`.
* **Order:** 1 plate, no empty grab.
* **New:** `or`: go on as long as one of two things is still missing.
* **Editor starts:** the learner's W1 code.
* **What breaks first:** the loop stops after the second ore, the coal is still on the belt, no plate.

```python
while ore < 2 or coal < 1:
    feed()
make_plate(ore, coal)
```

This is the mirror of S2 → S3: there the smelter waited with `and` until both were there, here the grabber goes on
with `or` while one is missing. The lesson text says so and shows both lines next to each other.

### W3: n plates from the untidy belt (n Platten vom unordentlichen Band)

* **Needs:** W2 and B3.
* **Belts:** `n = 2`: `ore garbage ore coal coal garbage ore ore`; `n = 3`: `coal ore ore garbage ore coal ore garbage
  coal ore ore`.
* **Order:** `n` plates, no empty grab.
* **New:** a loop inside a loop.
* **Editor starts:** the learner's B3 code.
* **What breaks first:** three feeds per plate are not enough any more: too few plates.

```python
def make_plates(n):
    for i in range(n):
        while ore < 2 or coal < 1:
            feed()
        make_plate(ore, coal)

make_plates(n)
```

The learner replaces the three `feed()` lines with the two lines they wrote in W2. Coal that is left over from one
plate stays in the bunker and counts for the next; the labels show it.

## Copper

### C1: The copper smelter (Der Kupferofen)

* **Needs:** S4. **Run:** once per item that lands, on two smelters. A grey factory grabber feeds them, as in S1–S4.
* **Belts:** iron smelter (`need = 2`): `ore ore coal ore coal ore`; copper smelter (`need = 3`):
  `ore ore coal ore ore coal ore ore`.
* **Order:** 2 plates on each smelter.
* **New:** the variable `need`, and a third parameter. One function for two machines.
* **Editor starts:** the learner's S4 code.
* **What breaks first:** the iron smelter works. On the copper smelter the code smelts with 2 ore: error "The smelter
  needs 3 ore, it has 2".

```python
def make_plate(ore, coal, need):
    if ore >= need and coal >= 1:
        smelt()

make_plate(ore, coal, need)
```

* **Check:** besides the order, `make_plate` has three parameters and is called from the top level. On a smelter with
  the matching heaps: called with (3, 1, 3) and with (2, 1, 2) it makes exactly one plate; called with (2, 1, 3) it
  makes none and raises no error.
* **Playback:** the iron smelter is played first, then the copper smelter, with the same code visibly unchanged
  between the two.
* **Reward:** both smelters carry the name plate `make_plate`.

Here the parameters from S4 pay off: the function does not ask which smelter it stands at, it is told.

### C2: The copper block (Der Kupferblock)

* **Needs:** W3 and C1. **Run:** once, on two blocks.
* **Belts:** iron block, `n = 2`: `ore garbage ore coal ore coal ore`; copper block, `n = 2`:
  `ore coal ore garbage ore ore ore coal ore`.
* **Order:** `n` plates on each block.
* **New:** nothing. The learner's own program runs somewhere else.
* **Editor starts:** the learner's W3 code.
* **What breaks first:** `make_plate` now wants three values: the friendly Python error "make_plate needs 3 values,
  it got 2 (line 5)". After that is fixed, the loop stops at 2 ore on the copper block: too few plates.

```python
def make_plates(n):
    for i in range(n):
        while ore < need or coal < 1:
            feed()
        make_plate(ore, coal, need)

make_plates(n)
```

* **Playback:** both blocks are shown side by side and run at the same time, each with its own highlighted line in
  the same program text. This is the one place where two blocks move at once; every label belongs visibly to its own
  block.
* **Reward:** the factory floor shows two working blocks and two plate stacks, iron and copper.

`feed()` needs no change: `is_ore()` is `True` for copper ore too.

## The factory floor as lesson map

From this layer on the lesson map is the floor of the factory instead of the graph drawing.

* Every lesson is a plot at a machine: G lessons at the grabber, S lessons at the smelter, T1 at the bin, B and W
  lessons at the block as a whole, C lessons at the copper block.
* A solved lesson leaves its part standing and working (the name plate, the bin, the copper smelter).
* An open lesson is a marked plot with its title; a locked one shows which lessons it needs.
* The map of the first layer (the graph) stays reachable as a list view, for learners who want to see the order.

## Third layer (sketch)

| Lesson | Needs | New | Idea |
| --- | --- | --- | --- |
| The gear press | C2 | a new machine | A press between the two plate stacks: 1 iron plate and 1 copper plate make 1 gear. |
| Enough plates | The gear press | a variable of your own, `+` | The learner counts plates themselves and decides which block has to work next. |
| The order book | Enough plates | lists | Orders as a list: `for order in orders:`. |

## Tests

As in the first layer: every lesson is passed by its reference solution on every belt and block, and not passed by
the starting code named under "Editor starts" (W1 by the B1 solution, C2 by the W3 solution, and so on). In addition:

* T1, W1–W3 and C2 with every passing `feed` shape from G3's alternatives.
* The endless-`while` stop on an empty belt, with its message and line.
* C1 and C2: the two blocks never share a heap or a label.

## Open questions

1. **T1 adds two words** (`elif`, `is_ore()`). Accept this, or split it: first a lesson that solves garbage with an
   `if` inside the `else`, then one that rewrites it with `elif`? The split has no failure that motivates its second
   lesson.
2. **Ore in the bin** is not an error here (the bin takes anything, the order fails). The alternative is an error
   like the other wrong drops.
3. **W1 uses `<`** for the first time. Accept it as the sibling of `>=`, or give it a line in an earlier lesson?
4. **W3 has three levels of indentation** (`def`, `for`, `while`). Keep it, or drop the `def` in W3 and start it
   from the B2 code?
5. **C2 plays two blocks at once.** Is that understandable, or should the blocks be played one after the other like
   the smelters in C1?
6. **The floor map** replaces the graph in this layer. Or keep the graph and use the floor only as a picture of what
   is built?
