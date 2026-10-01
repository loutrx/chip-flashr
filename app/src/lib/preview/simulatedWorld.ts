import type { Scenario, Snapshot, Stage, Transition } from '../types';

/** The TypeScript twin of `flashr_core::SimulatedWorld`: same stages, same triggers, same generation rule. */
export interface SimulatedWorld {
  scenarioName(): string;
  /** A copy: callers may keep or change it without touching the scenario. */
  snapshot(): Snapshot;
  /** Goes up by one on every stage change. */
  generation(): number;
  /** Follows the stage's first transition on `trigger`; true if it did. */
  trigger(trigger: 'recheck' | 'add-folder' | 'open-file'): boolean;
  /** The stage's first `afterMs` delay, or null. */
  pendingDelay(): number | null;
  /** Follows that delay, only if `generation` is still the current one; true if it did. */
  elapse(generation: number): boolean;
}

export function createSimulatedWorld(scenario: Scenario): SimulatedWorld {
  let stage = 0;
  let generation = 0;

  const current = (): Stage => scenario.stages[stage];
  const delayed = (): Transition | undefined => current().next.find((transition) => typeof transition.on === 'object');

  // A transition back to the same stage still counts, as in Rust: the snapshot is sent again.
  function follow(transition: Transition | undefined): boolean {
    if (transition === undefined) return false;
    stage = transition.to;
    generation += 1;
    return true;
  }

  return {
    scenarioName: () => scenario.name,
    snapshot: () => structuredClone(current().snapshot),
    generation: () => generation,
    trigger: (trigger) => follow(current().next.find((transition) => transition.on === trigger)),
    pendingDelay() {
      const transition = delayed();
      return transition !== undefined && typeof transition.on === 'object' ? transition.on.afterMs : null;
    },
    elapse: (expected) => (expected === generation ? follow(delayed()) : false),
  };
}
