import { describe, expect, it } from 'vitest';
import { firmware, snapshot } from '../app/fixtures';
import type { Scenario, Snapshot, Stage } from '../types';
import { createSimulatedWorld } from './simulatedWorld';

/** Snapshots told apart by their number of firmwares. */
const numbered = (count: number): Snapshot =>
  snapshot({ firmwares: Array.from({ length: count }, (_, i) => firmware({ id: `fw-${i}` })) });
const stage = (snap: Snapshot, next: Stage['next'] = []): Stage => ({ snapshot: snap, next });
const scenarioOf = (...stages: Stage[]): Scenario => ({ name: 'test', stages });

describe('createSimulatedWorld', () => {
  it('starts on the first stage at generation 0', () => {
    const world = createSimulatedWorld(scenarioOf(stage(numbered(1)), stage(numbered(2))));
    expect(world.scenarioName()).toBe('test');
    expect(world.snapshot()).toEqual(numbered(1));
    expect(world.generation()).toBe(0);
  });

  it('follows the first transition of the trigger and counts the change', () => {
    const world = createSimulatedWorld(
      scenarioOf(
        stage(numbered(1), [
          { on: 'add-folder', to: 2 },
          { on: 'recheck', to: 1 },
          { on: 'recheck', to: 2 },
        ]),
        stage(numbered(2)),
        stage(numbered(3)),
      ),
    );
    expect(world.trigger('recheck')).toBe(true);
    expect(world.snapshot()).toEqual(numbered(2));
    expect(world.generation()).toBe(1);
  });

  it('ignores a trigger the stage does not have', () => {
    const world = createSimulatedWorld(scenarioOf(stage(numbered(1), [{ on: 'recheck', to: 1 }]), stage(numbered(2))));
    expect(world.trigger('open-file')).toBe(false);
    expect(world.snapshot()).toEqual(numbered(1));
    expect(world.generation()).toBe(0);
  });

  it('never follows a delay on a trigger', () => {
    const world = createSimulatedWorld(scenarioOf(stage(numbered(1), [{ on: { afterMs: 10 }, to: 1 }]), stage(numbered(2))));
    expect(world.trigger('recheck')).toBe(false);
    expect(world.trigger('add-folder')).toBe(false);
    expect(world.trigger('open-file')).toBe(false);
    expect(world.generation()).toBe(0);
  });

  it('reports the first delay of the current stage', () => {
    const world = createSimulatedWorld(
      scenarioOf(
        stage(numbered(1), [
          { on: 'recheck', to: 1 },
          { on: { afterMs: 4000 }, to: 1 },
          { on: { afterMs: 9000 }, to: 0 },
        ]),
        stage(numbered(2)),
      ),
    );
    expect(world.pendingDelay()).toBe(4000);
    world.trigger('recheck');
    expect(world.pendingDelay()).toBeNull();
  });

  it('follows the delay when its generation is still current', () => {
    const world = createSimulatedWorld(scenarioOf(stage(numbered(1), [{ on: { afterMs: 4000 }, to: 1 }]), stage(numbered(2))));
    expect(world.elapse(0)).toBe(true);
    expect(world.snapshot()).toEqual(numbered(2));
    expect(world.generation()).toBe(1);
  });

  it('ignores a delay that belongs to a stage already left', () => {
    const world = createSimulatedWorld(
      scenarioOf(
        stage(numbered(1), [{ on: 'recheck', to: 1 }]),
        stage(numbered(2), [{ on: { afterMs: 1000 }, to: 2 }]),
        stage(numbered(3)),
      ),
    );
    const stale = world.generation();
    world.trigger('recheck');
    expect(world.elapse(stale)).toBe(false);
    expect(world.snapshot()).toEqual(numbered(2));
    expect(world.elapse(world.generation())).toBe(true);
    expect(world.snapshot()).toEqual(numbered(3));
  });

  it('has nothing to elapse on a stage without a delay', () => {
    const world = createSimulatedWorld(scenarioOf(stage(numbered(1))));
    expect(world.pendingDelay()).toBeNull();
    expect(world.elapse(0)).toBe(false);
    expect(world.generation()).toBe(0);
  });

  it('hands out copies, so a caller cannot change the scenario', () => {
    const world = createSimulatedWorld(scenarioOf(stage(numbered(1))));
    world.snapshot().firmwares.length = 0;
    expect(world.snapshot()).toEqual(numbered(1));
  });

  it('counts a transition back to the same stage as a change', () => {
    const world = createSimulatedWorld(scenarioOf(stage(numbered(1), [{ on: 'recheck', to: 0 }])));
    expect(world.trigger('recheck')).toBe(true);
    expect(world.generation()).toBe(1);
  });
});
