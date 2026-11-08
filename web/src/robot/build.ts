/** The robot's build: chassis, locomotion and gear. Parts become Python functions (see parts.ts). */
export type ChassisId = 'light' | 'medium';
export type LocomotionId = 'wheels' | 'legs';
export type GearId = 'blaster' | 'cannon' | 'eyes' | 'hammer' | 'shield' | 'gps';
export type AddonId = 'wide' | 'scanner';

export const CHASSIS: Record<ChassisId, { slots: number; hp: number }> = {
  light: { slots: 2, hp: 8 },
  medium: { slots: 3, hp: 12 },
};

export const LOCOMOTIONS: readonly LocomotionId[] = ['wheels', 'legs'];
export const GEAR: readonly GearId[] = ['blaster', 'cannon', 'eyes', 'hammer', 'shield', 'gps'];
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

export const START_BUILD: Build = { chassis: 'light', locomotion: 'wheels', gear: ['blaster', 'eyes'], addons: [], blasterMark: 1 };

/** What a part needs before the player may pick it: the chapter that unlocks it. */
export const UNLOCK_CHAPTER = {
  chassis: { light: 0, medium: 3 },
  locomotion: { wheels: 0, legs: 1 },
  gear: { blaster: 0, eyes: 0, cannon: 1, hammer: 3, shield: 3, gps: 4 },
  addon: { wide: 3, scanner: 3 },
  blasterMark2: 4,
} as const;

/** Whether a build is legal at all: known parts, enough slots, no duplicates, a weapon-less robot is allowed. */
export function buildProblem(build: Build, chapter = 99): 'slots' | 'locked' | 'duplicate' | undefined {
  if (build.gear.length > CHASSIS[build.chassis].slots) return 'slots';
  if (new Set(build.gear).size !== build.gear.length) return 'duplicate';
  if (UNLOCK_CHAPTER.chassis[build.chassis] > chapter) return 'locked';
  if (UNLOCK_CHAPTER.locomotion[build.locomotion] > chapter) return 'locked';
  if (build.gear.some((g) => UNLOCK_CHAPTER.gear[g] > chapter)) return 'locked';
  if (build.addons.some((a) => UNLOCK_CHAPTER.addon[a] > chapter || !build.gear.includes('eyes'))) return 'locked';
  if (build.blasterMark === 2 && UNLOCK_CHAPTER.blasterMark2 > chapter) return 'locked';
  return undefined;
}

/** The add-ons that come with the eyes once the chapter has unlocked them. */
export const addonsFor = (chapter: number): AddonId[] => (['wide', 'scanner'] as const).filter((a) => UNLOCK_CHAPTER.addon[a] <= chapter);

export function parseBuild(raw: unknown): Build | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.chassis !== 'light' && r.chassis !== 'medium') return undefined;
  if (r.locomotion !== 'wheels' && r.locomotion !== 'legs') return undefined;
  if (!Array.isArray(r.gear) || !r.gear.every((g) => (GEAR as readonly unknown[]).includes(g))) return undefined;
  const addons = Array.isArray(r.addons) ? r.addons.filter((a): a is AddonId => a === 'wide' || a === 'scanner') : [];
  const build: Build = { chassis: r.chassis, locomotion: r.locomotion, gear: [...new Set(r.gear as GearId[])], addons, blasterMark: r.blasterMark === 2 ? 2 : 1 };
  return buildProblem(build) ? undefined : build;
}
