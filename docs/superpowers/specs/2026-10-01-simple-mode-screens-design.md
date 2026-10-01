# Simple-mode screens (M1, part 3): design spec

- Date: 2026-10-01
- Implements: [roadmap M1](../../roadmap.md), "UI built from the mockups" (Simple mode)
- Plans: **3a · foundation and nominal path** (screens 01, 02, 03, 05, 06, 07), then **3b · problem screens** (04, 08, 09, 10, 11). One spec, two plans: each plan ends with an app that builds, runs and passes its tests.
- Builds on: [plan 1 spec](2026-09-26-foundations-design.md), [plan 2 spec](2026-09-27-design-system-design.md), [ux-design.md](../../ux-design.md), [architecture.md](../../architecture.md#application-states), [ESP32 field test](2026-10-01-esp32-field-test.md)
- Design source: the "Chip Flashr — Écrans" design artifact, one page per screen: `Main` (01), `Firmwares` (02), `ChoixPuce` (03), `AttenteCarte` (04), `Flash` (05), `Succes` (06), `Echec` (07), `Driver` (08), `OutilExterne` (09), `Vide` (10), `Invalide` (11). Exact copy, sizes and colours are read from their inline CSS. Where a JPG in `docs/assets/screens/` disagrees, the artifact wins, as in plan 2.

## Goal

Every Simple-mode screen of the mockups exists and is reached the way the app will reach it for real: from facts the Rust side reports (firmwares found, boards connected, problems seen), the user's choices, and the flash job. Until plans 4 and 6 bring real packages and real detection, those facts come from **simulated scenarios**, one per situation, selectable in the app and in the browser preview.

## In scope

1. **A snapshot of the world** in `flashr-core`: watched folders, firmware summaries, targets, device issues. Sent by the Rust side, never computed by the UI.
2. **New IPC**: `snapshot` + a `snapshot-changed` event, `flash` (replaces `flash_demo`), `recheck`, `add_folder`, `open_file`.
3. **A scenario-driven mock**: scenarios are JSON files shared by the Rust mock and the TypeScript preview.
4. **`screenOf`**: a pure TypeScript function that picks the screen from the snapshot, the user's choices and the job.
5. **Screens 01 to 11**, built from the plan-2 components plus the new ones listed below. `DemoFlow` is removed.
6. **The flash job, extended**: per-step durations, remaining time, per-file progress, session board counter.
7. **A text report** (log, chip, plan, no personal data), copied to the clipboard.
8. **FR/EN** for every new string, including check codes, probable causes per error code and per-family waiting advice.

## Out of scope (later plans)

Reading real packages, watched folders, file and folder pickers, Markdown rendering of a real README and live reload (plan 4). Expert mode, *Create a package*, settings beyond plan 2 (plan 5). Real USB detection, drivers and flashing (plan 6 for ESP32, later for STM32 and nRF). Saving the report as a file (plan 4, with the pickers). Unlocking a Nordic chip (Nordic backend). Several boards connected at once, onboarding, confirmation dialogs (next design pass).

## The snapshot

Module `flashr-core::snapshot`. All types are `Serialize + Deserialize`, camelCase on the wire, and mirrored one to one in `app/src/lib/types.ts`.

```rust
pub struct Snapshot {
    pub folders: Vec<WatchedFolder>,
    pub firmwares: Vec<FirmwareSummary>,
    pub targets: Vec<Target>,
    pub issues: Vec<DeviceIssue>,
}

pub struct WatchedFolder { pub path: String, pub kind: FolderKind }   // App | Watched

pub struct FirmwareSummary {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub folder: usize,                 // index into `folders`
    pub source: SourceKind,            // EspIdfBuild | Arduino | PlatformIo | Elf | Hex | Bin | FileName
    pub name: Option<String>,
    pub version: Option<String>,
    pub variant: Option<String>,       // "prod"
    pub chip: Option<String>,          // "esp32s3"; the UI formats it ("ESP32-S3")
    pub family: FamilyGuess,
    pub toolchain: Option<String>,     // "ESP-IDF 5.3"
    pub built_at: Option<String>,      // ISO 8601 local time, "2026-09-12T14:32:00"
    pub size_bytes: u64,
    pub address_ranges: u32,
    pub images: Vec<ImageEntry>,       // { address: u32, name: String, size: u64 }
    pub manifest: Option<String>,      // "flasher_args.json"
    pub checks: Vec<Check>,
    pub readme: Option<Readme>,        // { file_name: String }; content arrives with plan 4
}

pub enum FamilyGuess {
    Certain { family: Family },
    Suggested { family: Family, reason: GuessReason },   // StartAddress { address: u32 } | FileName
    Unknown,
}

pub struct Check { pub status: CheckStatus, pub code: String, pub params: BTreeMap<String, String> }
// CheckStatus: Ok | Warning | Error. Codes for plan 3: manifest-read, file-present, file-missing, nonstandard-name.

pub enum DeviceIssue {
    MissingDriver {
        family: Family, vendor: String, name: String, vid: u16, pid: u16,
        download: Download, inf: Option<String>,
    },
    MissingTool {
        family: Family, target_label: String, locked: Option<LockKind>,   // LockKind: Approtect
        tools: Vec<ToolStatus>,                                            // { name, installed }
        download: Download, install_command: Option<String>,
    },
}

pub struct Download { pub title: String, pub publisher: String, pub version_hint: String,
                      pub size_hint: Option<String>, pub url: String }
```

`Target` gains `chip: Option<String>`, `port: String`, `link: Link` (`UsbJtag` | `UsbSerial { bridge }` | `Probe { name }`) and `flash_size: Option<u32>`; `id`, `family` and `label` stay.

Rules:

- **Checks travel as code + params, never as sentences.** The UI words them per language, the same rule as `UserFacingError`.
- **A firmware is invalid when one of its checks is `Error`.** Derived, never stored.
- **Download titles and URLs are data**, because the backend knows which driver or tool a device needs. Their surrounding sentences are UI strings.
- `readme` only says whether a README exists and its name. The panel keeps the plan-2 sample content until plan 4 renders real Markdown.

## IPC

| Command | Returns | Notes |
|---|---|---|
| `snapshot()` | `Snapshot` | Initial state. Changes then arrive as a `snapshot-changed` event carrying the whole snapshot |
| `flash(firmwareId, targetId, family, onProgress)` | `FlashReport` | Replaces `flash_demo`. `family` is the user's confirmed family for an ambiguous firmware. The mock builds its plan from the firmware's `images` |
| `cancel_flash()` | `bool` | Unchanged |
| `recheck()` | `()` | "Revérifier" on 08 and 09 |
| `add_folder()` | `()` | Wired now; simulated in plan 3 (advances the scenario), real picker in plan 4 |
| `open_file()` | `()` | Same |
| `app_info()` | `AppInfo` | Gains `scenario: Option<String>` and `scenarioWarning: Option<String>` for the status bar |

`list_targets` and `flash_demo` are removed. The TypeScript `Backend` interface follows the same shape, with `onSnapshot(callback)` returning an unsubscribe function.

`FlashReport` gains `firmwareId`, `targetId` and `log: Vec<String>` (the lines the report and the "Détails techniques" console show). `UserFacingError` gains `phase: Option<Phase>` and `percent: Option<u8>`, for "à 41 %" on screen 07.

## Scenarios

JSON files in `crates/flashr-core/scenarios/<name>.json`. The Rust mock embeds them with `include_str!`; the preview imports the same files through Vite. One source, so the two copies cannot drift.

```json
{
  "name": "driver-missing",
  "stages": [
    { "snapshot": { "folders": [], "firmwares": [], "targets": [], "issues": [] },
      "next": [{ "on": "recheck", "to": 1 }] },
    { "snapshot": { "...": "..." }, "next": [] }
  ]
}
```

- A trigger is `recheck`, `add-folder`, `open-file` or `{ "afterMs": 4000 }`. On a trigger the mock moves to the stage `to` and emits `snapshot-changed`.
- Selection: `CHIP_FLASHR_SCENARIO=<name>` in the app, `?scenario=<name>` in the preview. Default `default`.
- An unknown name falls back to `default` and sets `scenarioWarning`, shown in the status bar. The app never fails to start because of a scenario.
- `CHIP_FLASHR_MOCK_FAIL_AT` and `?failAt=` keep working and combine with any scenario.

| Scenario | Content (values from the mockups) | Path |
|---|---|---|
| `default` | 6 firmwares in `C:\Livraison` (app folder) and `D:\Firmwares`: Thermostat v1.4.2 prod and v1.3.0 (ESP32-S3, ESP-IDF build), capteur-porte v2.0.1 (nRF52840, from file name), Passerelle v0.9.0-rc2 (STM32F411, .elf), sonde_air v1.0.0 (ESP32-C3, Arduino), firmware.hex (unknown). ESP32-S3 on COM4, USB-JTAG, 8 MB | 02 → 01 → 05 → 06 |
| `single` | Thermostat v1.4.2 only, ESP32-S3 on COM4 | 01 |
| `no-firmware` | Two empty folders | 10 → add-folder / open-file → 01 |
| `ambiguous-hex` | firmware.hex, 124 KB, one range from `0x08000000`, STM32 suggested; no board | 03 → family picked → 04 → ST-Link after 2 s → 01 |
| `waiting-board` | Thermostat v1.4.2, no board | 04 → board after 4 s → 01 |
| `driver-missing` | Thermostat v1.4.2; Silicon Labs CP210x seen (VID 10C4, PID EA60), no driver | 08 → recheck → 01 |
| `nordic-locked` | capteur-porte v2.0.1; nRF52840 via nRF52840 DK, APPROTECT; J-Link installed, nRF Util missing | 09 → recheck → 01 |
| `incomplete` | Thermostat v1.5.0-beta, `build_final(2).zip`, `partition-table.bin` missing, non-standard name | 11 |

## Choosing the screen

The UI keeps the user's choices:

```ts
interface Choices {
  firmwareId: string | null;           // picked on 02
  families: Record<string, Family>;    // confirmed on 03, per firmware id
  browsing: boolean;                   // "Changer" opened the list
  boardsThisSession: number;
}
```

`screenOf(snapshot, choices, job)` returns the first rule that applies:

| # | Condition | Screen |
|---|---|---|
| 1 | job flashing / succeeded / failed | 05 / 06 / 07 |
| 2 | no firmware | 10 |
| 3 | `browsing`, or several firmwares and none picked | 02 |
| 4 | current firmware has an `Error` check | 11 |
| 5 | family not `Certain` and not confirmed | 03 |
| 6 | an issue for the current family: `MissingDriver` / `MissingTool` | 08 / 09 |
| 7 | no target of the current family | 04 |
| 8 | otherwise | 01 |

- The *current firmware* is the picked one, or the only one. A picked id that has vanished from the snapshot counts as not picked.
- The *current target* is the first target of the current family. Choosing between several boards is the next design pass.
- **Retry** (07) starts the same flash again, straight to 05. **Programmer une autre carte** (06) clears the job and counts the board; rule 7 or 8 then shows 04 or 01. The app never flashes a board it hasn't seen arrive.
- **Retour à l'accueil** clears the job; **Changer** sets `browsing`; picking a row on 02 sets `firmwareId` and clears `browsing`.
- A board unplugged on any screen moves the app on by itself, because the screen is derived. That is the reason for this design.

The state diagram in `architecture.md` is redrawn to match this table, and the table is the test suite of `screenOf`: one row per arrow, plus edge cases.

## The flash job

The plan-2 `flashReducer` is extended, still pure:

- **Steps**: connecting, erasing, writing (one per image), verifying, resetting. Each is `pending`, `active` or `done` with its duration, measured from event timestamps on the UI side.
- **Per-file progress**: derived from `bytesDone` and the image sizes of the current firmware. The backend contract does not change.
- **Remaining time**: from the throughput measured so far. It is shown only after 1 s of writing, and never goes up by more than 20 % between two updates, so it doesn't jump around.
- **Estimate before starting** ("Environ 25 secondes"): total size at **150 KB/s**, the throughput measured in the [field test](2026-10-01-esp32-field-test.md), rounded to 5 s.
- Late events after success, failure or cancel are ignored, as in plan 2.

## The report

`buildReport(snapshot, firmware, target, job, locale)` returns plain text: app version, date, scenario if simulated, firmware (name, version, file name, images), target (chip, port, link, flash size), steps with durations, result, and the technical lines. It contains **no user path**: only file names, and folder kinds instead of folder paths. "Voir le rapport" (06) and "Exporter le rapport" (07) copy it to the clipboard and show "Copié" for 2 s. Saving to a file comes with the plan-4 pickers.

## Screens

Instructions panel: **open** (01, 03, 04, 05, 06, 07, 08, 09, 11), **hidden** (02, 10, a new third mode beside open and rail), and an **empty state** when the current firmware has no README ("Aucune instruction pour ce firmware").

| # | Screen | Plan | Content | Actions |
|---|---|---|---|---|
| 01 | Package ready | 3a | `FirmwareCard` with manifest line and `ImageChip`s, family selector with "Détecté automatiquement", `BoardCard` connected, Programmer with estimate | Programmer → 05 · Changer → 02 · Détails → Expert · refresh boards |
| 02 | Firmware list | 3a | Title, count, `SearchField`, `FilterChips` per family and "À identifier", rows grouped by `FolderGroupHeader` | Row → current firmware · Ajouter un dossier surveillé · Ouvrir un fichier… |
| 03 | Choose the chip | 3a | Minimal `FirmwareCard`, selector in ambiguous state with "Suggéré", reason callout, `BoardCard` waiting | Family → rule 6–8 · Changer → 02 |
| 05 | Programming | 3a | `FirmwareStrip`, big percent, remaining time, striped bar, `StepList` with per-file sub-bar, keep-plugged callout | Annuler (bottom right) |
| 06 | Success | 3a | `ResultHero`, `StatTile`s (Vérification, Durée, Cartes cette session) | Programmer une autre carte · Voir le rapport · Retour à l'accueil |
| 07 | Failure | 3a | `ResultHero` with phase and percent, `CauseList` per error code, technical details open | Réessayer → 05 · Exporter le rapport |
| 04 | Waiting for the board | 3b | `FirmwareStrip`, `WaitingHero` with the board illustration, `NumberedSteps` advice **per family** | Changer → 02 |
| 08 | Missing driver | 3b | `ProblemHeader` with vendor and VID/PID, `NumberedSteps` with `DownloadCard` | Page officielle (external) · Revérifier (auto every 3 s) |
| 09 | External tool | 3b | `FirmwareStrip`, `ProblemHeader` (lock), `ToolCheckRow`s, `DownloadCard`, `CommandLine` with copy | Page officielle · Indiquer l'emplacement… (simulated) · Revérifier |
| 10 | No firmware | 3b | `DropZone`, `FormatList`, the watched folders, naming tip | Parcourir… · Ajouter un dossier surveillé |
| 11 | Incomplete package | 3b | `FirmwareCard` error variant, `ValidationCard` with `CheckRow`s | Ouvrir le dossier · Créer un paquet → Expert · Changer → 02 |

During plan 3a, rules 2, 4, 6 and 7 already work and lead to a **provisional screen** (the screen's title and "Écran prévu au plan 3b"), so every scenario runs end to end before plan 3b exists.

### Top-bar pill per screen

| Screens | Tone | Text |
|---|---|---|
| 01, 02, 06, 11 | ok, breathing | `ESP32-S3 · COM4` |
| 03, 04, 10 | idle | `Aucune carte` |
| 05 | **busy** (ink dot, new tone) | `ESP32-S3 · programmation…` |
| 07 | err | `ESP32-S3 · erreur` |
| 08 | warn | `Pilote manquant` |
| 09 | warn | `nRF52840 · verrouillée` |

### New components

| Component | Plan | Screens |
|---|---|---|
| `FirmwareCard` (full, minimal; error tile in 3b) | 3a | 01, 03, 11 |
| `ImageChip` | 3a | 01 |
| `FirmwareStrip` | 3a | 04, 05, 09 |
| `BoardCard` (connected, waiting) | 3a | 01, 03 |
| `FirmwareRow`, `FolderGroupHeader`, `FilterChips`, `SearchField` | 3a | 02 (and 10 for the folder header) |
| `StatusBubble` (ok, error, warning, active, pending) | 3a | 05, 09, 11 |
| `StepList` | 3a | 05 |
| `StatTile` | 3a | 06 |
| `CauseList` | 3a | 07 |
| `ProvisionalScreen` | 3a | 04, 08, 09, 10, 11 until 3b |
| `WaitingHero` (board illustration) | 3b | 04 |
| `NumberedSteps` (grey or dark bullets) | 3b | 04, 08, 09 |
| `ProblemHeader`, `DownloadCard`, `ToolCheckRow`, `CommandLine` | 3b | 08, 09 |
| `ValidationCard`, `CheckRow` | 3b | 11 |
| `DropZone`, `FormatList` | 3b | 10 |

Changes to plan-2 components: `FamilySelector` gets an ambiguous state (warning border on every tile), a per-tile "Suggéré" tag and a header status. `Pill` and `StatusDot` get a `busy` tone. `Tag` gets a `warn` tone. `Callout` takes an `icon` independent of its tone (03 uses the info icon on a warning background). `InstructionsPanel` gets the hidden mode and the empty state.

## Decisions

- **D1 · The screen is derived, never stored.** Rust owns the facts, the UI owns the choices and the job, `screenOf` is pure. Chosen over a Rust-side state machine (an IPC round trip per click, and a second copy in the preview) and over explicit transition events (every fact change would have to become an event in every state).
- **D2 · Scenarios are shared JSON.** One file per scenario, read by the Rust mock and the preview, so the two simulated worlds cannot drift.
- **D3 · Checks and issues carry codes, the UI words them.** The plan-1 rule for errors extends to validation checks, probable causes and per-family advice.
- **D4 · "Programmer une autre carte" waits for a board.** The job is cleared and the screen is derived again, never a direct jump to 05.
- **D5 · Follow the artifact over the plan-2 demo.** Stats on 06, causes and open details on 07, Annuler at the bottom right on 05.
- **D6 · Report to the clipboard for now**, built by a pure function with no user path. File export waits for the plan-4 pickers.
- **D7 · Pickers are wired, then simulated.** `add_folder`, `open_file` and the tool path on 09 are real commands whose mock advances the scenario, so plan 4 only swaps their implementation.
- **D8 · External links through Tauri's `opener` plugin (3b)**, limited to the `https` URLs of known drivers and tools and to revealing a folder. No general shell access, as in the security notes.
- **D9 · Estimates use the measured 150 KB/s.** Replaced by per-backend figures when real backends exist.
- **D10 · Plan 3a ships a provisional screen** for the five problem screens, so the whole state table is testable before 3b.

## Testing

- **Rust**: snapshot types serialize to the expected camelCase JSON and round-trip through every scenario file. Each scenario loads, every trigger points to an existing stage, and every firmware's images pass `FlashPlan::validate` (except the ones built to fail). The mock advances on triggers, builds its plan from the firmware, and falls back to `default` with a warning on an unknown name.
- **`screenOf`**: a table test, one row per arrow of the redrawn diagram, plus: a board unplugged on 03, a firmware replaced on 11, a picked firmware that disappears, "another board" with and without the board still plugged.
- **Job reducer**: step durations, remaining time that is never shown before 1 s and never jumps up more than 20 %, session counter, late events ignored.
- **Report**: stable content, no folder path, both languages.
- **Components** in jsdom: accessible roles and names, every state (ambiguous, suggested, busy, empty, hidden).
- **Scenarios end to end** in `App` on the preview backend: each scenario reaches its screen and follows its triggers.
- **i18n**: every check code, cause and per-family advice exists in FR and EN, enforced by the dictionary types.

## Acceptance

Plan 3a, then 3b, are done when:

- `pnpm tauri dev` with each `CHIP_FLASHR_SCENARIO` and the preview with each `?scenario=` reach the expected screen and follow the scenario's path.
- Screenshots of each of the plan's screens, light and dark, match their artifact page for sizes, colours and copy. Computed values are the exception: the estimate, durations, remaining time and counters show what the job measured (Thermostat at 150 KB/s gives "Environ 10 secondes", where the mockup says 25).
- `cargo test --workspace` and `pnpm -C app test` pass, CI is green on the three OSes, and the no-remote-font check still holds.
- `architecture.md` (state diagram and IPC), `ux-design.md` (screen map), the README (development section, scenario variables) and the plans index are up to date.
