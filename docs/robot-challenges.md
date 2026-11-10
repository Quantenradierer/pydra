# Robot Battler: every challenge

21 challenges in 5 chapters, in play order (`web/src/robot/content/chapter0-4.ts`). There are no review chapters (Practice Field, Exams) and no certificate: they were
padding (12 challenges, 2 scripts). The player keeps **one script** that grows; `solution[n]` contains `solution[n-1]` (`chain.test.ts`).
Rounds are what the reference solution needs with the default gear (light chassis, wheels, blaster, eyes); damage is the HP the robot loses. HP of an enemy: `2p` = 2 HP, patrols;
`2s` = 2 HP, periodic shield; `4r` = 4 HP, regenerates; `2x` = 2 HP, shoots back.

| Id | Enemies (HP, behaviour) | The ONE new code construct | The ONE new arena element / behaviour | Why this is a battle, not an exercise | Rounds / dmg |
| --- | --- | --- | --- | --- | --- |
| `first-contact` | 1 | `forward()`, `fire()` | - | Walk up to the target and shoot it. | 2 / 0 |
| `one-more-line` | 2 | the same call twice | enemy with 2 HP | One shot does not kill; fire again. | 3 / 0 |
| `training-dummy` | 2, 3 | `turn_right()` | a second enemy beside you | It stands to your side: you must face it before you can hit it. | 7 / 0 |
| `wall-dummy` | 2, 3 | `turn_left()` (a detour: left, right, right, left) | **a wall** between you and the 3 HP dummy; shots bounce off | You cannot shoot through cover, so you drive around it. | 19 / 0 |
| `status-report` | 2 | `say()` | - | The robot reports "Target locked" on its display before it fires (HQ log). Nothing is said to the enemy. | 4 / 0 |
| `far-dummy` | 2, 1 | `forward(2)` (an argument) | an enemy out of range | The second target is 6 tiles away, the blaster reaches 5: close in by an exact number of tiles. | 7 / 0 |
| `sign-dummy` | 2, 1, 3 | `d = distance()`, `forward(d - 1)` (variable, arithmetic) | enemy to the side at an unknown distance | Range finder: measure, then close in to just in front of it. | 14 / 0 |
| `range-report` | 2, 1, 3 | `str()`, `"Distance: " + str(d)` | - | The measured range goes into the log line (a spotter's report with a real number in it). | 14 / 0 |
| `tank-dummy` | 3 | `for i in range(3): fire()` | an enemy with 3 HP | A sturdy target needs the same shot again and again: a loop. | 7 / 0 |
| `patrol-dummy` | 3, 2p | a loop that runs more often than the target has HP | **a patrolling enemy** (walks column 7, rows 4-6) | It is in your line only half of the time, so shots miss: the loop has to outlast it (`uses: for`). | 12 / 0 |
| `corner-dummy` | 3, 2p, 4 | a loop that moves the robot (`for j in range(3): forward()`) | an enemy in a far corner, in none of your lines | You have to walk to it; walking is the same step repeated. | 24 / 0 |
| `dummy-army` | 6, 2p, 4 | a loop around a loop (`for k in range(2)` around the shots), at most 14 lines | the first enemy is a 6 HP boss | A boss needs a volley of volleys; the line limit rules out copy-pasted shots. | 27 / 0 |
| `peekaboo` | 1 | `if see() == "enemy": fire()` | - | Shoot only at something you actually see. | 1 / 0 |
| `right-dummy` | 1, 3 | `elif see_right()`, `for` over `if` | an enemy to the right | Check both sides, again and again, and turn to what you find. | 5 / 0 |
| `three-way` | 1, 3, 1 | `else: turn_right()` | an enemy behind your left shoulder | If nothing is in sight, turn until you find the enemy. | 8 / 0 |
| `bubble` | 2s, 3, 1 | `if enemy_shielded(): wait() else: fire()` (nested `if`) | **a periodic shield** (up 2 rounds, down 1): a shot at it is wasted (`noWaste`) | Shield rhythm of its own; only a script that watches the shield hits it. | 11 / 0 |
| `sniper` | 2s, 3, 2x | the order of the checks: `see_left()` before `see()` | **an enemy that shoots back** every round from the left | The one that is hitting you goes first (the old script dies). | 14 / 3 |
| `far-far-dummy` | 1 | `while see() != "enemy": forward()` | a target in the far end of the hall | Advance until the target is in sight, then shoot. | 3 / 0 |
| `regenerator` | 1, 4r | `while alive(): fire()` | an enemy that heals 1 HP every 2 rounds | A fixed number of shots is not enough; keep firing until it falls. | 12 / 0 |
| `side-guard` | 1, 4r, 3 | `while see() == "enemy": fire()` after a turn | a guard at the far left | Shoot as long as it is in sight. | 18 / 0 |
| `patroller` | 1, 4r, 2p | `while True:` ... `break`, a hit counter, `wait()` | **a patroller** east of you (replaces the guard) | Wait for it to cross your line, shoot, and leave the loop after two hits; no shot may miss. | 20 / 0 |
| `flicker` | 1, 4r, 2ps | `if not enemy_shielded()` inside the loop (boolean) | **patrol + shield with a rhythm of its own** (walk 4 rounds, shield 3) | It is in line only sometimes and shielded only sometimes; no shot may miss. | 26 / 0 |

## Self-check against the rules

* **No talk to the enemy.** `say()` appears in two challenges only (`status-report`, `range-report`) as the robot's own log line for HQ; no text is addressed to an enemy. The old "greet the dummy", "say done", "say low" and "Liftoff!" are gone, as are `needs.sayOnce` and `needs.sayIfHpBelow`.
* **No unrelated required output.** The only required outputs are `say: true` (Status Report) and the prefix "Distance: " (Range Report), both a battle report with a real value. Every other construct is needed by the fight: a loop (target HP, patrol), a variable (the measured distance), `if`/`else` (what the sensors show), `while` (advance until, keep firing, wait for the patrol), `noWaste` / `noMiss` (the shield and the patrol).
* **No identical-solution padding.** All 21 reference solutions are different (`chain.test.ts`: "no two challenges of the game share a reference solution"). The review chapters (5 + 8 challenges, 2 scripts) were removed.
* **At most 3 enemies** per challenge (`chain.test.ts`, every id), with different HP (balance test: at most half of the last challenge's enemies at exactly 2 HP; a moving or shielded enemy has 2 HP).
* **Additive chain, and no bare "one more dummy".** A challenge that adds an enemy must also add a code construct, a wall or an enemy behaviour (`chain.test.ts`, "is not only ... plus another enemy"). Where a challenge swaps an enemy (`patroller`, `sniper`) the count stays.
* **Mechanics early:** wall in Chapter 0, patrol in Chapter 2, periodic shield and a shooting enemy in Chapter 3, both together in Chapter 4.

Evidence: each reference solution was run in the engine (`balance.test.ts`: "won with the default gear in a reasonable number of rounds"); the rounds in the table are from that run. The previous solution fails the next challenge (`enemies.test.ts`), naive scripts fail the patrol and the shields (`moving-targets.test.ts`, `chapters.test.ts`).
