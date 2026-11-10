# Robot Battler: every challenge (rb28 redesign)

16 challenges in 6 chapters, in play order (`web/src/robot/content/chapter0.ts` ... `chapter5.ts`). One list, one fight per
challenge, one script that grows. This file is the design list: chapter -> challenge -> the ONE new idea -> why the script of
the challenge before (or the naive script) loses. `challenges.test.ts` proves every row: the reference solution wins with the
default gear, and the "loses" script of the row does not.

## Design rules

* **Wide arenas.** Every arena is 5 rows high and 7-10 tiles wide and the robot starts on the left looking east. On a 360 px
  phone a tile is 32-46 px (it was 15-26 px in the 8x8 / 8x14 arenas), so robots, walls and the HP number are readable and the
  arena is only about 180 px high.
* **Chain inside a chapter.** `solution[n]` contains `solution[n-1]` line by line (indentation aside). A new chapter is a new
  arena and a new, short script.
* **At most 3 enemies**, never "the same dummy once more": a new enemy always comes with a new behaviour, a wall or a new
  code construct. Hit points differ and mean something (a walker has 2, a standing tank 6, a regenerator 3-4).
* **The fight needs the construct.** Where the arena itself can force it, it does (a wall, the blaster's range of 5, an enemy
  that walks out of sight, one that heals, one that shoots back). A fight is deterministic, so three kinds of idea cannot be
  forced by the arena alone; they get one visible rule each, stated in the task sentence:
  * *shorter code* (argument, `for`, `def`, parameter): a **line limit** (`maxLines`). The unrolled script wins the fight but
    is too long.
  * *looking before shooting* (`if`, shield checks): **no shot may miss** (`noMiss`). Blind shooting hits the enemy too.
  * the first `while` (`scout`): the rule **uses `while`**; `forward(2)` would do the same in this one fight.
* **Mechanics, one at a time:** wall (0.4), blaster range (1.1), tank (1.2), shield in a fixed beat (1.3), patroller (2.1),
  regenerator (2.2), patroller with a shield of its own rhythm (2.3), an enemy that walks in and out of range (3.1, 3.2), a
  regenerator out of range (3.3), an enemy that shoots back (3.4), three different shields / healing around the robot (4.1),
  walled lanes (5.1).
* No output, no hints, no review chapters, no certificate. Explicit assignment (`x = ...`) has no challenge of its own: no
  deterministic fight needs it (a literal number always does the same), so variables appear where they are needed, as the loop
  variable and as the parameter `n`.

HP notation: `2p` = 2 HP, patrols; `3s` = periodic shield; `3r` = regenerates 1 HP every 2 rounds; `3x` = shoots back.

## Chapter 0: commands in a row (8x5)

| # | Id | Enemies | The ONE new idea | New in the arena | Why the script before loses |
| --- | --- | --- | --- | --- | --- |
| 0.1 | `first-contact` | 1 | a script is commands in order: `forward()`, `fire()` | a dummy 6 tiles away; the blaster reaches 5 | `fire()` alone does not reach |
| 0.2 | `one-more-line` | 2 | the same command again | 2 HP | one shot leaves it standing |
| 0.3 | `training-dummy` | 2, 3 | `turn_left()`: the robot shoots where it looks | a second dummy to the side | it is never in the line of fire |
| 0.4 | `wall-dummy` | 2, 3, 1 | `turn_right()` and a detour: right, down the next column, right again | **a wall** (2 tiles) right under the start, the third dummy behind it | shots stop at the wall; the old script never gets around it |

## Chapter 1: numbers and for loops (9x5)

| # | Id | Enemies | The ONE new idea | New in the arena | Why the script before loses |
| --- | --- | --- | --- | --- | --- |
| 1.1 | `long-way` | 2 | an argument: `forward(3)` | a dummy 7 tiles away (range 5) | at most 3 lines: `forward()` three times is too long |
| 1.2 | `tank` | 2, 6 | `for i in range(6): fire()` | **a tank** with 6 HP behind the dummy | 1.1 never hits it; six `fire()` lines break the limit of 5 lines |
| 1.3 | `beat` | 2, 6, 3s | a loop body of several lines: `fire()`, `wait()`, `wait()` | **a shield in a fixed beat** (down 1 round, up 2) | 1.2 never turns to it; a loop of plain `fire()` shoots into the shield (no shot may miss) |

