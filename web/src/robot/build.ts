/** The robot's build: chassis, locomotion and gear. Parts become Python functions (see parts.ts). */
export type ChassisId = 'light' | 'medium';
export type LocomotionId = 'wheels' | 'legs' | 'treads';
export type GearId = 'blaster' | 'cannon' | 'eyes' | 'hammer' | 'shield' | 'gps' | 'plates';
export type AddonId = 'wide' | 'scanner';

export const CHASSIS: Record<ChassisId, { slots: number; hp: number }> = {
  light: { slots: 2, hp: 8 },
  medium: { slots: 3, hp: 12 },
};

export const LOCOMOTIONS: readonly LocomotionId[] = ['wheels', 'legs', 'treads'];

/** Armor the locomotion adds: treads are heavy plating. */
export const locomotionArmor = (l: LocomotionId): number => (l === 'treads' ? 3 : 0);
export const GEAR: readonly GearId[] = ['blaster', 'cannon', 'eyes', 'hammer', 'shield', 'gps', 'plates'];
export const WEAPONS: readonly GearId[] = ['blaster', 'cannon', 'hammer'];

export interface Build {
  chassis: ChassisId;
  locomotion: LocomotionId;
  gear: GearId[];
  /** Eyes add-ons: no slot needed. */
  addons: AddonId[];
  /** 2 = burst blaster. */
  blasterMark: 1 | 2;
}

export const START_BUILD: Build = { chassis: 'light', locomotion: 'wheels', gear: ['blaster', 'eyes'], addons: ['wide', 'scanner'], blasterMark: 1 };

/**
 * The chapter that introduces a part: it is shown as "new" and the story points to it. Gear is always free: the player may
 * equip any part at any time, and no battle or challenge needs one specific part (see the "default gear" tests).
 */
export const INTRODUCED_IN = {
  chassis: { light: 0, medium: 3 },
  locomotion: { wheels: 0, legs: 1, treads: 4 },
  gear: { blaster: 0, eyes: 0, cannon: 1, hammer: 3, shield: 3, gps: 4, plates: 0 },
  blasterMark2: 4,
} as const;

/** Whether a build is legal at all: enough slots and no duplicates. Nothing is locked. */
export function buildProblem(build: Build): 'slots' | 'duplicate' | undefined {
  if (build.gear.length > CHASSIS[build.chassis].slots) return 'slots';
  if (new Set(build.gear).size !== build.gear.length) return 'duplicate';
  return undefined;
}

/** The eyes' wide-angle and scanner add-ons come with the eyes (no slot, no unlock). */
export const addonsFor = (gear: readonly GearId[]): AddonId[] => (gear.includes('eyes') ? ['wide', 'scanner'] : []);

export function parseBuild(raw: unknown): Build | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.chassis !== 'light' && r.chassis !== 'medium') return undefined;
  if (r.locomotion !== 'wheels' && r.locomotion !== 'legs' && r.locomotion !== 'treads') return undefined;
  if (!Array.isArray(r.gear) || !r.gear.every((g) => (GEAR as readonly unknown[]).includes(g))) return undefined;
  const gear = [...new Set(r.gear as GearId[])];
  const build: Build = { chassis: r.chassis, locomotion: r.locomotion, gear, addons: addonsFor(gear), blasterMark: r.blasterMark === 2 ? 2 : 1 };
  return buildProblem(build) ? undefined : build;
}
