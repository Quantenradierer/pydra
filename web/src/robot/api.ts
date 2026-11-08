import type { Build } from './build.ts';
import type { ApiId } from './messages-ui.ts';

/** One line of the API panel: how to call it and which text explains it. */
export interface ApiEntry {
  sig: string;
  id: ApiId;
}

/** The commands a build gives the robot, for the API panel next to the editor. */
export function apiEntries(build: Build): ApiEntry[] {
  const out: ApiEntry[] = [];
  const has = (g: Build['gear'][number]) => build.gear.includes(g);
  if (build.locomotion === 'wheels') {
    out.push({ sig: 'forward(steps)', id: 'forward' }, { sig: 'backward(steps)', id: 'backward' }, { sig: 'turn_left()', id: 'turn_left' }, { sig: 'turn_right()', id: 'turn_right' });
  } else {
    out.push({ sig: 'move_north(steps)  move_east(steps)  move_south(steps)  move_west(steps)', id: 'move' }, { sig: 'rotate_left()  rotate_right()', id: 'rotate' });
  }
  if (has('blaster')) {
    out.push(build.blasterMark === 2 ? { sig: 'fire(shots)', id: 'fire_burst' } : { sig: 'fire()', id: 'fire_blaster' });
    if (build.blasterMark === 2) out.push({ sig: 'blaster.heat()', id: 'heat' });
  }
  if (has('cannon')) out.push({ sig: has('blaster') ? 'cannon.fire(power)' : 'fire(power)', id: 'fire_cannon' });
  if (has('hammer')) out.push({ sig: 'smash()', id: 'smash' });
  if (has('eyes')) {
    out.push({ sig: 'see()', id: 'see' }, { sig: 'distance()', id: 'distance' });
    if (build.addons.includes('wide')) out.push({ sig: 'see_left()  see_right()', id: 'see_side' });
    if (build.addons.includes('scanner')) out.push({ sig: 'enemy_shielded()', id: 'enemy_shielded' });
  }
  if (has('shield')) out.push({ sig: 'shield.activate()', id: 'activate' }, { sig: 'shield.is_up()', id: 'is_up' });
  if (has('gps')) out.push({ sig: 'gps.position()', id: 'position' }, { sig: 'gps.facing()', id: 'facing' });
  if (build.gear.length > 0) out.push({ sig: 'blaster.is_charged()  .cooldown()  .mark()', id: 'checks' });
  out.push({ sig: 'wait()', id: 'wait' }, { sig: 'say(text)', id: 'say' }, { sig: 'hp()', id: 'hp' }, { sig: 'alive()', id: 'alive' }, { sig: 'clock.tick()', id: 'tick' });
  return out;
}
