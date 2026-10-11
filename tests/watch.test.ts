/**
 * The watch in the street (docs/52): what is drawn is what the player knows,
 * and what really has them. These pin the presentation to the simulation —
 * no footprint for a camera the player has never noticed, always one for a
 * camera that is looking at them, and the recon's timing shown as a firm edge.
 */
import { describe, expect, it } from 'vitest';
import { makeSim, place, step } from './harness';
import { WATCH, streetCones, trackTag } from '../src/render/watch';
import type { Sim } from '../src/sim/sim';

/** Stand the rider in the middle of a working camera's picture, until one has them. */
function inFrontOf(sim: Sim): string {
  for (const cam of sim.sensors) {
    if (cam.data.kind === 'reader' || cam.state !== 'ONLINE') continue;
    const f = cam.facing;
    place(sim, { x: cam.data.pos.x + Math.cos(f) * cam.data.range * 0.4, y: cam.data.pos.y + Math.sin(f) * cam.data.range * 0.4 });
    step(sim, 0.1);
    if (sim.sensorsSeeingPlayer().some((s) => s.data.id === cam.data.id)) return cam.data.id;
  }
  throw new Error('no camera in Bellhaven could see the rider');
}

describe('street cones', () => {
  it('draws nothing for cameras the player has never noticed', () => {
    const sim = makeSim();
    sim.knownSensors.clear();
    // Far from everything: nothing sees, nothing is known.
    expect(streetCones(sim).filter((c) => c.state !== 'seeing')).toEqual([]);
  });

  it('draws the camera that has the rider, known or not, as seeing', () => {
    const sim = makeSim();
    const id = inFrontOf(sim);
    let seen = false;
    for (let i = 0; i < 20 && !seen; i++) { step(sim, 0.2); seen = sim.sensorsSeeingPlayer().some((s) => s.data.id === id); }
    expect(seen).toBe(true);
    const cones = streetCones(sim);
    const hit = cones.find((c) => c.id === id);
    expect(hit?.state).toBe('seeing');
    // The ones that have you come first.
    expect(cones[0].state).toBe('seeing');
  });

  it('every seeing cone is a sensor the simulation says is seeing', () => {
    const sim = makeSim();
    inFrontOf(sim);
    for (let i = 0; i < 6; i++) {
      step(sim, 0.4);
      const seeing = new Set(sim.sensorsSeeingPlayer().map((s) => s.data.id));
      for (const c of streetCones(sim)) expect(c.state === 'seeing').toBe(seeing.has(c.id));
    }
  });

  it('shows noticed cameras near the rider, a firm edge only once timed', () => {
    const sim = makeSim();
    inFrontOf(sim);
    const near = sim.sensors.filter((s) => s.data.kind !== 'reader'
      && Math.hypot(s.data.pos.x - sim.player.pos.x, s.data.pos.y - sim.player.pos.y) < WATCH.radius);
    for (const s of near) sim.knownSensors.add(s.data.id);
    const first = streetCones(sim);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(WATCH.max);
    expect(first.every((c) => !c.timed)).toBe(true);
    sim.recon.cameras.set(first[0].id, { id: first[0].id, studied: 99, spotted: true, timed: true });
    expect(streetCones(sim).find((c) => c.id === first[0].id)?.timed).toBe(true);
  });

  it('a camera turned toward a stone reads as turned, in the player\'s colour', () => {
    const sim = makeSim();
    inFrontOf(sim);
    const s = sim.sensors.find((x) => x.data.kind !== 'reader' && x.state === 'ONLINE'
      && Math.hypot(x.data.pos.x - sim.player.pos.x, x.data.pos.y - sim.player.pos.y) < WATCH.radius
      && !sim.sensorsSeeingPlayer().includes(x))!;
    sim.knownSensors.add(s.data.id);
    s.attend = { x: s.data.pos.x + 5, y: s.data.pos.y };
    s.attendBlend = 1;
    expect(streetCones(sim).find((c) => c.id === s.data.id)?.state).toBe('turned');
  });

  it('never draws a camera that is down', () => {
    const sim = makeSim();
    inFrontOf(sim);
    for (const s of sim.sensors) { sim.knownSensors.add(s.data.id); s.state = 'OFFLINE'; }
    expect(streetCones(sim)).toEqual([]);
  });

  it('keeps every footprint inside the street, never a map', () => {
    const sim = makeSim();
    for (const s of sim.sensors) sim.knownSensors.add(s.data.id);
    inFrontOf(sim);
    for (const c of streetCones(sim)) expect(c.reach).toBeLessThanOrEqual(WATCH.reachMax);
  });
});

describe('track tag', () => {
  it('names the lens and the rung, from state only', () => {
    expect(trackTag('CM-041', 'SPOTTED')).toEqual(['CAM 041', 'SUBJECT IN VIEW']);
    expect(trackTag('CM-041', 'TRACKED')[1]).toBe('TRACKING');
    expect(trackTag('CM-041', 'UNDERWATCH')[1]).toBe('LIVE PURSUIT');
    expect(trackTag(null, 'SPOTTED')[0]).toBe('NO FIX');
  });
});
