/** How fast the game plays a run. */
export const GAME_SPEEDS = ['slow', 'normal', 'fast'] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];
export const DEFAULT_GAME_SPEED: GameSpeed = 'slow';

/** Time per step when playing, in ms. */
export const STEP_MS: Record<GameSpeed, number> = { slow: 1200, normal: 700, fast: 350 };

export const isGameSpeed = (v: unknown): v is GameSpeed => GAME_SPEEDS.includes(v as GameSpeed);
