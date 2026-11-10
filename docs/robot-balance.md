# Robot Battler: balance

The numbers live in `web/src/robot/balance.ts` (weapons), `build.ts` (chassis, drives) and the `content/*.ts` files (enemies).
`web/src/robot/balance.test.ts` encodes the rules below: if a number is changed so that a rule breaks, the test fails.
A round is one tick; every robot acts once per round and all attacks resolve at the same time.

## Rules

1. **Range is paid for.** Ranged weapons (blaster, cannon) deal less damage per round than melee (hammer). Only the hammer deals 3; ranged shots deal 1 or 2.
2. **Big shots cost rounds.** A stronger cannon shot recharges longer than it adds damage (power p recharges p + 1 rounds), so its damage per round never goes up with power. The cannon stays at or below 1.5 x the blaster's damage per round and always below the hammer.
3. **Melee needs contact.** The hammer only hits the tile right ahead, so the robot has to walk up to the enemy, and an enemy that shoots gets free hits meanwhile.
4. **No part is strictly better than another.** Every part has a downside or a specialty (table below).
5. **Small numbers.** Damage 1-3, recharge 1-4 rounds, HP 1-8 for enemies (the light chassis has 8).
6. **Enemies ramp gently.** The strongest enemy of a challenge has at most 3 more HP than that of the challenge before; each challenge adds one thing.
7. **The default gear (light chassis, wheels, blaster, eyes) wins every challenge** with its chain solution and keeps at least a third of its HP; fights last 3-30 rounds (listed exceptions in the test).

## Weapons

Damage per round (dpr) = damage / rounds between two uses when fired as fast as possible (measured in the test too).

| Part | Damage | Range | Recharge | Per round | Slot | Downside / specialty |
| --- | --- | --- | --- | --- | --- | --- |
| Blaster | 1 | 5 | none (fires every round) | 1.0 | 1 | Weak per hit: does nothing against armor 1+. The all-rounder. |
| Blaster Mk II (burst) | 1 per shot, up to 3 per call | 5 | heat +3 per shot, locks 3 rounds at 10 | at most 1.0 (about 0.5 sustained) | 1 | Fewer lines (`fire(3)`) but it overheats; scripts watch `blaster.heat()`. |
| Cannon | 1-2 (the power) | 5 | power + 1 rounds | 0.5 (power 1), 0.67 (power 2) | 1 | Slow. Specialty: a hit of 2 still hurts armor 1 and kills a 2 HP dummy with one shot. |
| Hammer | 3 | 1 (the tile ahead) | 2 rounds | 1.5 | 1 | Only at contact: the robot must close in and takes hits on the way. |
| Shield generator | blocks one hit | - | 2 rounds | - | 1 | Must be raised the round before; one hit only. |
| Armor plates | -1 per hit, 5 hits | - | - | - | 1 | X |
| GPS | - | - | - | - | 1 | Position and facing only. |
| Eyes | - | see 5 | - | - | 1 | Costs a slot; wide-angle and scanner come with it. Without eyes a robot shoots blind. |

Before this change the cannon hit for 1-3 at range 5 with a recharge equal to the power (1.0 per round for every power: a ranged 3 in one shot) and the hammer was 1.5 per round.
Now: cannon power 1-2, recharge power + 1 (0.5 / 0.67 per round); blaster and hammer unchanged (1.0 / 1.5).

## Chassis and drives

| Part | HP | Slots | Turning | Armor | Downside / specialty |
| --- | --- | --- | --- | --- | --- |
| Light | 8 | 2 | 1 round | 0 | Few slots, fewer HP. Turns fast. (was 8 HP, 2 slots) |
| Medium | 10 (was 12) | 3 | 2 rounds (a lost round first) | 0 | One more slot and +2 HP, but a heavy frame turns slowly. |
| Wheels | - | - | 1 round | 0 | `forward()`; cannot cross rubble. |
| Legs | - | - | free (absolute `move_*`) | 0 | Crosses rubble; no `forward()`. |
| Treads | - | - | 2 rounds | +3 | Armor, rubble, `push()`; slow turns. |

## Enemies

An enemy fires like the player's blaster (1 per round at most), so no enemy out-damages the player's parts.

| Enemy | HP | Damage per round | Notes |
| --- | --- | --- | --- |
| Dummy | 1 (first lesson of Chapter 0, Chapter 3, far/left dummies), 2 (near dummy, corner), 3 (Chapter 2, the right dummy of Chapters 0/1) | 0 | Does not move or shoot. Chapters 0/1/4 mix 1, 2 and 3 HP (rb25). |
| Patroller (Chapter 4) | 2 | 0 | Walks a fixed path back and forth (4 rounds), steps after the attacks. A moving 2 HP asks more of the script than a static 5. |
| Flicker shield (Chapter 4) | 2 | 0 | The patroller with a shield that is down 2 / up 1 rounds (a 3-round rhythm next to the 4-round walk); blocks every shot while up. Shots at it must not miss. |
| Big dummy (Chapter 2 boss) | 6 (was 15) | 0 | Behind the first dummy; three passes of the loop. |
| Shield dummy | 2 (was 3) | 0 | Raises its shield every other round. |
| Sniper | 4 (was 5) | 1 | `fire()` every round from the far end of the column. |
| Regenerator | 4 (was 6) | 0 | Heals 1 HP every 2 rounds (0.5 per round), so it needs more than the blaster's 1 per round to fall: net 0.5. |

Other Chapter 2 dummies went from 5 to 3 HP and the loops of the solutions from `range(5)` to `range(3)`.

## Rounds per challenge (default gear, reference solution)

| Chapter | Rounds before | Rounds after |
| --- | --- | --- |
| 0 | 2-30 | 2-30 |
| 1 | 4-23 | 4-23 |
| 2 | 9-37 | 7-25 |
| Practice Field I | 9-37 | 7-25 |
| 3 | 1-13 | 1-12 |
| 4 | 4-24 | 4-28 (Patrol 26, Flicker Shield 28) |
| Exams | 3-39 | 3-38 |

Outliers left on purpose (listed in `balance.test.ts`): `first-contact` (2) and `peekaboo` (1) are one-line lessons, and Exams 2-4 (`pg2-b..d`, up to 38) are walks of the one general script.

rb25: `balance.test.ts` also checks that enemy hit points are mixed (at most half of the last challenge's enemies at exactly 2 HP in Chapters 0, 1, 3, 4) and that moving or shielded enemies have 2 HP.
