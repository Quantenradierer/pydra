/**
 * The art registry: one line per image. To draw a NEW part, add its file under `parts/` (or `chassis/`) and one
 * line here: no game code changes (the game itself only learns the id in build.ts / parts.ts).
 */
import type { GearId, LocomotionId } from '../build.ts';
import { heavy } from './chassis/heavy.ts';
import { light } from './chassis/light.ts';
import { medium } from './chassis/medium.ts';
import { blaster } from './parts/blaster.ts';
import { cannon } from './parts/cannon.ts';
import { eyes } from './parts/eyes.ts';
import { gps } from './parts/gps.ts';
import { hammer } from './parts/hammer.ts';
import { hover } from './parts/hover.ts';
import { legs } from './parts/legs.ts';
import { plates } from './parts/plates.ts';
import { shield } from './parts/shield.ts';
import { treads } from './parts/treads.ts';
import { wheels } from './parts/wheels.ts';
import type { ChassisArt, PartArt } from './types.ts';

/** Chassis the game has (light, medium) plus the ones whose art waits for Chapter 5+. */
export const CHASSIS_ART: Readonly<Record<string, ChassisArt>> = { light, medium, heavy };

const PART_LIST: readonly PartArt[] = [wheels, legs, treads, hover, blaster, cannon, eyes, hammer, shield, gps, plates];
export const PART_ART: Readonly<Record<string, PartArt>> = Object.fromEntries(PART_LIST.map((p) => [p.id, p]));

/** Compile-time guard: every locomotion and gear id of the game has art. */
const _covered: Record<LocomotionId | GearId, PartArt> = { wheels, legs, treads, blaster, cannon, eyes, hammer, shield, gps, plates };
void _covered;

export const chassisArt = (id: string): ChassisArt => CHASSIS_ART[id] ?? light;
export const partArt = (id: string): PartArt | undefined => PART_ART[id];
export const LOCOMOTION_ART = PART_LIST.filter((p) => p.kind === 'locomotion');
export const GEAR_ART = PART_LIST.filter((p) => p.kind === 'gear');
