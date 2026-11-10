/**
 * The numbers of the weapons, in one place (see docs/robot-balance.md for the rules behind them).
 * Damage per round of a weapon that fires as fast as it can = damage / cooldown period.
 *
 *  - Ranged weapons (blaster, cannon) deal LESS damage per round than melee (hammer): range is paid for.
 *  - Ranged damage is 1-2 per shot, only the hammer deals 3, and only at the tile right ahead.
 *  - A bigger cannon shot costs more rounds of recharging than it adds damage.
 */
export const RANGE = 5;

export const BLASTER = { damage: 1, cooldown: 0 } as const;
/** A burst shot (Mk II): the same damage, but every shot adds heat; at the limit it locks for a while. */
export const BURST = { heatPerShot: 3, heatLimit: 10, lockTicks: 3, maxShots: 3 } as const;
/** The cannon fires with a power (= damage) and needs power + 1 rounds to recharge. */
export const CANNON = { maxPower: 2, cooldownOf: (power: number): number => power + 1 } as const;
export const HAMMER = { damage: 3, cooldown: 2 } as const;
export const SHIELD = { cooldown: 2 } as const;

/** Rounds between two uses of a weapon that fires as fast as it can. */
export const period = (cooldown: number): number => Math.max(1, cooldown);
