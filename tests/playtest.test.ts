/**
 * The playtest build (docs/53). The recorder only listens, so these feed it
 * the bus events the simulation really emits and check that the report says
 * what happened, and only that.
 */
import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/events';
import type { SimEvents } from '../src/sim/events';
import { CLEAN_LINE, PlaytestRecorder, QUESTIONS, clock, playtestEnabled } from '../src/ui/playtest';

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k),
    clear: () => m.clear(), key: () => null, get length() { return m.size; },
  };
}

function rig() {
  const bus = new EventBus<SimEvents>();
  const rec = new PlaytestRecorder();
  rec.bind(bus);
  const at = { x: 0, y: 0 };
  const skate = (seconds: number, speed: number) => { for (let i = 0; i < seconds * 60; i++) rec.sample(1 / 60, speed); };
  return { bus, rec, at, skate };
}

describe('playtest flag', () => {
  it('is off for a normal player', () => {
    expect(playtestEnabled('', memory())).toBe(false);
  });

  it('turns on from the link and stays on until the link turns it off', () => {
    const store = memory();
    expect(playtestEnabled('?playtest=1', store)).toBe(true);
    expect(playtestEnabled('', store)).toBe(true);
    expect(playtestEnabled('?playtest=0', store)).toBe(false);
    expect(playtestEnabled('', store)).toBe(false);
  });

  it('still works from the link when storage is unavailable', () => {
    expect(playtestEnabled('?playtest=1', null)).toBe(true);
  });
});

describe('playtest recorder', () => {
  it('finds the first clean line, and a bail starts the count again', () => {
    const { bus, rec, at, skate } = rig();
    skate(10, 6);
    bus.emitNow('player:bail', { pos: at });
    skate(CLEAN_LINE.seconds + 1, 6);
    expect(rec.stats.bails).toBe(1);
    expect(rec.stats.firstCleanLine).toBeCloseTo(10, 0);
  });

  it('does not count rolling slowly as a line', () => {
    const { rec, skate } = rig();
    skate(60, CLEAN_LINE.speed - 1);
    expect(rec.stats.firstCleanLine).toBeNull();
  });

  it('tells a camera hit on the move from one thrown standing still', () => {
    const { bus, rec, at, skate } = rig();
    skate(1, 0);
    bus.emitNow('player:fire', { pos: at, draw: 1, angle: 0, pitch: 0 });
    bus.emitNow('projectile:impact', { kind: 'cameraLens', pos: at });
    skate(1, 6);
    bus.emitNow('player:fire', { pos: at, draw: 1, angle: 0, pitch: 0 });
    bus.emitNow('projectile:impact', { kind: 'cameraMount', pos: at });
    bus.emitNow('player:fire', { pos: at, draw: 1, angle: 0, pitch: 0 });
    bus.emitNow('projectile:impact', { kind: 'ground', pos: at });
    expect(rec.stats).toMatchObject({ throws: 3, cameraHits: 2, cameraHitsMoving: 1 });
    expect(rec.stats.firstMovingCameraHit).toBeCloseTo(2, 1);
  });

  it('keeps the highest escalation and counts interventions', () => {
    const { bus, rec } = rig();
    bus.emitNow('escalation:changed', { from: 'PASSIVE', to: 'PATROL_DISPATCH', risk: 70 });
    bus.emitNow('escalation:changed', { from: 'PATROL_DISPATCH', to: 'MONITORING', risk: 30 });
    bus.emitNow('escalation:changed', { from: 'MONITORING', to: 'INTERVENTION', risk: 95 });
    expect(rec.stats.peak).toBe('INTERVENTION');
    expect(rec.stats.interventions).toBe(1);
  });

  it('writes a report with every criterion and every answer', () => {
    const { bus, rec, skate } = rig();
    skate(20, 6);
    bus.emitNow('vision:unlocked', {});
    bus.emitNow('story:beat', { id: 'incident', label: 'The match' });
    rec.reprise();
    rec.ended('quiet');
    const text = rec.report({ knew: 'at the bridge' }, 'touch · 390x844');
    expect(text).toContain('clean line inside 4:00: YES');
    expect(text).toContain('reprise reached: YES');
    expect(text).toContain('ending quiet');
    expect(text).toContain('The match');
    expect(text).toContain('> at the bridge');
    for (const q of QUESTIONS) expect(text).toContain(q.label);
  });

  it('keeps UI copy free of em dashes', () => {
    const { rec } = rig();
    expect(rec.report({}, 'x')).not.toContain('—');
    for (const q of QUESTIONS) expect(q.label).not.toContain('—');
  });

  it('formats time as minutes and seconds', () => {
    expect(clock(null)).toBe('never');
    expect(clock(65.9)).toBe('1:05');
  });
});
