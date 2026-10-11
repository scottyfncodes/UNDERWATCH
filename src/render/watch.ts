/**
 * The watch, in the street (docs/52).
 *
 * The title screen promises a town that is already watching: real cones
 * swept across the street and a bracket on the kid. In play that promise
 * lived only in the plan view. This decides what of it is drawn in the
 * street, and it is held to the same rule as the plan (plan.ts): the street
 * shows what the player knows, never more.
 *
 *  - A camera's footprint on the ground is drawn only once the player has
 *    noticed that camera (`Sim.knownSensors`) or VISION shows them all —
 *    exactly the cameras the plan already draws. Recon is not undercut.
 *  - A camera that has the rider right now is always drawn, known or not:
 *    being seen is something happening *to* you, and it is never secret.
 *  - A camera turned toward a stone is drawn in the player's amber: that
 *    turn is the player's doing.
 *  - A camera whose timing the recon has learned is drawn with a firm edge;
 *    one only noticed, with a broken one.
 *
 * Pure: no canvas, so it can be tested.
 */
import type { Vec2 } from '../core/math';
import type { Sim } from '../sim/sim';
import { sensorActive } from '../sim/surveillance/sensors';

export type ConeState = 'seeing' | 'turned' | 'idle';

export interface StreetCone {
  id: string;
  pos: Vec2;
  facing: number;
  fov: number;
  /** How far along the ground the footprint is drawn, metres. */
  reach: number;
  state: ConeState;
  /** Recon has learned its sweep: drawn with a firm edge. */
  timed: boolean;
}

export const WATCH = {
  /** Cameras further than this from the rider are not drawn in the street. */
  radius: 70,
  /** At most this many footprints, nearest first: a street, not a map. */
  max: 6,
  /** A footprint is never drawn longer than this: past it, it is the plan's job. */
  reachMax: 24,
  /** How far round toward a stone a camera must be to read as turned. */
  turned: 0.3,
};

export function streetCones(sim: Sim): StreetCone[] {
  const seeing = new Set(sim.sensorsSeeingPlayer().map((s) => s.data.id));
  const vision = sim.visionUnlocked;
  const p = sim.player.pos;
  const out: Array<StreetCone & { d: number }> = [];
  for (const s of sim.sensors) {
    const d = s.data;
    if (d.kind === 'reader' || !sensorActive(s)) continue;
    const has = seeing.has(d.id);
    if (!has && !vision && !sim.knownSensors.has(d.id)) continue;
    const dd = Math.hypot(d.pos.x - p.x, d.pos.y - p.y);
    if (dd > WATCH.radius) continue;
    const turned = !has && s.attend !== null && s.attendBlend > WATCH.turned;
    out.push({
      id: d.id, pos: d.pos, facing: s.facing, fov: d.fov,
      reach: Math.min(d.range, WATCH.reachMax),
      state: has ? 'seeing' : turned ? 'turned' : 'idle',
      timed: sim.recon.timed(d.id),
      d: dd,
    });
  }
  // The ones that have you first, then nearest.
  out.sort((a, b) => (a.state === 'seeing' ? 0 : 1) - (b.state === 'seeing' ? 0 : 1) || a.d - b.d);
  return out.slice(0, WATCH.max).map(({ d: _d, ...c }) => c);
}

/** The level the street's tracking bracket takes its colour from. */
export type WatchTone = 'UNSEEN' | 'SPOTTED' | 'TRACKED' | 'UNDERWATCH';

/** The tag beside the bracket: which lens, and how sure. Read off state only. */
export function trackTag(sensorId: string | null, tone: WatchTone): [string, string] {
  const lens = sensorId ? sensorId.replace(/^[A-Z]+-/, 'CAM ') : 'NO FIX';
  const line = tone === 'UNDERWATCH' ? 'LIVE PURSUIT' : tone === 'TRACKED' ? 'TRACKING' : 'SUBJECT IN VIEW';
  return [lens, line];
}
