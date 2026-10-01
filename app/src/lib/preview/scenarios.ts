import ambiguousHex from '../../../../crates/flashr-core/scenarios/ambiguous-hex.json';
import defaultScenario from '../../../../crates/flashr-core/scenarios/default.json';
import driverMissing from '../../../../crates/flashr-core/scenarios/driver-missing.json';
import incomplete from '../../../../crates/flashr-core/scenarios/incomplete.json';
import noFirmware from '../../../../crates/flashr-core/scenarios/no-firmware.json';
import nordicLocked from '../../../../crates/flashr-core/scenarios/nordic-locked.json';
import single from '../../../../crates/flashr-core/scenarios/single.json';
import waitingBoard from '../../../../crates/flashr-core/scenarios/waiting-board.json';
import type { Scenario } from '../types';

// The files are canonical (a Rust test rejects a missing field), so they are read as they are.
const asScenario = (json: unknown): Scenario => json as Scenario;

/** The same eight files the Rust mock embeds, keyed by scenario name. */
export const SCENARIOS: Record<string, Scenario> = {
  default: asScenario(defaultScenario),
  single: asScenario(single),
  'no-firmware': asScenario(noFirmware),
  'ambiguous-hex': asScenario(ambiguousHex),
  'waiting-board': asScenario(waitingBoard),
  'driver-missing': asScenario(driverMissing),
  'nordic-locked': asScenario(nordicLocked),
  incomplete: asScenario(incomplete),
};

export const DEFAULT_SCENARIO = 'default';

/** Like Rust's `resolve_scenario`: an unknown name runs the default scenario, and the warning is that name. */
export function resolveScenario(requested: string | null): { scenario: Scenario; warning: string | null } {
  if (requested === null) return { scenario: SCENARIOS[DEFAULT_SCENARIO], warning: null };
  if (Object.hasOwn(SCENARIOS, requested)) return { scenario: SCENARIOS[requested], warning: null };
  return { scenario: SCENARIOS[DEFAULT_SCENARIO], warning: requested };
}