## Chapter 2: if / elif / else (8x5)

| # | Id | Enemies | The ONE new idea | New in the arena | Why the script before loses |
| --- | --- | --- | --- | --- | --- |
| 2.1 | `patrol` | 2p | `if see() == "enemy": fire()` / `else: wait()` inside a loop | **a patroller** walking a column of 4 tiles; it crosses the robot's row at irregular times | shooting every round misses (no shot may miss) |
| 2.2 | `flank` | 2p, 3r | `elif see_left() ...: turn_left()` (and back with `see_right()`) | **a regenerator** to the left: it needs shot after shot | 2.1 never turns, the regenerator stays |
| 2.3 | `flicker` | 2ps, 3r | an `if` inside an `if`: `if enemy_shielded(): wait()` | the patroller gets **a shield with a rhythm of its own** (3 rounds against the walk of 6): waiting for a fixed beat does not work | 2.2 fires whenever it sees the walker and hits the shield |

## Chapter 3: while loops (10x5)

| # | Id | Enemies | The ONE new idea | New in the arena | Why the script before loses |
| --- | --- | --- | --- | --- | --- |
| 3.1 | `scout` | 1p | `while see() != "enemy": forward()` | a walker far down the row, out of range | a shot from the start misses; rule: uses `while` |
| 3.2 | `twice` | 2p | a loop around the loop: `for i in range(2):` around walk-and-shoot | the walker has 2 HP and **steps out of range** after the first hit | 3.1 fires once; a second `fire()` right after it goes into the air |
| 3.3 | `healer` | 2p, 4r | `while see() == "enemy": fire()` (as long as it stands) | a regenerator at the end of the hall, out of range | 3.2 stops after two shots and never gets near it |
| 3.4 | `sniper` | 2p, 4r, 3x | a `while` on another sensor: `while see_left() != "enemy": forward()` | **an enemy that shoots back** down its column as soon as it sees the robot | 3.3 stops in front of the dead regenerator |

## Chapter 4: functions (7x5)

| # | Id | Enemies | The ONE new idea | New in the arena | Why the script before loses |
| --- | --- | --- | --- | --- | --- |
| 4.1 | `drill` | 2s, 3s, 4r | `def attack():` written once, called three times | the robot in the middle; a shield (down 1 / up 2) ahead, another shield (1 / 1) to the left, a regenerator behind | the same block written out three times is 18 lines (limit 12); blind volleys miss |

## Chapter 5: parameters (9x5)

| # | Id | Enemies | The ONE new idea | New in the arena | Why the script before loses |
| --- | --- | --- | --- | --- | --- |
| 5.1 | `lanes` | 2, 3r, 3 | a parameter: `def strike(n):` drive `n` in, shoot, drive `n` back | **three walled lanes** that only meet at the start column; the enemies are 8, 7 and 6 tiles in | written out three times it is 17 lines (limit 14); without driving back the robot is stuck in the first lane |

## What was removed, and why

* `two-steps`, `far-dummy`, `sign-dummy`: `d = distance()` / `forward(d - 1)` in front of a dummy that was already in range. The fight did not need it (only a rule did).
* `tank-dummy` .. `dummy-army`: "the same dummy with more HP" and "one more dummy in a corner". Replaced by the tank and the beat shield.
* `peekaboo` .. `sniper` (old Chapter 3): static dummies around the robot; a script without `if` won by counting. The patroller and the flicker shield make looking necessary.
* `far-far-dummy` .. `flicker` (old Chapter 4): the 8x14 hall (15 px tiles on a phone) and the hit counter with `while True` / `break`.
