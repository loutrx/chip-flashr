import { describe, expect, it } from 'vitest';
import type { Trigger } from '../types';
import { DEFAULT_SCENARIO, resolveScenario, SCENARIOS } from './scenarios';

const NAMES = [
  'default',
  'single',
  'no-firmware',
  'ambiguous-hex',
  'waiting-board',
  'driver-missing',
  'nordic-locked',
  'incomplete',
];

const SNAPSHOT_KEYS = ['folders', 'firmwares', 'targets', 'issues'];
const FIRMWARE_KEYS = [
  'id', 'path', 'fileName', 'folder', 'source', 'name', 'version', 'variant', 'chip', 'family',
  'toolchain', 'builtAt', 'sizeBytes', 'addressRanges', 'images', 'manifest', 'checks', 'readme',
];
const TARGET_KEYS = ['id', 'family', 'label', 'chip', 'port', 'link', 'flashSize'];
const FOLDER_KEYS = ['path', 'kind'];
const IMAGE_KEYS = ['address', 'name', 'size'];
const CHECK_KEYS = ['status', 'code', 'params'];
const README_KEYS = ['fileName'];
const DOWNLOAD_KEYS = ['title', 'publisher', 'versionHint', 'sizeHint', 'url'];
const TOOL_KEYS = ['name', 'installed'];
/** Tagged unions: the keys of each variant, `kind` included. */
const LINK_KEYS: Record<string, string[]> = {
  'usb-jtag': ['kind'],
  'usb-serial': ['kind', 'bridge'],
  probe: ['kind', 'name'],
};
const GUESS_KEYS: Record<string, string[]> = {
  certain: ['kind', 'family'],
  suggested: ['kind', 'family', 'reason'],
  unknown: ['kind'],
};
const REASON_KEYS: Record<string, string[]> = {
  'start-address': ['kind', 'address'],
  'file-name': ['kind'],
};
const ISSUE_KEYS: Record<string, string[]> = {
  'missing-driver': ['kind', 'family', 'vendor', 'name', 'vid', 'pid', 'download', 'inf'],
  'missing-tool': ['kind', 'family', 'targetLabel', 'locked', 'tools', 'download', 'installCommand'],
};

const keys = (value: object) => Object.keys(value).sort();
const sorted = (list: readonly string[]) => [...list].sort();
/** The key set of a tagged value; an unknown kind fails on `undefined`. */
const variantKeys = (table: Record<string, string[]>, kind: string) =>
  kind in table ? sorted(table[kind]) : undefined;

function isTrigger(on: Trigger): boolean {
  if (on === 'recheck' || on === 'add-folder' || on === 'open-file') return true;
  return (
    typeof on === 'object' &&
    keys(on).join() === 'afterMs' &&
    Number.isInteger(on.afterMs) &&
    on.afterMs > 0
  );
}

describe('SCENARIOS', () => {
  it('has the eight scenarios, each named after its file', () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual([...NAMES].sort());
    for (const [name, scenario] of Object.entries(SCENARIOS)) expect(scenario.name).toBe(name);
  });

  it('sends every transition to an existing stage on a known trigger', () => {
    for (const scenario of Object.values(SCENARIOS)) {
      expect(scenario.stages.length, scenario.name).toBeGreaterThan(0);
      for (const stage of scenario.stages) {
        for (const transition of stage.next) {
          expect(isTrigger(transition.on), `${scenario.name}: ${JSON.stringify(transition.on)}`).toBe(true);
          expect(transition.to, scenario.name).toBeGreaterThanOrEqual(0);
          expect(transition.to, scenario.name).toBeLessThan(scenario.stages.length);
        }
      }
    }
  });

  it('writes every value of every stage with all its fields', () => {
    for (const scenario of Object.values(SCENARIOS)) {
      scenario.stages.forEach(({ snapshot }, index) => {
        const at = `${scenario.name}[${index}]`;
        expect(keys(snapshot), at).toEqual(sorted(SNAPSHOT_KEYS));
        for (const folder of snapshot.folders) expect(keys(folder), `${at}: ${folder.path}`).toEqual(sorted(FOLDER_KEYS));
        for (const firmware of snapshot.firmwares) {
          const of = `${at}: ${firmware.id}`;
          expect(keys(firmware), of).toEqual(sorted(FIRMWARE_KEYS));
          for (const image of firmware.images) expect(keys(image), `${of}: ${image.name}`).toEqual(sorted(IMAGE_KEYS));
          for (const check of firmware.checks) expect(keys(check), `${of}: ${check.code}`).toEqual(sorted(CHECK_KEYS));
          if (firmware.readme !== null) expect(keys(firmware.readme), of).toEqual(sorted(README_KEYS));
          expect(keys(firmware.family), of).toEqual(variantKeys(GUESS_KEYS, firmware.family.kind));
          if (firmware.family.kind === 'suggested') {
            const { reason } = firmware.family;
            expect(keys(reason), of).toEqual(variantKeys(REASON_KEYS, reason.kind));
          }
        }
        for (const target of snapshot.targets) {
          const of = `${at}: ${target.id}`;
          expect(keys(target), of).toEqual(sorted(TARGET_KEYS));
          expect(keys(target.link), of).toEqual(variantKeys(LINK_KEYS, target.link.kind));
        }
        for (const issue of snapshot.issues) {
          const of = `${at}: ${issue.kind}`;
          expect(keys(issue), of).toEqual(variantKeys(ISSUE_KEYS, issue.kind));
          expect(keys(issue.download), of).toEqual(sorted(DOWNLOAD_KEYS));
          if (issue.kind === 'missing-tool') {
            for (const tool of issue.tools) expect(keys(tool), `${of}: ${tool.name}`).toEqual(sorted(TOOL_KEYS));
          }
        }
      });
    }
  });

  it('gives every firmware an existing folder, a known guess and unique ids', () => {
    for (const scenario of Object.values(SCENARIOS)) {
      for (const { snapshot } of scenario.stages) {
        const ids = snapshot.firmwares.map((firmware) => firmware.id);
        expect(new Set(ids).size, scenario.name).toBe(ids.length);
        for (const firmware of snapshot.firmwares) {
          expect(firmware.folder, firmware.id).toBeLessThan(snapshot.folders.length);
          expect(['certain', 'suggested', 'unknown']).toContain(firmware.family.kind);
        }
        for (const issue of snapshot.issues) expect(['missing-driver', 'missing-tool']).toContain(issue.kind);
      }
    }
  });
});

describe('resolveScenario', () => {
  it('picks the requested scenario, or the default one when none is asked', () => {
    expect(resolveScenario('single')).toEqual({ scenario: SCENARIOS.single, warning: null });
    expect(resolveScenario(null)).toEqual({ scenario: SCENARIOS[DEFAULT_SCENARIO], warning: null });
    expect(DEFAULT_SCENARIO).toBe('default');
  });

  it('falls back to the default scenario and names the unknown one', () => {
    expect(resolveScenario('nope')).toEqual({ scenario: SCENARIOS.default, warning: 'nope' });
    expect(resolveScenario('constructor')).toEqual({ scenario: SCENARIOS.default, warning: 'constructor' });
  });
});
