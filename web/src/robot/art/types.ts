/**
 * Modular robot art. Every image is a layered SVG fragment in a 100 x 100 box, drawn top-down with the robot
 * facing east (+x). A chassis image carries named sockets; a part image is drawn around its own origin
 * (+x points away from the robot) and is plugged into a socket (position, rotation, scale, layer).
 */
export type SocketName = 'top' | 'front' | 'back' | 'left' | 'right' | 'underside';

export interface Socket {
  /** Where the part's origin sits in the chassis box (0..100). */
  x: number;
  y: number;
  /** Degrees, clockwise (SVG): 0 = pointing forward. */
  rot: number;
  scale: number;
  /** Paint order; the chassis body itself is {@link BODY_LAYER}. Low = behind the body. */
  layer: number;
}

export const BODY_LAYER = 10;

/** What a part image may look at: upgrades change how it is drawn (more detail, more glow). */
export interface Tier {
  /** Blaster Mk II. */
  mark: 1 | 2;
  /** Wide-angle eyes. */
  wide: boolean;
  /** Shield scanner eyes. */
  scanner: boolean;
}

export interface ChassisArt {
  id: string;
  /** SVG of the hull, in chassis box coordinates. */
  body: string;
  /** Every place a part can plug in. `underside` is for the locomotion. */
  sockets: Record<SocketName, Socket>;
  /** The gear slots in the order they fill up. */
  slots: readonly SocketName[];
}

export interface PartArt {
  id: string;
  kind: 'locomotion' | 'gear';
  /** Sockets the part may be plugged into, best first. Locomotion always goes to `underside`. */
  fits: readonly SocketName[];
  /** SVG around the origin, +x pointing away from the robot. */
  draw(tier: Tier): string;
  /** The tip of a weapon in part coordinates (shots and flashes start here). */
  muzzle?: { x: number; y: number };
}

/** What the renderer needs to know about a robot. Plain ids, so it also draws parts that the game does not know yet. */
export interface RobotSpec {
  chassis: string;
  locomotion: string;
  gear: readonly string[];
  mark?: 1 | 2;
  wide?: boolean;
  scanner?: boolean;
}
