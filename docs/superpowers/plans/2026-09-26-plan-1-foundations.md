# Plan 1 · Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chip Flashr desktop app that compiles and runs on Windows, macOS and Linux. Its demo screen lists simulated boards and "programs" one through the real architecture (Svelte UI → Tauri command → `FlashBackend` trait → mock backend), with live progress, cancel, success and failure.

**Architecture:** A Cargo workspace holds `crates/flashr-core` (domain types, the `FlashBackend` trait and a `MockBackend`) and the Tauri 2 app crate in `app/src-tauri`. The Svelte 5 + Vite + TypeScript frontend lives in `app/`. The UI calls typed Tauri commands, and progress streams back over a Tauri `Channel`. Flash jobs run on a blocking worker, at most one at a time, with cooperative cancellation. Rust sends stable error **codes**; the UI turns them into French text.

**Tech Stack:** Rust (edition 2024, stable) · Tauri 2 · serde · thiserror · Svelte 5 (runes) · Vite · TypeScript · Vitest · pnpm · GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-09-26-foundations-design.md](../specs/2026-09-26-foundations-design.md) (scope, decisions D1–D9, acceptance) · background: [docs/architecture.md](../../architecture.md) (crates, backend contract, data flow, errors), [docs/decisions/0001-rust-and-tauri.md](../../decisions/0001-rust-and-tauri.md), [docs/ux-design.md](../../ux-design.md) (visual tokens), [docs/roadmap.md](../../roadmap.md) (M1 "done when").

## Global Constraints

- Rust edition **2024**, stable toolchain, `rust-version = "1.88"` (let-chains); `cargo fmt` clean and `cargo clippy --workspace --all-targets -- -D warnings` clean.
- Crate names use the `flashr-` prefix; the app crate is `chip-flashr` (lib `chip_flashr_lib`); product name **"Chip Flashr"**; bundle identifier **`io.github.loutrx.chipflashr`**.
- Tauri **2.x**; frontend **Svelte 5 + Vite + TypeScript**, package manager **pnpm**; the Tauri CLI comes from the `@tauri-apps/cli` dev dependency (`pnpm tauri …`). No global `cargo install`.
- Main window **1200 × 760**, minimum **960 × 640**, label `main`.
- Colours: exactly the tokens in [ux-design.md → Visual language](../../ux-design.md#visual-language), light + dark via `prefers-color-scheme`.
- UI copy in **French** for now (i18n comes in plan 2). Rust never sends user-facing sentences, only `ErrorCode` + technical detail.
- No network access at runtime. Remote fonts are forbidden (local fonts arrive in plan 2; until then, fallback stacks only).
- Version control with **GitButler** (`but`), conventional commits, branch **`feat/foundations`**. Never `git add` / `git commit`.
- Deferred on purpose (later plans): real backends, firmware parsing, config file, CSP hardening (`csp: null` for now; plan 7), fonts/clay components (plan 2).

## Review Focus

1. **Cancel pressed during a flash**: the job must stop within one chunk and report `cancelled`, never `success`. (Task 5, `cancel_mid_job_reports_cancelled`.)
2. **Program pressed twice / while already flashing**: the second job must be refused with `already-running`, and the slot must be free again once the first job ends, even when it fails. (Task 5, `second_job_is_refused_while_first_runs`, `slot_is_released_after_a_failed_job`.)
3. **Board lost mid-write**: the UI must get a `device-error` result and stop updating progress. Late progress events must not revive the progress screen. (Task 3 `fails_at_requested_percentage`, Task 6 `ignores_progress_after_failure`.)
4. **Broken plan** (empty, empty region, overlapping regions, past 4 GiB): rejected before any device interaction, with zero progress events emitted. (Task 1 plan tests, Task 3 `invalid_plan_emits_no_progress`.)
5. **Progress arithmetic**: percent stays within 0–100, never goes backwards, and is 0 (not NaN) when the total is 0. (Task 2 `percent_is_clamped_and_safe`, Task 6 `percentOf` and `never_goes_backwards` tests.)

---

## File Structure

```text
chip-flashr/
├── Cargo.toml                         # workspace (Task 1)
├── rust-toolchain.toml                # stable + rustfmt + clippy (Task 1)
├── .gitignore                         # + node/tauri entries (Task 1)
├── crates/flashr-core/
│   ├── Cargo.toml                     # (Task 1)
│   └── src/
│       ├── lib.rs                     # module list + re-exports (Tasks 1–3)
│       ├── family.rs                  # Family enum (Task 1)
│       ├── plan.rs                    # Region, FlashPlan, EraseScope, PlanError (Task 1)
│       ├── progress.rs                # Phase, ProgressEvent, ProgressSink, RecordingSink, CancelToken (Task 2)
│       ├── target.rs                  # Target, ChipInfo, FlashReport (Task 2)
│       ├── error.rs                   # FlashError, ErrorCode, UserFacingError (Task 2)
│       ├── backend.rs                 # FlashBackend trait (Task 2)
│       └── mock.rs                    # MockBackend, demo_plan (Task 3)
├── app/
│   ├── package.json, pnpm-lock.yaml   # (Task 4)
│   ├── index.html, vite.config.ts, svelte.config.js, tsconfig.json   # (Task 4)
│   ├── src/
│   │   ├── main.ts, App.svelte, vite-env.d.ts                        # (Task 4, App rewritten in Task 6)
│   │   ├── styles/tokens.css, styles/base.css                        # (Task 4)
│   │   └── lib/types.ts, ipc.ts, flashState.ts, flashState.test.ts, messages.ts, messages.test.ts  # (Task 6)
│   └── src-tauri/
│       ├── Cargo.toml, build.rs, tauri.conf.json                     # (Task 4)
│       ├── capabilities/default.json                                 # (Task 4)
│       ├── icons/                     # generated from app-icon.svg (Task 4)
│       └── src/main.rs, lib.rs        # (Task 4) + jobs.rs, state.rs, commands.rs (Task 5)
├── .github/workflows/ci.yml           # (Task 7)
└── docs/…                             # README dev section, architecture path fix (Task 7)
```

---

### Task 1: Cargo workspace and plan model (`Family`, `Region`, `FlashPlan`)

**Files:**
- Create: `Cargo.toml`, `rust-toolchain.toml`, `crates/flashr-core/Cargo.toml`, `crates/flashr-core/src/lib.rs`, `crates/flashr-core/src/family.rs`, `crates/flashr-core/src/plan.rs`
- Modify: `.gitignore` (append at the end)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `flashr_core::Family` — `enum { Esp32, Stm32, Nrf }`, serde `"esp32" | "stm32" | "nrf"`, `Family::ALL: [Family; 3]`, `fn label(self) -> &'static str`.
  - `flashr_core::Region { address: u32, label: String, data: Vec<u8> }`, `Region::new(address, label, data)`, `fn end(&self) -> u64`.
  - `flashr_core::EraseScope` — `enum { Regions (default), Full }`, serde kebab-case.
  - `flashr_core::FlashPlan { family, chip: Option<String>, regions: Vec<Region>, erase: EraseScope, verify: bool, reset_after: bool }`, `FlashPlan::new(family, regions)` (verify and reset_after `true`), `fn total_bytes(&self) -> u64`, `fn validate(&self) -> Result<(), PlanError>`.
  - `flashr_core::PlanError` — `Empty | EmptyRegion { label } | OutOfAddressSpace { label } | Overlap { first, second }`.

- [ ] **Step 1: Create the branch and the workspace files**

```bash
but branch new feat/foundations
```

`Cargo.toml` (repo root):

```toml
[workspace]
resolver = "3"
# "app/src-tauri" is added in Task 4, once that crate exists.
members = ["crates/*"]

[workspace.package]
version = "0.1.0"
edition = "2024"
license = "Apache-2.0"
repository = "https://github.com/loutrx/chip-flashr"
rust-version = "1.88"

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
flashr-core = { path = "crates/flashr-core" }
```

`rust-toolchain.toml`:

```toml
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
```

Append to `.gitignore`:

```gitignore

# Frontend (app/)
node_modules/
app/dist/

# Tauri generated schemas
app/src-tauri/gen/
```

`crates/flashr-core/Cargo.toml`:

```toml
[package]
name = "flashr-core"
description = "Domain types and backend contract shared by Chip Flashr"
version.workspace = true
edition.workspace = true
license.workspace = true
rust-version.workspace = true

[dependencies]
serde.workspace = true
thiserror.workspace = true

[dev-dependencies]
serde_json.workspace = true
```

`crates/flashr-core/src/lib.rs`:

```rust
//! Domain types shared by every Chip Flashr backend and the app shell.

pub mod family;
pub mod plan;

pub use family::Family;
pub use plan::{EraseScope, FlashPlan, PlanError, Region};
```

- [ ] **Step 2: Write the failing tests for `Family` and `FlashPlan`**

`crates/flashr-core/src/family.rs`:

```rust
use serde::{Deserialize, Serialize};

/// The three chip families Chip Flashr programs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Family {
    Esp32,
    Stm32,
    Nrf,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_lowercase_ids() {
        assert_eq!(serde_json::to_string(&Family::Esp32).unwrap(), "\"esp32\"");
        assert_eq!(serde_json::to_string(&Family::Stm32).unwrap(), "\"stm32\"");
        assert_eq!(serde_json::to_string(&Family::Nrf).unwrap(), "\"nrf\"");
    }

    #[test]
    fn labels_match_the_ui_selector() {
        let labels: Vec<_> = Family::ALL.iter().map(|f| f.label()).collect();
        assert_eq!(labels, ["ESP32", "STM32", "nRF"]);
    }
}
```

`crates/flashr-core/src/plan.rs`:

```rust
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::Family;

/// A contiguous block of bytes to write at a flash address.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Region {
    pub address: u32,
    pub label: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EraseScope {
    /// Erase only the sectors covered by the regions.
    #[default]
    Regions,
    /// Erase the whole flash before writing.
    Full,
}

/// Backend-agnostic description of what to write where.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FlashPlan {
    pub family: Family,
    /// Exact chip when known (e.g. "esp32s3"), used later to refuse a mismatching target.
    pub chip: Option<String>,
    pub regions: Vec<Region>,
    pub erase: EraseScope,
    pub verify: bool,
    pub reset_after: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum PlanError {
    #[error("the plan has no region to write")]
    Empty,
    #[error("region `{label}` is empty")]
    EmptyRegion { label: String },
    #[error("region `{label}` ends past the 32-bit address space")]
    OutOfAddressSpace { label: String },
    #[error("regions `{first}` and `{second}` overlap")]
    Overlap { first: String, second: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    fn region(address: u32, label: &str, len: usize) -> Region {
        Region::new(address, label, vec![0xAA; len])
    }

    fn esp_layout() -> Vec<Region> {
        vec![
            region(0x0, "bootloader", 0x5000),
            region(0x8000, "partition-table", 0xC00),
            region(0xD000, "ota-data", 0x2000),
            region(0x1_0000, "app", 0x1_0000),
        ]
    }

    #[test]
    fn total_bytes_sums_every_region() {
        let plan = FlashPlan::new(Family::Esp32, esp_layout());
        assert_eq!(plan.total_bytes(), 0x5000 + 0xC00 + 0x2000 + 0x1_0000);
    }

    #[test]
    fn new_plan_verifies_and_resets_by_default() {
        let plan = FlashPlan::new(Family::Stm32, vec![region(0x0800_0000, "app", 16)]);
        assert!(plan.verify && plan.reset_after);
        assert_eq!(plan.erase, EraseScope::Regions);
        assert_eq!(plan.chip, None);
    }

    #[test]
    fn a_normal_esp_layout_is_valid() {
        assert_eq!(FlashPlan::new(Family::Esp32, esp_layout()).validate(), Ok(()));
    }

    #[test]
    fn adjacent_regions_are_valid() {
        let plan = FlashPlan::new(Family::Nrf, vec![region(0x0, "a", 0x1000), region(0x1000, "b", 0x1000)]);
        assert_eq!(plan.validate(), Ok(()));
    }

    #[test]
    fn rejects_an_empty_plan() {
        assert_eq!(FlashPlan::new(Family::Esp32, vec![]).validate(), Err(PlanError::Empty));
    }

    #[test]
    fn rejects_an_empty_region() {
        let plan = FlashPlan::new(Family::Esp32, vec![region(0x0, "bootloader", 0)]);
        assert_eq!(plan.validate(), Err(PlanError::EmptyRegion { label: "bootloader".into() }));
    }

    #[test]
    fn rejects_overlapping_regions_even_when_unsorted() {
        let plan = FlashPlan::new(
            Family::Esp32,
            vec![region(0x8000, "partition-table", 0xC00), region(0x0, "bootloader", 0x9000)],
        );
        assert_eq!(
            plan.validate(),
            Err(PlanError::Overlap { first: "bootloader".into(), second: "partition-table".into() })
        );
    }

    #[test]
    fn rejects_a_region_past_4_gib() {
        let plan = FlashPlan::new(Family::Stm32, vec![region(0xFFFF_FF00, "tail", 0x200)]);
        assert_eq!(plan.validate(), Err(PlanError::OutOfAddressSpace { label: "tail".into() }));
    }

    #[test]
    fn a_region_ending_exactly_at_4_gib_is_valid() {
        let plan = FlashPlan::new(Family::Stm32, vec![region(0xFFFF_FF00, "tail", 0x100)]);
        assert_eq!(plan.validate(), Ok(()));
    }
}
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cargo test -p flashr-core`
Expected: compilation FAILS with errors like `no associated item named 'ALL'`, `no function or associated item named 'new'`, `no method named 'validate'`.

- [ ] **Step 4: Implement the missing items**

Add to `crates/flashr-core/src/family.rs`, between the enum and the tests:

```rust
impl Family {
    pub const ALL: [Family; 3] = [Family::Esp32, Family::Stm32, Family::Nrf];

    /// Short label used in logs and the UI selector.
    pub fn label(self) -> &'static str {
        match self {
            Family::Esp32 => "ESP32",
            Family::Stm32 => "STM32",
            Family::Nrf => "nRF",
        }
    }
}
```

Add to `crates/flashr-core/src/plan.rs`, after the `PlanError` enum and before the tests:

```rust
impl Region {
    pub fn new(address: u32, label: impl Into<String>, data: Vec<u8>) -> Self {
        Self { address, label: label.into(), data }
    }

    /// First address after the region, in u64 so a region ending at 4 GiB can't overflow.
    pub fn end(&self) -> u64 {
        u64::from(self.address) + self.data.len() as u64
    }
}

impl FlashPlan {
    pub fn new(family: Family, regions: Vec<Region>) -> Self {
        Self { family, chip: None, regions, erase: EraseScope::Regions, verify: true, reset_after: true }
    }

    pub fn total_bytes(&self) -> u64 {
        self.regions.iter().map(|r| r.data.len() as u64).sum()
    }

    /// Structural checks that need no device: something to write, no empty region,
    /// nothing past the 32-bit address space, no two regions overlapping.
    pub fn validate(&self) -> Result<(), PlanError> {
        if self.regions.is_empty() {
            return Err(PlanError::Empty);
        }
        for r in &self.regions {
            if r.data.is_empty() {
                return Err(PlanError::EmptyRegion { label: r.label.clone() });
            }
            if r.end() > u64::from(u32::MAX) + 1 {
                return Err(PlanError::OutOfAddressSpace { label: r.label.clone() });
            }
        }
        let mut sorted: Vec<&Region> = self.regions.iter().collect();
        sorted.sort_by_key(|r| r.address);
        for pair in sorted.windows(2) {
            if pair[0].end() > u64::from(pair[1].address) {
                return Err(PlanError::Overlap { first: pair[0].label.clone(), second: pair[1].label.clone() });
            }
        }
        Ok(())
    }
}
```

- [ ] **Step 5: Run the tests, format and lint**

Run: `cargo fmt && cargo test -p flashr-core && cargo clippy -p flashr-core --all-targets -- -D warnings`
Expected: 11 tests PASS (2 family + 9 plan), clippy reports nothing.

- [ ] **Step 6: Commit**

```bash
but commit -b feat/foundations -m "feat(core): add cargo workspace and flash plan model

Family, Region, FlashPlan with structural validation (empty plan,
empty region, overlap, 32-bit address space)."
```

---

### Task 2: Progress, errors, targets and the `FlashBackend` trait

**Files:**
- Create: `crates/flashr-core/src/progress.rs`, `crates/flashr-core/src/target.rs`, `crates/flashr-core/src/error.rs`, `crates/flashr-core/src/backend.rs`
- Modify: `crates/flashr-core/src/lib.rs` (replace whole file)

**Interfaces:**
- Consumes: `Family`, `FlashPlan`, `EraseScope`, `PlanError` (Task 1).
- Produces:
  - `Phase` — serde tag `kind`: `{ kind: "connecting" } | { kind: "erasing" } | { kind: "writing", index, count, label, address } | { kind: "verifying" } | { kind: "resetting" }`.
  - `ProgressEvent { phase: Phase, bytes_done: u64, bytes_total: u64 }` (serde camelCase: `bytesDone`, `bytesTotal`), `fn percent(&self) -> u8`.
  - `trait ProgressSink: Send + Sync { fn report(&self, event: ProgressEvent); }` and `RecordingSink` (`Default`, `fn events(&self) -> Vec<ProgressEvent>`).
  - `CancelToken` — `Clone + Default + Debug`, `new()`, `cancel()`, `is_cancelled()`; clones share state.
  - `Target { id: String, family: Family, label: String }`, `ChipInfo { model: String, flash_size: Option<u32>, details: Vec<(String, String)> }`, `FlashReport { bytes_written: u64, duration_ms: u64, verified: bool }`, all `Serialize` camelCase.
  - `FlashError` — `Cancelled | TargetNotFound(String) | InvalidPlan(PlanError) | FamilyMismatch { plan: Family, target: Family } | Device(String)`.
  - `ErrorCode` — serde kebab-case: `cancelled | target-not-found | invalid-plan | family-mismatch | device-error | already-running`.
  - `UserFacingError { code: ErrorCode, technical: String }`, `UserFacingError::new(code, technical)`, `impl From<&FlashError> for UserFacingError`.
  - `trait FlashBackend: Send + Sync` with `families`, `discover`, `identify`, `flash`, `erase` (signatures below).

- [ ] **Step 1: Write the new modules with their tests (implementations left out)**

`crates/flashr-core/src/lib.rs` (replace):

```rust
//! Domain types shared by every Chip Flashr backend and the app shell.

pub mod backend;
pub mod error;
pub mod family;
pub mod plan;
pub mod progress;
pub mod target;

pub use backend::FlashBackend;
pub use error::{ErrorCode, FlashError, UserFacingError};
pub use family::Family;
pub use plan::{EraseScope, FlashPlan, PlanError, Region};
pub use progress::{CancelToken, Phase, ProgressEvent, ProgressSink, RecordingSink};
pub use target::{ChipInfo, FlashReport, Target};
```

`crates/flashr-core/src/progress.rs`:

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;

/// Where a flash job currently is.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum Phase {
    Connecting,
    Erasing,
    Writing { index: usize, count: usize, label: String, address: u32 },
    Verifying,
    Resetting,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub phase: Phase,
    pub bytes_done: u64,
    pub bytes_total: u64,
}

/// Receives progress from a backend. Implemented by the app (Tauri channel) and by tests.
pub trait ProgressSink: Send + Sync {
    fn report(&self, event: ProgressEvent);
}

/// Sink that keeps every event, for tests and, later, for the exported report.
#[derive(Debug, Default)]
pub struct RecordingSink(Mutex<Vec<ProgressEvent>>);

/// Cooperative cancellation, checked by backends between blocks. Clones share state.
#[derive(Debug, Clone, Default)]
pub struct CancelToken(Arc<AtomicBool>);

#[cfg(test)]
mod tests {
    use super::*;

    fn event(done: u64, total: u64) -> ProgressEvent {
        ProgressEvent { phase: Phase::Erasing, bytes_done: done, bytes_total: total }
    }

    #[test]
    fn percent_is_clamped_and_safe() {
        assert_eq!(event(0, 0).percent(), 0);
        assert_eq!(event(50, 200).percent(), 25);
        assert_eq!(event(199, 200).percent(), 99);
        assert_eq!(event(200, 200).percent(), 100);
        assert_eq!(event(500, 200).percent(), 100);
    }

    #[test]
    fn writing_phase_serializes_for_the_ui() {
        let e = ProgressEvent {
            phase: Phase::Writing { index: 3, count: 4, label: "app".into(), address: 0x1_0000 },
            bytes_done: 10,
            bytes_total: 20,
        };
        assert_eq!(
            serde_json::to_value(&e).unwrap(),
            serde_json::json!({
                "phase": { "kind": "writing", "index": 3, "count": 4, "label": "app", "address": 65536 },
                "bytesDone": 10,
                "bytesTotal": 20
            })
        );
    }

    #[test]
    fn recording_sink_keeps_events_in_order() {
        let sink = RecordingSink::default();
        sink.report(event(1, 2));
        sink.report(event(2, 2));
        assert_eq!(sink.events(), vec![event(1, 2), event(2, 2)]);
    }

    #[test]
    fn cancel_token_clones_share_state() {
        let token = CancelToken::new();
        let clone = token.clone();
        assert!(!clone.is_cancelled());
        token.cancel();
        assert!(clone.is_cancelled());
    }
}
```

`crates/flashr-core/src/target.rs` (data-only, no test needed beyond serialization):

```rust
use serde::Serialize;

use crate::Family;

/// Something we can program: a serial port, a probe, a DFU device.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Target {
    /// Stable id within one app session ("mock:esp32", later "serial:COM4").
    pub id: String,
    pub family: Family,
    /// Human label shown in the top bar pill ("ESP32-S3 · COM4").
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChipInfo {
    pub model: String,
    pub flash_size: Option<u32>,
    /// Extra key/value lines for Expert mode (MAC, revision…).
    pub details: Vec<(String, String)>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashReport {
    pub bytes_written: u64,
    pub duration_ms: u64,
    pub verified: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_serializes_in_camel_case() {
        let t = Target { id: "mock:esp32".into(), family: Family::Esp32, label: "ESP32-S3".into() };
        assert_eq!(
            serde_json::to_value(&t).unwrap(),
            serde_json::json!({ "id": "mock:esp32", "family": "esp32", "label": "ESP32-S3" })
        );
    }

    #[test]
    fn report_serializes_in_camel_case() {
        let r = FlashReport { bytes_written: 4, duration_ms: 5, verified: true };
        assert_eq!(
            serde_json::to_value(&r).unwrap(),
            serde_json::json!({ "bytesWritten": 4, "durationMs": 5, "verified": true })
        );
    }
}
```

`crates/flashr-core/src/error.rs`:

```rust
use serde::Serialize;
use thiserror::Error;

use crate::{Family, PlanError};

#[derive(Debug, Error)]
pub enum FlashError {
    #[error("cancelled by the user")]
    Cancelled,
    #[error("target `{0}` not found")]
    TargetNotFound(String),
    #[error("invalid plan: {0}")]
    InvalidPlan(#[from] PlanError),
    #[error("plan is for {plan:?} but the target is {target:?}")]
    FamilyMismatch { plan: Family, target: Family },
    #[error("device error: {0}")]
    Device(String),
}

/// Stable identifiers the UI turns into localized messages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ErrorCode {
    Cancelled,
    TargetNotFound,
    InvalidPlan,
    FamilyMismatch,
    DeviceError,
    AlreadyRunning,
}

/// What the UI receives when something goes wrong: a code to localize, plus the raw
/// detail shown only under "Détails techniques".
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserFacingError {
    pub code: ErrorCode,
    pub technical: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_flash_error_maps_to_a_code() {
        let cases = [
            (FlashError::Cancelled, ErrorCode::Cancelled),
            (FlashError::TargetNotFound("x".into()), ErrorCode::TargetNotFound),
            (FlashError::InvalidPlan(PlanError::Empty), ErrorCode::InvalidPlan),
            (FlashError::FamilyMismatch { plan: Family::Esp32, target: Family::Nrf }, ErrorCode::FamilyMismatch),
            (FlashError::Device("timeout".into()), ErrorCode::DeviceError),
        ];
        for (err, code) in cases {
            let ui = UserFacingError::from(&err);
            assert_eq!(ui.code, code);
            assert_eq!(ui.technical, err.to_string());
        }
    }

    #[test]
    fn serializes_code_as_kebab_case() {
        let e = UserFacingError::new(ErrorCode::AlreadyRunning, "busy");
        assert_eq!(
            serde_json::to_value(&e).unwrap(),
            serde_json::json!({ "code": "already-running", "technical": "busy" })
        );
    }
}
```

`crates/flashr-core/src/backend.rs`:

```rust
use crate::{CancelToken, ChipInfo, EraseScope, Family, FlashError, FlashPlan, FlashReport, ProgressSink, Target};

/// One implementation per transport family (mock, espflash, probe-rs, DFU, Nordic tools).
/// Methods block: the app runs them on a worker thread.
pub trait FlashBackend: Send + Sync {
    /// Chip families this backend can program.
    fn families(&self) -> &'static [Family];

    /// Boards / probes currently reachable.
    fn discover(&self) -> Result<Vec<Target>, FlashError>;

    /// Connect and read the chip identity.
    fn identify(&self, target: &Target) -> Result<ChipInfo, FlashError>;

    /// Execute a plan: connect → erase → write each region → verify → reset.
    /// Must check `cancel` between blocks and return `FlashError::Cancelled` promptly.
    fn flash(
        &self,
        target: &Target,
        plan: &FlashPlan,
        progress: &dyn ProgressSink,
        cancel: &CancelToken,
    ) -> Result<FlashReport, FlashError>;

    fn erase(&self, target: &Target, scope: EraseScope, progress: &dyn ProgressSink) -> Result<(), FlashError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    // Compile-time check: the app stores backends as `Arc<dyn FlashBackend>`.
    #[allow(dead_code)]
    fn assert_object_safe(_: &dyn FlashBackend) {}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test -p flashr-core`
Expected: compilation FAILS with `no method named 'percent'`, `no method named 'events'`, `no function or associated item named 'new'` (CancelToken, UserFacingError), and `From<&FlashError>` not implemented.

- [ ] **Step 3: Implement the missing items**

Append to `progress.rs`, before the tests:

```rust
impl ProgressEvent {
    /// Whole-job completion in percent, clamped to 0..=100, 0 when there is nothing to write.
    pub fn percent(&self) -> u8 {
        if self.bytes_total == 0 {
            return 0;
        }
        (self.bytes_done.min(self.bytes_total) * 100 / self.bytes_total) as u8
    }
}

impl RecordingSink {
    pub fn events(&self) -> Vec<ProgressEvent> {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }
}

impl ProgressSink for RecordingSink {
    fn report(&self, event: ProgressEvent) {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).push(event);
    }
}

impl CancelToken {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}
```

Append to `error.rs`, before the tests:

```rust
impl UserFacingError {
    pub fn new(code: ErrorCode, technical: impl Into<String>) -> Self {
        Self { code, technical: technical.into() }
    }
}

impl From<&FlashError> for UserFacingError {
    fn from(err: &FlashError) -> Self {
        let code = match err {
            FlashError::Cancelled => ErrorCode::Cancelled,
            FlashError::TargetNotFound(_) => ErrorCode::TargetNotFound,
            FlashError::InvalidPlan(_) => ErrorCode::InvalidPlan,
            FlashError::FamilyMismatch { .. } => ErrorCode::FamilyMismatch,
            FlashError::Device(_) => ErrorCode::DeviceError,
        };
        Self { code, technical: err.to_string() }
    }
}
```

- [ ] **Step 4: Run the tests, format and lint**

Run: `cargo fmt && cargo test -p flashr-core && cargo clippy -p flashr-core --all-targets -- -D warnings`
Expected: 19 tests PASS (11 from Task 1 + 4 progress + 2 target + 2 error), clippy clean.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/foundations -m "feat(core): add progress, errors, targets and FlashBackend trait

Errors cross to the UI as stable ErrorCode values plus technical detail;
the UI owns the wording."
```

---

### Task 3: `MockBackend` and demo plans

**Files:**
- Create: `crates/flashr-core/src/mock.rs`
- Modify: `crates/flashr-core/src/lib.rs` (add `pub mod mock;` and `pub use mock::{MockBackend, demo_plan};`)

**Interfaces:**
- Consumes: everything from Tasks 1–2.
- Produces:
  - `MockBackend { chunk_delay: Duration, fail_at_percent: Option<u8> }` (`Default`: zero delay, no failure), `impl FlashBackend`, `MockBackend::target(family) -> Target` with ids `"mock:esp32" | "mock:stm32" | "mock:nrf"`.
  - `demo_plan(family: Family) -> FlashPlan`: ESP32 = 4 regions (bootloader `0x0` 21 KiB, partition-table `0x8000` 3 KiB, ota-data `0xD000` 8 KiB, app `0x10000` 1 100 KiB) with `chip = Some("esp32s3")`; STM32 = one region `0x0800_0000` 450 KiB; nRF = one region `0x0` 300 KiB.
  - Event contract every backend follows: `Connecting` (bytes 0) → `Erasing` (0) → one `Writing` per chunk (monotonic `bytes_done`) → `Verifying` if `plan.verify` → `Resetting` if `plan.reset_after`.

- [ ] **Step 1: Write the tests**

`crates/flashr-core/src/mock.rs` (tests first, implementation in Step 3):

```rust
use std::thread;
use std::time::{Duration, Instant};

use crate::{
    CancelToken, ChipInfo, EraseScope, Family, FlashBackend, FlashError, FlashPlan, FlashReport, Phase,
    ProgressEvent, ProgressSink, Region, Target,
};

/// Size of one simulated write, like a flash sector.
const CHUNK: usize = 4096;

/// Simulated backend: one fake board per family, configurable speed and failure.
#[derive(Debug, Clone, Default)]
pub struct MockBackend {
    /// Pause after each chunk, to make progress visible in the UI.
    pub chunk_delay: Duration,
    /// Fail with a device error once this share of the job is written.
    pub fail_at_percent: Option<u8>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ErrorCode, RecordingSink, UserFacingError};

    fn small_plan() -> FlashPlan {
        FlashPlan::new(
            Family::Esp32,
            vec![Region::new(0x0, "bootloader", vec![0; 3 * CHUNK]), Region::new(0x1_0000, "app", vec![0; 5 * CHUNK])],
        )
    }

    fn kinds(events: &[ProgressEvent]) -> Vec<&'static str> {
        events
            .iter()
            .map(|e| match e.phase {
                Phase::Connecting => "connecting",
                Phase::Erasing => "erasing",
                Phase::Writing { .. } => "writing",
                Phase::Verifying => "verifying",
                Phase::Resetting => "resetting",
            })
            .collect()
    }

    #[test]
    fn discovers_one_board_per_family() {
        let ids: Vec<_> = MockBackend::default().discover().unwrap().into_iter().map(|t| t.id).collect();
        assert_eq!(ids, ["mock:esp32", "mock:stm32", "mock:nrf"]);
    }

    #[test]
    fn flash_reports_phases_in_order_and_ends_at_total() {
        let sink = RecordingSink::default();
        let plan = small_plan();
        let report = MockBackend::default()
            .flash(&MockBackend::target(Family::Esp32), &plan, &sink, &CancelToken::new())
            .unwrap();

        let events = sink.events();
        let mut expected = vec!["connecting", "erasing"];
        expected.extend(std::iter::repeat_n("writing", 8));
        expected.extend(["verifying", "resetting"]);
        assert_eq!(kinds(&events), expected);
        assert_eq!(events.last().unwrap().bytes_done, plan.total_bytes());
        assert_eq!(report.bytes_written, plan.total_bytes());
        assert!(report.verified);
    }

    #[test]
    fn written_bytes_never_go_backwards() {
        let sink = RecordingSink::default();
        MockBackend::default()
            .flash(&MockBackend::target(Family::Esp32), &small_plan(), &sink, &CancelToken::new())
            .unwrap();
        let done: Vec<u64> = sink.events().iter().map(|e| e.bytes_done).collect();
        assert!(done.windows(2).all(|w| w[0] <= w[1]), "{done:?}");
    }

    #[test]
    fn skips_verify_and_reset_when_disabled() {
        let sink = RecordingSink::default();
        let mut plan = small_plan();
        plan.verify = false;
        plan.reset_after = false;
        let report = MockBackend::default()
            .flash(&MockBackend::target(Family::Esp32), &plan, &sink, &CancelToken::new())
            .unwrap();
        assert_eq!(kinds(&sink.events()).last(), Some(&"writing"));
        assert!(!report.verified);
    }

    /// Cancels the job as soon as the first chunk is written.
    struct CancelOnFirstWrite {
        token: CancelToken,
        inner: RecordingSink,
    }

    impl ProgressSink for CancelOnFirstWrite {
        fn report(&self, event: ProgressEvent) {
            if matches!(event.phase, Phase::Writing { .. }) {
                self.token.cancel();
            }
            self.inner.report(event);
        }
    }

    #[test]
    fn cancel_stops_within_one_chunk() {
        let token = CancelToken::new();
        let sink = CancelOnFirstWrite { token: token.clone(), inner: RecordingSink::default() };
        let err = MockBackend::default()
            .flash(&MockBackend::target(Family::Esp32), &small_plan(), &sink, &token)
            .unwrap_err();
        assert!(matches!(err, FlashError::Cancelled));
        let writes = kinds(&sink.inner.events()).iter().filter(|k| **k == "writing").count();
        assert_eq!(writes, 1);
    }

    #[test]
    fn fails_at_requested_percentage() {
        let sink = RecordingSink::default();
        let plan = small_plan();
        let backend = MockBackend { fail_at_percent: Some(50), ..MockBackend::default() };
        let err = backend.flash(&MockBackend::target(Family::Esp32), &plan, &sink, &CancelToken::new()).unwrap_err();
        assert_eq!(UserFacingError::from(&err).code, ErrorCode::DeviceError);
        assert!(sink.events().last().unwrap().bytes_done < plan.total_bytes());
    }

    #[test]
    fn invalid_plan_emits_no_progress() {
        let sink = RecordingSink::default();
        let plan = FlashPlan::new(Family::Esp32, vec![]);
        let err = MockBackend::default()
            .flash(&MockBackend::target(Family::Esp32), &plan, &sink, &CancelToken::new())
            .unwrap_err();
        assert!(matches!(err, FlashError::InvalidPlan(_)));
        assert!(sink.events().is_empty());
    }

    #[test]
    fn refuses_a_plan_for_another_family() {
        let sink = RecordingSink::default();
        let err = MockBackend::default()
            .flash(&MockBackend::target(Family::Nrf), &small_plan(), &sink, &CancelToken::new())
            .unwrap_err();
        assert!(matches!(err, FlashError::FamilyMismatch { plan: Family::Esp32, target: Family::Nrf }));
        assert!(sink.events().is_empty());
    }

    #[test]
    fn demo_plans_are_valid_for_every_family() {
        for family in Family::ALL {
            let plan = demo_plan(family);
            assert_eq!(plan.family, family);
            assert_eq!(plan.validate(), Ok(()), "{family:?}");
        }
        assert_eq!(demo_plan(Family::Esp32).regions.len(), 4);
        assert_eq!(demo_plan(Family::Esp32).chip.as_deref(), Some("esp32s3"));
    }
}
```

Modify `crates/flashr-core/src/lib.rs`: add `pub mod mock;` after `pub mod family;` and `pub use mock::{MockBackend, demo_plan};` after the `family` re-export.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test -p flashr-core mock`
Expected: compilation FAILS: `FlashBackend` not implemented for `MockBackend`, `no function named 'target'`, `cannot find function 'demo_plan'`.

- [ ] **Step 3: Implement `MockBackend` and `demo_plan`**

Add to `mock.rs`, between the struct and the tests:

```rust
impl MockBackend {
    /// The simulated board for a family.
    pub fn target(family: Family) -> Target {
        let (id, label) = match family {
            Family::Esp32 => ("mock:esp32", "Carte simulée · ESP32-S3"),
            Family::Stm32 => ("mock:stm32", "Sonde simulée · STM32F411"),
            Family::Nrf => ("mock:nrf", "DK simulé · nRF52840"),
        };
        Target { id: id.into(), family, label: label.into() }
    }

    fn pause(&self, cancel: &CancelToken) -> Result<(), FlashError> {
        if cancel.is_cancelled() {
            return Err(FlashError::Cancelled);
        }
        if !self.chunk_delay.is_zero() {
            thread::sleep(self.chunk_delay);
        }
        Ok(())
    }
}

impl FlashBackend for MockBackend {
    fn families(&self) -> &'static [Family] {
        &Family::ALL
    }

    fn discover(&self) -> Result<Vec<Target>, FlashError> {
        Ok(Family::ALL.into_iter().map(Self::target).collect())
    }

    fn identify(&self, target: &Target) -> Result<ChipInfo, FlashError> {
        Ok(ChipInfo { model: target.label.clone(), flash_size: Some(8 * 1024 * 1024), details: vec![] })
    }

    fn flash(
        &self,
        target: &Target,
        plan: &FlashPlan,
        progress: &dyn ProgressSink,
        cancel: &CancelToken,
    ) -> Result<FlashReport, FlashError> {
        plan.validate()?;
        if plan.family != target.family {
            return Err(FlashError::FamilyMismatch { plan: plan.family, target: target.family });
        }

        let started = Instant::now();
        let total = plan.total_bytes();
        let emit = |phase: Phase, done: u64| progress.report(ProgressEvent { phase, bytes_done: done, bytes_total: total });

        emit(Phase::Connecting, 0);
        self.pause(cancel)?;
        emit(Phase::Erasing, 0);
        self.pause(cancel)?;

        let mut done: u64 = 0;
        let count = plan.regions.len();
        for (index, region) in plan.regions.iter().enumerate() {
            for chunk in region.data.chunks(CHUNK) {
                self.pause(cancel)?;
                done += chunk.len() as u64;
                if let Some(limit) = self.fail_at_percent
                    && done * 100 >= u64::from(limit) * total
                {
                    return Err(FlashError::Device("simulated disconnect".into()));
                }
                let phase = Phase::Writing { index, count, label: region.label.clone(), address: region.address };
                emit(phase, done);
            }
        }

        if plan.verify {
            emit(Phase::Verifying, done);
            self.pause(cancel)?;
        }
        if plan.reset_after {
            emit(Phase::Resetting, done);
        }
        Ok(FlashReport { bytes_written: done, duration_ms: started.elapsed().as_millis() as u64, verified: plan.verify })
    }

    fn erase(&self, _target: &Target, _scope: EraseScope, progress: &dyn ProgressSink) -> Result<(), FlashError> {
        progress.report(ProgressEvent { phase: Phase::Erasing, bytes_done: 0, bytes_total: 0 });
        Ok(())
    }
}

/// A realistic plan per family, used by the demo screen until real packages exist (plan 4).
pub fn demo_plan(family: Family) -> FlashPlan {
    const KIB: usize = 1024;
    match family {
        Family::Esp32 => {
            let mut plan = FlashPlan::new(
                family,
                vec![
                    Region::new(0x0, "bootloader.bin", vec![0xFF; 21 * KIB]),
                    Region::new(0x8000, "partition-table.bin", vec![0xFF; 3 * KIB]),
                    Region::new(0xD000, "ota_data_initial.bin", vec![0xFF; 8 * KIB]),
                    Region::new(0x1_0000, "thermostat.bin", vec![0xFF; 1100 * KIB]),
                ],
            );
            plan.chip = Some("esp32s3".into());
            plan
        }
        Family::Stm32 => FlashPlan::new(family, vec![Region::new(0x0800_0000, "passerelle.bin", vec![0xFF; 450 * KIB])]),
        Family::Nrf => FlashPlan::new(family, vec![Region::new(0x0, "capteur-porte.hex", vec![0xFF; 300 * KIB])]),
    }
}
```

The `if let … && …` let-chain requires edition 2024 (set in Task 1).

- [ ] **Step 4: Run the tests, format and lint**

Run: `cargo fmt && cargo test -p flashr-core && cargo clippy -p flashr-core --all-targets -- -D warnings`
Expected: 28 tests PASS (19 + 9 mock), clippy clean.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/foundations -m "feat(core): add mock backend and demo plans

Simulated boards for the three families with configurable speed and
failure, following the progress contract real backends will use."
```

---

### Task 4: Tauri 2 shell and Svelte frontend that build and open a window

**Files:**
- Modify: `Cargo.toml` (members)
- Create: `app/package.json`, `app/index.html`, `app/vite.config.ts`, `app/svelte.config.js`, `app/tsconfig.json`, `app/src/vite-env.d.ts`, `app/src/main.ts`, `app/src/App.svelte`, `app/src/styles/tokens.css`, `app/src/styles/base.css`
- Create: `app/src-tauri/Cargo.toml`, `app/src-tauri/build.rs`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/capabilities/default.json`, `app/src-tauri/icons/app-icon.svg` (+ generated icons), `app/src-tauri/src/main.rs`, `app/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: nothing from Tasks 1–3 yet (the app crate depends on `flashr-core` so Task 5 can use it).
- Produces:
  - Tauri command `app_info` → `{ name: "Chip Flashr", version: "0.1.0" }` (TS type `AppInfo`).
  - `chip_flashr_lib::run()` entry point; `fn app_info_value() -> AppInfo`.
  - CSS custom properties `--cf-*` (tokens) available to every component.
  - Scripts: `pnpm dev`, `pnpm build`, `pnpm check`, `pnpm test`, `pnpm tauri …` (run inside `app/`).

- [ ] **Step 1: Add the app crate to the workspace**

In the root `Cargo.toml`, set:

```toml
members = ["crates/*", "app/src-tauri"]
```

- [ ] **Step 2: Create the frontend project**

`app/package.json`:

```json
{
  "name": "chip-flashr-ui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "check": "svelte-check --tsconfig ./tsconfig.json --fail-on-warnings",
    "test": "vitest run",
    "tauri": "tauri"
  }
}
```

Install dependencies (from `app/`; pnpm resolves compatible current versions and writes `pnpm-lock.yaml`):

```bash
cd app
pnpm add @tauri-apps/api@^2
pnpm add -D @tauri-apps/cli@^2 svelte@^5 @sveltejs/vite-plugin-svelte vite typescript svelte-check @tsconfig/svelte vitest
```

Expected: `package.json` gains `dependencies` and `devDependencies`; no peer-dependency errors. If pnpm reports a peer conflict between `vite` and `@sveltejs/vite-plugin-svelte`, install the `vite` major that the plugin's `peerDependencies` names (`pnpm view @sveltejs/vite-plugin-svelte peerDependencies`).

`app/index.html`:

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chip Flashr</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`app/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// Tauri loads the dev server on a fixed port and prints its own logs.
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { target: 'es2022' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

`app/svelte.config.js`:

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
```

`app/tsconfig.json`:

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"]
}
```

`app/src/vite-env.d.ts`:

```ts
/// <reference types="svelte" />
/// <reference types="vite/client" />
```

`app/src/styles/tokens.css` (values from [ux-design.md](../../ux-design.md#visual-language)):

```css
:root {
  --cf-ground: #e3e1dc;
  --cf-surface: #fbf8f1;
  --cf-surface-2: #f2ede3;
  --cf-surface-3: #e6e0d4;
  --cf-line: #d8d1c3;
  --cf-ink: #1b1a18;
  --cf-muted: #57534c;
  --cf-faint: #67625a;
  --cf-primary: #262420;
  --cf-on-primary: #fbf8f1;
  --cf-selection: #eee4d0;
  --cf-ok: #2c7550;
  --cf-ok-weak: #e1efe3;
  --cf-warn: #945800;
  --cf-warn-weak: #f8ebd3;
  --cf-err: #b0281f;
  --cf-err-weak: #f8e3df;

  --cf-radius-card: 18px;
  --cf-radius-control: 13px;

  --cf-font-display: 'Bricolage Grotesque', 'Segoe UI', system-ui, sans-serif;
  --cf-font-ui: 'Instrument Sans', 'Segoe UI', system-ui, sans-serif;
  --cf-font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', Menlo, monospace;

  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --cf-ground: #151412;
    --cf-surface: #1f1d1a;
    --cf-surface-2: #272420;
    --cf-surface-3: #312d28;
    --cf-line: #3a3530;
    --cf-ink: #f0eadd;
    --cf-muted: #b6aea1;
    --cf-faint: #a8a093;
    --cf-primary: #efe6d3;
    --cf-on-primary: #1b1a18;
    --cf-selection: #3a3329;
    --cf-ok: #6cc794;
    --cf-ok-weak: #1c2e22;
    --cf-warn: #e8ad55;
    --cf-warn-weak: #33280f;
    --cf-err: #f08a7e;
    --cf-err-weak: #3a1d19;

    color-scheme: dark;
  }
}
```

`app/src/styles/base.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  height: 100%;
}

body {
  background: var(--cf-ground);
  color: var(--cf-ink);
  font-family: var(--cf-font-ui);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

`app/src/main.ts`:

```ts
import { mount } from 'svelte';
import App from './App.svelte';
import './styles/tokens.css';
import './styles/base.css';

const target = document.getElementById('app');
if (!target) throw new Error('#app element missing from index.html');

export default mount(App, { target });
```

`app/src/App.svelte` (temporary: proves the IPC round trip; replaced in Task 6):

```svelte
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';

  type AppInfo = { name: string; version: string };
  let info = $state<AppInfo | null>(null);

  onMount(async () => {
    info = await invoke<AppInfo>('app_info');
  });
</script>

<main>
  <h1>{info?.name ?? 'Chip Flashr'}</h1>
  <p>{info ? `v${info.version}` : 'Connexion au cœur Rust…'}</p>
</main>

<style>
  main {
    display: grid;
    place-content: center;
    height: 100%;
    text-align: center;
  }
  h1 {
    margin: 0;
    font-family: var(--cf-font-display);
    font-size: 32px;
  }
  p {
    color: var(--cf-muted);
  }
</style>
```

- [ ] **Step 3: Verify the frontend on its own**

Run (in `app/`): `pnpm check && pnpm build`
Expected: `svelte-check found 0 errors and 0 warnings`; Vite writes `app/dist/index.html`.

- [ ] **Step 4: Create the Tauri crate**

`app/src-tauri/Cargo.toml`:

```toml
[package]
name = "chip-flashr"
description = "Flash ESP32, STM32 and Nordic nRF microcontrollers"
version.workspace = true
edition.workspace = true
license.workspace = true
rust-version.workspace = true

[lib]
name = "chip_flashr_lib"
crate-type = ["rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde.workspace = true
serde_json.workspace = true
flashr-core.workspace = true
```

`app/src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

`app/src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Chip Flashr",
  "version": "0.1.0",
  "identifier": "io.github.loutrx.chipflashr",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Chip Flashr",
        "width": 1200,
        "height": 760,
        "minWidth": 960,
        "minHeight": 640
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

`app/src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Main window: Tauri core defaults. App commands are registered in lib.rs.",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

`app/src-tauri/icons/app-icon.svg` (source for the generated icons; the chip mark from the design):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="64" y="64" width="896" height="896" rx="208" fill="#262420"/>
  <g fill="none" stroke="#FBF8F1" stroke-width="56" stroke-linecap="round" stroke-linejoin="round">
    <rect x="352" y="352" width="320" height="320" rx="48"/>
    <path d="M432 232v120M592 232v120M432 672v120M592 672v120M232 432h120M232 592h120M672 432h120M672 592h120"/>
  </g>
</svg>
```

Generate the icon set, then drop the mobile variants this desktop app doesn't use:

```bash
cd app
pnpm tauri icon src-tauri/icons/app-icon.svg -o src-tauri/icons
rm -rf src-tauri/icons/android src-tauri/icons/ios
```

If your `@tauri-apps/cli` version rejects SVG input, export the SVG to a 1024 × 1024 PNG (any browser or image editor) and pass that PNG instead.

Expected: `src-tauri/icons/` contains `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, `icon.png` (and Windows `Square*Logo.png` files, which can stay).

`app/src-tauri/src/main.rs`:

```rust
// Hide the extra console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    chip_flashr_lib::run()
}
```

`app/src-tauri/src/lib.rs` (test first):

```rust
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_reports_product_name_and_crate_version() {
        assert_eq!(app_info_value(), AppInfo { name: "Chip Flashr", version: env!("CARGO_PKG_VERSION") });
    }
}
```

- [ ] **Step 5: Run the Rust test to verify it fails**

Run (repo root): `cargo test -p chip-flashr`
Expected: FAILS with `cannot find function 'app_info_value'` (and `main.rs` complaining about missing `run`).

- [ ] **Step 6: Implement the shell**

Add to `app/src-tauri/src/lib.rs`, after the `AppInfo` struct:

```rust
pub fn app_info_value() -> AppInfo {
    AppInfo { name: "Chip Flashr", version: env!("CARGO_PKG_VERSION") }
}

#[tauri::command]
fn app_info() -> AppInfo {
    app_info_value()
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running Chip Flashr");
}
```

- [ ] **Step 7: Run the tests, lint, and launch the app**

Run (repo root): `cargo fmt && cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings`
Expected: 29 tests PASS (28 core + 1 app), clippy clean. On Linux this needs the WebKitGTK packages listed in Task 7.

Run (in `app/`): `pnpm tauri dev`
Expected: a 1200 × 760 window titled **Chip Flashr** shows "Chip Flashr" and "v0.1.0" on the warm grey background (dark background if the OS is in dark mode). Close the window to stop.

- [ ] **Step 8: Commit**

```bash
but commit -b feat/foundations -m "feat(app): add Tauri 2 shell with Svelte 5 frontend

Window 1200x760, design tokens (light/dark), app_info command proving the
Rust <-> UI round trip. Icons generated from the chip mark."
```

---

### Task 5: Flash jobs in the shell: one job at a time, cancellable, streamed progress

**Files:**
- Create: `app/src-tauri/src/jobs.rs`, `app/src-tauri/src/state.rs`, `app/src-tauri/src/commands.rs`
- Modify: `app/src-tauri/src/lib.rs` (modules, managed state, handlers)

**Interfaces:**
- Consumes: `FlashBackend`, `MockBackend`, `demo_plan`, `Target`, `FlashPlan`, `FlashReport`, `ProgressEvent`, `ProgressSink`, `RecordingSink`, `CancelToken`, `ErrorCode`, `UserFacingError` (Tasks 1–3).
- Produces (Tauri commands, called from TypeScript in Task 6):
  - `list_targets() -> Target[]`
  - `flash_demo(targetId: string, onProgress: Channel<ProgressEvent>) -> FlashReport`; rejects with `UserFacingError` (`target-not-found`, `already-running`, `cancelled`, `device-error`, …)
  - `cancel_flash() -> boolean` (false when nothing runs)
- Rust internals: `JobSlot` (`start(self: &Arc<Self>) -> Result<RunningJob, UserFacingError>`, `cancel() -> bool`), `RunningJob { token: CancelToken }` releasing the slot on drop; `run_flash_job(...)`; `AppState { backends, jobs }` with `from_env()`, `list_targets()`, `find(id)`; `mock_from_env(value: Option<&str>) -> MockBackend`.
- Dev switch: environment variable `CHIP_FLASHR_MOCK_FAIL_AT=<0..=100>` makes the mock fail at that percentage (to see the failure screen).

- [ ] **Step 1: Write the job tests**

`app/src-tauri/src/jobs.rs`:

```rust
use std::sync::{Arc, Mutex};

use flashr_core::{CancelToken, ErrorCode, FlashBackend, FlashPlan, FlashReport, ProgressSink, Target, UserFacingError};

/// At most one flash job at a time; holds the running job's cancel token.
#[derive(Debug, Default)]
pub struct JobSlot(Mutex<Option<CancelToken>>);

/// Proof that the slot is held. Dropping it frees the slot, whatever the job's outcome.
#[derive(Debug)]
pub struct RunningJob {
    pub token: CancelToken,
    slot: Arc<JobSlot>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use flashr_core::{Family, MockBackend, Phase, ProgressEvent, RecordingSink, demo_plan};

    fn esp() -> Target {
        MockBackend::target(Family::Esp32)
    }

    #[test]
    fn successful_job_returns_the_report() {
        let slot = Arc::new(JobSlot::default());
        let job = slot.start().unwrap();
        let plan = demo_plan(Family::Esp32);
        let report = run_flash_job(&MockBackend::default(), &esp(), &plan, &RecordingSink::default(), &job.token).unwrap();
        assert_eq!(report.bytes_written, plan.total_bytes());
    }

    #[test]
    fn second_job_is_refused_while_first_runs() {
        let slot = Arc::new(JobSlot::default());
        let _first = slot.start().unwrap();
        let err = slot.start().unwrap_err();
        assert_eq!(err.code, ErrorCode::AlreadyRunning);
    }

    #[test]
    fn slot_is_released_after_a_failed_job() {
        let slot = Arc::new(JobSlot::default());
        {
            let job = slot.start().unwrap();
            let failing = MockBackend { fail_at_percent: Some(10), ..MockBackend::default() };
            let err = run_flash_job(&failing, &esp(), &demo_plan(Family::Esp32), &RecordingSink::default(), &job.token)
                .unwrap_err();
            assert_eq!(err.code, ErrorCode::DeviceError);
        }
        assert!(slot.start().is_ok(), "the slot must be free once the failed job is dropped");
    }

    #[test]
    fn cancel_without_a_job_reports_false() {
        assert!(!JobSlot::default().cancel());
    }

    /// Asks the slot to cancel as soon as writing starts, like a user clicking "Annuler".
    struct ClickCancel(Arc<JobSlot>, RecordingSink);

    impl ProgressSink for ClickCancel {
        fn report(&self, event: ProgressEvent) {
            if matches!(event.phase, Phase::Writing { .. }) {
                assert!(self.0.cancel());
            }
            self.1.report(event);
        }
    }

    #[test]
    fn cancel_mid_job_reports_cancelled() {
        let slot = Arc::new(JobSlot::default());
        let job = slot.start().unwrap();
        let sink = ClickCancel(slot.clone(), RecordingSink::default());
        let err = run_flash_job(&MockBackend::default(), &esp(), &demo_plan(Family::Esp32), &sink, &job.token).unwrap_err();
        assert_eq!(err.code, ErrorCode::Cancelled);
    }
}
```

`app/src-tauri/src/state.rs`:

```rust
use std::sync::Arc;
use std::time::Duration;

use flashr_core::{FlashBackend, MockBackend, Target};

use crate::jobs::JobSlot;

/// Everything the commands share. Managed by Tauri.
pub struct AppState {
    pub backends: Vec<Arc<dyn FlashBackend>>,
    pub jobs: Arc<JobSlot>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_the_three_simulated_boards() {
        let ids: Vec<_> = AppState::from_env().list_targets().into_iter().map(|t| t.id).collect();
        assert_eq!(ids, ["mock:esp32", "mock:stm32", "mock:nrf"]);
    }

    #[test]
    fn finds_a_target_by_id_and_rejects_unknown_ids() {
        let state = AppState::from_env();
        assert_eq!(state.find("mock:nrf").map(|(_, t)| t.label), Some("DK simulé · nRF52840".to_string()));
        assert!(state.find("serial:COM99").is_none());
    }

    #[test]
    fn failure_switch_accepts_only_percentages() {
        assert_eq!(mock_from_env(Some("41")).fail_at_percent, Some(41));
        assert_eq!(mock_from_env(Some(" 0 ")).fail_at_percent, Some(0));
        assert_eq!(mock_from_env(Some("150")).fail_at_percent, None);
        assert_eq!(mock_from_env(Some("abc")).fail_at_percent, None);
        assert_eq!(mock_from_env(None).fail_at_percent, None);
    }

    #[test]
    fn mock_is_slow_enough_to_watch() {
        assert_eq!(mock_from_env(None).chunk_delay, Duration::from_millis(15));
    }
}
```

`app/src-tauri/src/commands.rs` (thin glue, exercised manually in Task 6 and through `run_flash_job` tests above):

```rust
use flashr_core::{ErrorCode, FlashReport, ProgressEvent, ProgressSink, Target, UserFacingError, demo_plan};
use tauri::State;
use tauri::ipc::Channel;

use crate::jobs::run_flash_job;
use crate::state::AppState;

/// Forwards backend progress to the UI over a Tauri channel.
struct ChannelSink(Channel<ProgressEvent>);

impl ProgressSink for ChannelSink {
    fn report(&self, event: ProgressEvent) {
        // The window may be closing; losing a progress tick is harmless.
        let _ = self.0.send(event);
    }
}

#[tauri::command]
pub fn list_targets(state: State<'_, AppState>) -> Vec<Target> {
    state.list_targets()
}

#[tauri::command]
pub async fn flash_demo(
    state: State<'_, AppState>,
    target_id: String,
    on_progress: Channel<ProgressEvent>,
) -> Result<FlashReport, UserFacingError> {
    let (backend, target) = state
        .find(&target_id)
        .ok_or_else(|| UserFacingError::new(ErrorCode::TargetNotFound, format!("unknown target `{target_id}`")))?;
    let job = state.jobs.start()?;
    let plan = demo_plan(target.family);
    let sink = ChannelSink(on_progress);

    tauri::async_runtime::spawn_blocking(move || {
        let result = run_flash_job(backend.as_ref(), &target, &plan, &sink, &job.token);
        drop(job); // free the slot before answering the UI
        result
    })
    .await
    .map_err(|e| UserFacingError::new(ErrorCode::DeviceError, format!("flash worker stopped: {e}")))?
}

#[tauri::command]
pub fn cancel_flash(state: State<'_, AppState>) -> bool {
    state.jobs.cancel()
}
```

Modify `app/src-tauri/src/lib.rs`: add at the top

```rust
mod commands;
mod jobs;
mod state;
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test -p chip-flashr`
Expected: compilation FAILS: no method `start`/`cancel` on `JobSlot`, `cannot find function 'run_flash_job'`, no function `from_env`/`list_targets`/`find`, `cannot find function 'mock_from_env'`.

- [ ] **Step 3: Implement jobs and state, register the commands**

Append to `jobs.rs`, before the tests:

```rust
impl JobSlot {
    /// Reserve the slot for a new job, or refuse if one is running.
    pub fn start(self: &Arc<Self>) -> Result<RunningJob, UserFacingError> {
        let mut current = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if current.is_some() {
            return Err(UserFacingError::new(ErrorCode::AlreadyRunning, "a flash job is already running"));
        }
        let token = CancelToken::new();
        *current = Some(token.clone());
        Ok(RunningJob { token, slot: Arc::clone(self) })
    }

    /// Ask the running job to stop. Returns false when nothing runs.
    pub fn cancel(&self) -> bool {
        match &*self.0.lock().unwrap_or_else(|e| e.into_inner()) {
            Some(token) => {
                token.cancel();
                true
            }
            None => false,
        }
    }
}

impl Drop for RunningJob {
    fn drop(&mut self) {
        *self.slot.0.lock().unwrap_or_else(|e| e.into_inner()) = None;
    }
}

/// Run one job on the current thread and translate the outcome for the UI.
pub fn run_flash_job(
    backend: &dyn FlashBackend,
    target: &Target,
    plan: &FlashPlan,
    sink: &dyn ProgressSink,
    cancel: &CancelToken,
) -> Result<FlashReport, UserFacingError> {
    backend.flash(target, plan, sink, cancel).map_err(|e| UserFacingError::from(&e))
}
```

Append to `state.rs`, before the tests:

```rust
/// Mock tuned for the demo screen. `CHIP_FLASHR_MOCK_FAIL_AT` (0–100) injects a failure.
pub fn mock_from_env(fail_at: Option<&str>) -> MockBackend {
    MockBackend {
        chunk_delay: Duration::from_millis(15),
        fail_at_percent: fail_at.and_then(|v| v.trim().parse::<u8>().ok()).filter(|p| *p <= 100),
    }
}

impl AppState {
    /// Until real backends land (plan 6), the app runs on the mock.
    pub fn from_env() -> Self {
        let mock = mock_from_env(std::env::var("CHIP_FLASHR_MOCK_FAIL_AT").ok().as_deref());
        Self { backends: vec![Arc::new(mock)], jobs: Arc::default() }
    }

    /// Every reachable target across backends. A backend that fails to enumerate is skipped.
    pub fn list_targets(&self) -> Vec<Target> {
        self.backends.iter().flat_map(|b| b.discover().unwrap_or_default()).collect()
    }

    pub fn find(&self, target_id: &str) -> Option<(Arc<dyn FlashBackend>, Target)> {
        self.backends.iter().find_map(|b| {
            b.discover().ok()?.into_iter().find(|t| t.id == target_id).map(|t| (Arc::clone(b), t))
        })
    }
}
```

Replace `run()` in `app/src-tauri/src/lib.rs`:

```rust
pub fn run() {
    tauri::Builder::default()
        .manage(state::AppState::from_env())
        .invoke_handler(tauri::generate_handler![
            app_info,
            commands::list_targets,
            commands::flash_demo,
            commands::cancel_flash
        ])
        .run(tauri::generate_context!())
        .expect("error while running Chip Flashr");
}
```

- [ ] **Step 4: Run the tests and lint**

Run: `cargo fmt && cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings`
Expected: 38 tests PASS (28 core + 10 app), clippy clean.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/foundations -m "feat(app): run flash jobs on a worker with cancel and progress channel

One job at a time (already-running otherwise), slot freed on drop even on
failure, progress streamed over a Tauri Channel. Mock failure switch:
CHIP_FLASHR_MOCK_FAIL_AT."
```

---

### Task 6: Frontend: typed IPC, flash state reducer, French messages, demo screen

**Files:**
- Create: `app/src/lib/types.ts`, `app/src/lib/ipc.ts`, `app/src/lib/flashState.ts`, `app/src/lib/flashState.test.ts`, `app/src/lib/messages.ts`, `app/src/lib/messages.test.ts`
- Modify: `app/src/App.svelte` (replace whole file)

**Interfaces:**
- Consumes: Tauri commands `app_info`, `list_targets`, `flash_demo`, `cancel_flash` (Tasks 4–5) and their JSON shapes (serde camelCase, `Phase.kind`, kebab-case `ErrorCode`).
- Produces (reused by plans 2–3):
  - `types.ts`: `Family`, `Target`, `Phase`, `ProgressEvent`, `FlashReport`, `ErrorCode`, `UserFacingError`, `AppInfo`.
  - `ipc.ts`: `appInfo()`, `listTargets()`, `flashDemo(targetId, onProgress)`, `cancelFlash()`.
  - `flashState.ts`: `FlashState`, `FlashAction`, `flashReducer(state, action)`, `percentOf(event)`, `toUserFacingError(unknown)`.
  - `messages.ts`: `errorMessages: Record<ErrorCode, { title; explanation }>`, `phaseLabel(phase | null)`.

- [ ] **Step 1: Write the types and the failing tests**

`app/src/lib/types.ts` (mirrors the Rust serde output exactly):

```ts
export type Family = 'esp32' | 'stm32' | 'nrf';

export interface Target {
  id: string;
  family: Family;
  label: string;
}

export type Phase =
  | { kind: 'connecting' }
  | { kind: 'erasing' }
  | { kind: 'writing'; index: number; count: number; label: string; address: number }
  | { kind: 'verifying' }
  | { kind: 'resetting' };

export interface ProgressEvent {
  phase: Phase;
  bytesDone: number;
  bytesTotal: number;
}

export interface FlashReport {
  bytesWritten: number;
  durationMs: number;
  verified: boolean;
}

export type ErrorCode =
  | 'cancelled'
  | 'target-not-found'
  | 'invalid-plan'
  | 'family-mismatch'
  | 'device-error'
  | 'already-running';

export interface UserFacingError {
  code: ErrorCode;
  technical: string;
}

export interface AppInfo {
  name: string;
  version: string;
}
```

`app/src/lib/flashState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flashReducer, percentOf, toUserFacingError, type FlashState } from './flashState';
import type { ProgressEvent } from './types';

const writing = (done: number, total: number): ProgressEvent => ({
  phase: { kind: 'writing', index: 0, count: 1, label: 'app.bin', address: 0x10000 },
  bytesDone: done,
  bytesTotal: total,
});

describe('percentOf', () => {
  it('is 0 when there is nothing to write', () => {
    expect(percentOf(writing(0, 0))).toBe(0);
  });
  it('floors and clamps to 0..100', () => {
    expect(percentOf(writing(1, 3))).toBe(33);
    expect(percentOf(writing(300, 200))).toBe(100);
    expect(percentOf(writing(-5, 200))).toBe(0);
  });
});

describe('flashReducer', () => {
  const idle: FlashState = { status: 'idle' };

  it('starts at 0 %', () => {
    expect(flashReducer(idle, { type: 'start' })).toEqual({ status: 'flashing', percent: 0, phase: null });
  });

  it('follows progress and keeps the phase', () => {
    const s = flashReducer(flashReducer(idle, { type: 'start' }), { type: 'progress', event: writing(50, 100) });
    expect(s).toEqual({ status: 'flashing', percent: 50, phase: writing(50, 100).phase });
  });

  it('never goes backwards', () => {
    let s = flashReducer(idle, { type: 'start' });
    s = flashReducer(s, { type: 'progress', event: writing(80, 100) });
    s = flashReducer(s, { type: 'progress', event: writing(20, 100) });
    expect(s.status === 'flashing' && s.percent).toBe(80);
  });

  it('ignores a second start while flashing', () => {
    const flashing = flashReducer(flashReducer(idle, { type: 'start' }), { type: 'progress', event: writing(40, 100) });
    expect(flashReducer(flashing, { type: 'start' })).toBe(flashing);
  });

  it('ignores progress after failure', () => {
    const failed = flashReducer(flashReducer(idle, { type: 'start' }), {
      type: 'failure',
      error: { code: 'device-error', technical: 'timeout' },
    });
    expect(flashReducer(failed, { type: 'progress', event: writing(99, 100) })).toBe(failed);
  });

  it('goes back to idle on reset', () => {
    const done = flashReducer(idle, { type: 'success', report: { bytesWritten: 1, durationMs: 2, verified: true } });
    expect(flashReducer(done, { type: 'reset' })).toEqual(idle);
  });
});

describe('toUserFacingError', () => {
  it('keeps a structured error from Rust', () => {
    expect(toUserFacingError({ code: 'cancelled', technical: 'cancelled by the user' })).toEqual({
      code: 'cancelled',
      technical: 'cancelled by the user',
    });
  });
  it('wraps anything else as a device error', () => {
    expect(toUserFacingError('IPC broken')).toEqual({ code: 'device-error', technical: 'IPC broken' });
    expect(toUserFacingError({ code: 'not-a-real-code', technical: 'x' }).code).toBe('device-error');
  });
});
```

`app/src/lib/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { errorMessages, phaseLabel } from './messages';
import type { ErrorCode } from './types';

describe('phaseLabel', () => {
  it('numbers files from 1 and names them', () => {
    expect(phaseLabel({ kind: 'writing', index: 3, count: 4, label: 'thermostat.bin', address: 0x10000 })).toBe(
      'Écriture 4/4 · thermostat.bin',
    );
  });
  it('has a label for every other phase and for no phase yet', () => {
    expect(phaseLabel(null)).toBe('Préparation…');
    expect(phaseLabel({ kind: 'connecting' })).toBe('Connexion à la carte');
    expect(phaseLabel({ kind: 'erasing' })).toBe('Effacement des zones');
    expect(phaseLabel({ kind: 'verifying' })).toBe('Vérification');
    expect(phaseLabel({ kind: 'resetting' })).toBe('Redémarrage de la carte');
  });
});

describe('errorMessages', () => {
  it('has a French title and explanation for every code', () => {
    const codes: ErrorCode[] = [
      'cancelled',
      'target-not-found',
      'invalid-plan',
      'family-mismatch',
      'device-error',
      'already-running',
    ];
    for (const code of codes) {
      expect(errorMessages[code].title.length).toBeGreaterThan(0);
      expect(errorMessages[code].explanation.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `app/`): `pnpm test`
Expected: FAIL: `Failed to resolve import "./flashState"` and `"./messages"`.

- [ ] **Step 3: Implement state, messages and IPC**

`app/src/lib/flashState.ts`:

```ts
import type { ErrorCode, FlashReport, Phase, ProgressEvent, UserFacingError } from './types';

export type FlashState =
  | { status: 'idle' }
  | { status: 'flashing'; percent: number; phase: Phase | null }
  | { status: 'success'; report: FlashReport }
  | { status: 'failure'; error: UserFacingError };

export type FlashAction =
  | { type: 'start' }
  | { type: 'progress'; event: ProgressEvent }
  | { type: 'success'; report: FlashReport }
  | { type: 'failure'; error: UserFacingError }
  | { type: 'reset' };

/** Whole-job percent, floored, within 0..100; 0 when there is nothing to write. */
export function percentOf(event: ProgressEvent): number {
  if (!(event.bytesTotal > 0)) return 0;
  const raw = Math.floor((event.bytesDone / event.bytesTotal) * 100);
  return Math.min(100, Math.max(0, raw));
}

export function flashReducer(state: FlashState, action: FlashAction): FlashState {
  switch (action.type) {
    case 'start':
      return state.status === 'flashing' ? state : { status: 'flashing', percent: 0, phase: null };
    case 'progress':
      // Late events (after cancel, failure or success) must not revive the progress screen.
      if (state.status !== 'flashing') return state;
      return {
        status: 'flashing',
        percent: Math.max(state.percent, percentOf(action.event)),
        phase: action.event.phase,
      };
    case 'success':
      return { status: 'success', report: action.report };
    case 'failure':
      return { status: 'failure', error: action.error };
    case 'reset':
      return { status: 'idle' };
  }
}

const KNOWN_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  'cancelled',
  'target-not-found',
  'invalid-plan',
  'family-mismatch',
  'device-error',
  'already-running',
]);

/** Normalize whatever `invoke` rejected with into a UserFacingError. */
export function toUserFacingError(error: unknown): UserFacingError {
  if (typeof error === 'object' && error !== null && 'code' in error && 'technical' in error) {
    const { code, technical } = error as { code: unknown; technical: unknown };
    if (typeof code === 'string' && KNOWN_CODES.has(code) && typeof technical === 'string') {
      return { code: code as ErrorCode, technical };
    }
  }
  return { code: 'device-error', technical: typeof error === 'string' ? error : (JSON.stringify(error) ?? String(error)) };
}
```

`app/src/lib/messages.ts`:

```ts
import type { ErrorCode, Phase } from './types';

export const errorMessages: Record<ErrorCode, { title: string; explanation: string }> = {
  cancelled: {
    title: 'Programmation annulée',
    explanation: 'Vous avez arrêté l’opération. Vous pouvez relancer quand vous voulez.',
  },
  'target-not-found': {
    title: 'Carte introuvable',
    explanation: 'La carte a été débranchée ou n’est plus détectée. Rebranchez-la puis réessayez.',
  },
  'invalid-plan': {
    title: 'Firmware invalide',
    explanation: 'Le firmware est incomplet ou ses zones se chevauchent. Demandez un nouveau paquet.',
  },
  'family-mismatch': {
    title: 'Mauvais type de puce',
    explanation: 'Ce firmware ne correspond pas à la carte branchée.',
  },
  'device-error': {
    title: 'La programmation a échoué',
    explanation: 'La carte a cessé de répondre. Elle n’est pas endommagée : vous pouvez relancer.',
  },
  'already-running': {
    title: 'Programmation déjà en cours',
    explanation: 'Attendez la fin de l’opération en cours.',
  },
};

export function phaseLabel(phase: Phase | null): string {
  if (!phase) return 'Préparation…';
  switch (phase.kind) {
    case 'connecting':
      return 'Connexion à la carte';
    case 'erasing':
      return 'Effacement des zones';
    case 'writing':
      return `Écriture ${phase.index + 1}/${phase.count} · ${phase.label}`;
    case 'verifying':
      return 'Vérification';
    case 'resetting':
      return 'Redémarrage de la carte';
  }
}
```

`app/src/lib/ipc.ts`:

```ts
import { Channel, invoke } from '@tauri-apps/api/core';
import type { AppInfo, FlashReport, ProgressEvent, Target } from './types';

export const appInfo = () => invoke<AppInfo>('app_info');

export const listTargets = () => invoke<Target[]>('list_targets');

export const cancelFlash = () => invoke<boolean>('cancel_flash');

/** Program the demo plan on a target; progress arrives on `onProgress`. Rejects with a UserFacingError. */
export function flashDemo(targetId: string, onProgress: (event: ProgressEvent) => void): Promise<FlashReport> {
  const channel = new Channel<ProgressEvent>();
  channel.onmessage = onProgress;
  return invoke<FlashReport>('flash_demo', { targetId, onProgress: channel });
}
```

- [ ] **Step 4: Run the frontend tests**

Run (in `app/`): `pnpm test`
Expected: 13 tests PASS (10 in flashState.test.ts, 3 in messages.test.ts).

- [ ] **Step 5: Replace the demo screen**

`app/src/App.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { flashReducer, toUserFacingError, type FlashAction, type FlashState } from './lib/flashState';
  import { appInfo, cancelFlash, flashDemo, listTargets } from './lib/ipc';
  import { errorMessages, phaseLabel } from './lib/messages';
  import type { AppInfo, Target } from './lib/types';

  let info = $state<AppInfo | null>(null);
  let targets = $state<Target[]>([]);
  let selectedId = $state<string | null>(null);
  let flash = $state<FlashState>({ status: 'idle' });

  const selected = $derived(targets.find((t) => t.id === selectedId) ?? null);
  const busy = $derived(flash.status === 'flashing');

  function dispatch(action: FlashAction) {
    flash = flashReducer(flash, action);
  }

  onMount(async () => {
    info = await appInfo();
    targets = await listTargets();
    selectedId = targets[0]?.id ?? null;
  });

  async function program() {
    if (!selected || busy) return;
    dispatch({ type: 'start' });
    try {
      const report = await flashDemo(selected.id, (event) => dispatch({ type: 'progress', event }));
      dispatch({ type: 'success', report });
    } catch (error) {
      dispatch({ type: 'failure', error: toUserFacingError(error) });
    }
  }
</script>

<div class="window">
  <header class="topbar">
    <span class="brand">Chip Flashr</span>
    <span class="badge">Démo · carte simulée</span>
    <span class="spacer"></span>
    <span class="pill"><span class="dot" class:on={selected !== null}></span>{selected?.label ?? 'Aucune carte'}</span>
  </header>

  <main class="content">
    <section class="card">
      <h2>Carte à programmer</h2>
      <div class="targets" role="radiogroup" aria-label="Carte à programmer">
        {#each targets as target (target.id)}
          <label class="target">
            <input type="radio" name="target" value={target.id} bind:group={selectedId} disabled={busy} />
            {target.label}
          </label>
        {/each}
      </div>
    </section>

    {#if flash.status === 'flashing'}
      <section class="card">
        <p class="percent">{flash.percent} %</p>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={flash.percent}>
          <div class="fill" style:width="{flash.percent}%"></div>
        </div>
        <div class="row">
          <span class="phase">{phaseLabel(flash.phase)}</span>
          <button type="button" class="secondary" onclick={() => cancelFlash()}>Annuler</button>
        </div>
      </section>
    {:else if flash.status === 'success'}
      <section class="card ok">
        <h2>Programmation réussie</h2>
        <p>
          {Math.round(flash.report.bytesWritten / 1024)} Ko écrits en 
          {(flash.report.durationMs / 1000).toFixed(1)} s{flash.report.verified ? ' · vérifié' : ''}.
        </p>
      </section>
    {:else if flash.status === 'failure'}
      <section class="card err">
        <h2>{errorMessages[flash.error.code].title}</h2>
        <p>{errorMessages[flash.error.code].explanation}</p>
        <details>
          <summary>Détails techniques</summary>
          <code>{flash.error.technical}</code>
        </details>
      </section>
    {/if}

    <button type="button" class="primary" onclick={program} disabled={!selected || busy}>
      {flash.status === 'success' || flash.status === 'failure' ? 'Programmer à nouveau' : 'Programmer'}
    </button>
  </main>

  <footer class="status">{info ? `${info.name} v${info.version}` : ''}</footer>
</div>

<style>
  .window {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 60px;
    padding: 0 20px;
    background: var(--cf-surface);
    border-bottom: 1px solid var(--cf-line);
  }
  .brand {
    font-family: var(--cf-font-display);
    font-size: 18px;
    font-weight: 700;
  }
  .badge {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--cf-warn-weak);
    color: var(--cf-warn);
    font-size: 12px;
    font-weight: 600;
  }
  .spacer {
    flex-grow: 1;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--cf-surface-2);
    border: 1px solid var(--cf-line);
    font-size: 13px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--cf-faint);
  }
  .dot.on {
    background: var(--cf-ok);
  }
  .content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
    padding: 28px 32px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    border-radius: var(--cf-radius-card);
    background: var(--cf-surface);
    border: 1px solid var(--cf-line);
  }
  .card.ok {
    background: var(--cf-ok-weak);
  }
  .card.err {
    background: var(--cf-err-weak);
  }
  h2 {
    margin: 0;
    font-family: var(--cf-font-display);
    font-size: 18px;
  }
  p {
    margin: 0;
  }
  .targets {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .target {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
  }
  .percent {
    font-family: var(--cf-font-display);
    font-size: 48px;
    font-weight: 700;
    line-height: 1;
  }
  .bar {
    height: 12px;
    border-radius: 999px;
    background: var(--cf-surface-3);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--cf-primary);
    transition: width 0.15s linear;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .phase {
    color: var(--cf-muted);
  }
  button {
    min-height: 44px;
    padding: 0 18px;
    border-radius: var(--cf-radius-control);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .primary {
    height: 64px;
    border: none;
    background: var(--cf-primary);
    color: var(--cf-on-primary);
    font-family: var(--cf-font-display);
    font-size: 19px;
  }
  .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .secondary {
    border: 1px solid var(--cf-line);
    background: var(--cf-surface);
    color: var(--cf-ink);
  }
  code {
    font-family: var(--cf-font-mono);
    font-size: 12px;
  }
  .status {
    height: 32px;
    display: flex;
    align-items: center;
    padding: 0 20px;
    background: var(--cf-surface);
    border-top: 1px solid var(--cf-line);
    color: var(--cf-faint);
    font-family: var(--cf-font-mono);
    font-size: 12px;
  }
</style>
```

- [ ] **Step 6: Check types and try every path by hand**

Run (in `app/`): `pnpm check && pnpm test`
Expected: 0 errors, 0 warnings; 13 tests PASS.

Run (in `app/`): `pnpm tauri dev`, then verify:

1. The three simulated boards are listed; the pill shows the selected one.
2. **Programmer** → percent rises from 0 to 100 over about 5 s, the phase label goes Connexion → Effacement → Écriture 1/4 … 4/4 → Vérification → Redémarrage, then **Programmation réussie** with the size and duration.
3. **Programmer à nouveau**, then **Annuler** mid-way → **Programmation annulée**, no success card.
4. Stop the app, run `CHIP_FLASHR_MOCK_FAIL_AT=41 pnpm tauri dev` (PowerShell: `$env:CHIP_FLASHR_MOCK_FAIL_AT=41; pnpm tauri dev`) → Programmer stops near 40 % with **La programmation a échoué**, and *Détails techniques* shows `device error: simulated disconnect`.
5. While a job runs, the Programmer button and the board radios are disabled.

- [ ] **Step 7: Commit**

```bash
but commit -b feat/foundations -m "feat(ui): add demo flash screen over typed IPC

Pure flash reducer (monotonic percent, late events ignored), French
messages per error code, cancel and failure paths wired to the mock."
```

---

### Task 7: CI on three OSes and developer docs

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md` (new "Development" section before "Documentation"), `docs/architecture.md` (workspace layout and error model now match the code), `docs/superpowers/plans/README.md` (plan 1 status)

**Interfaces:**
- Consumes: the commands from Tasks 1–6 (`cargo fmt/clippy/test`, `pnpm check/test/build`, `pnpm tauri build --no-bundle`).
- Produces: a required-green CI signal for every later plan.

- [ ] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-22.04, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - name: Linux system dependencies (Tauri)
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
            libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - uses: Swatinem/rust-cache@v2

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: app/pnpm-lock.yaml

      - name: Frontend install
        run: pnpm install --frozen-lockfile
        working-directory: app

      - name: Frontend check and tests
        run: |
          pnpm check
          pnpm test
          pnpm build
        working-directory: app

      - name: Rust format
        run: cargo fmt --all -- --check

      - name: Rust lint
        run: cargo clippy --workspace --all-targets -- -D warnings

      - name: Rust tests
        run: cargo test --workspace

      - name: Release build (no installer)
        run: pnpm tauri build --no-bundle
        working-directory: app
```

- [ ] **Step 2: Add the Development section to `README.md`**

Insert right before `## Documentation`:

````markdown
## Development

Requirements: [Rust](https://rustup.rs) (stable), [Node.js](https://nodejs.org) 22+, [pnpm](https://pnpm.io) 10+, and on Linux the [Tauri system packages](https://v2.tauri.app/start/prerequisites/#linux).

```bash
cd app
pnpm install
pnpm tauri dev          # run the app (hot reload for the UI)
```

```bash
cargo test --workspace  # Rust tests (repo root)
pnpm -C app test        # UI tests
```

The app currently runs on a **simulated backend**. Set `CHIP_FLASHR_MOCK_FAIL_AT=41` to make the simulated board fail at 41 % and see the error path.

Layout: `crates/flashr-core` (domain types, `FlashBackend` trait, mock), `app/src-tauri` (Tauri shell, commands, jobs), `app/src` (Svelte UI). Implementation plans: [docs/superpowers/plans](docs/superpowers/plans/README.md).
````

- [ ] **Step 3: Align `docs/architecture.md` with the code**

In the "Workspace layout" block, replace the two `app/` lines:

```text
├── app/
│   ├── src-tauri/             # Tauri commands, events, watchers, packaging
│   └── ui/                    # frontend (framework chosen in M1)
```

with:

```text
├── app/                       # Svelte 5 + Vite + TypeScript frontend (package.json, src/)
│   └── src-tauri/             # Tauri shell: commands, jobs, state, packaging
```

In "Errors are for humans", replace the Rust block and the sentence before it with:

````markdown
Every failure crosses to the UI as a `UserFacingError`: a stable **code** plus the raw technical detail. The UI owns the wording (title, explanation, likely causes, actions) per code and per language, so Rust never ships user-facing sentences:

```rust
pub struct UserFacingError {
    pub code: ErrorCode,     // cancelled · target-not-found · invalid-plan · family-mismatch · device-error · already-running
    pub technical: String,   // raw error, shown only under "Technical details"
}
```
````

In the plans index `docs/superpowers/plans/README.md`, change plan 1's status from `Ready` to `Done`.

- [ ] **Step 4: Verify locally what CI will run**

Run (repo root): `cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace`
Run (in `app/`): `pnpm install --frozen-lockfile && pnpm check && pnpm test && pnpm build && pnpm tauri build --no-bundle`
Expected: everything passes; `target/release/chip-flashr` (`chip-flashr.exe` on Windows) exists and opens the demo screen when launched directly, without the dev server.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/foundations -m "ci: build and test on Windows, macOS and Linux

Frontend check/test/build, rustfmt, clippy -D warnings, cargo test and a
release build without installer. README gains a Development section;
architecture doc matches the code."
```

---

## Done when

- `cargo test --workspace` (38 tests) and `pnpm -C app test` (13 tests) pass; fmt, clippy and svelte-check are clean.
- `pnpm tauri dev` shows the demo screen, and the success, cancel and failure paths behave as in Task 6, Step 6.
- CI is green on `ubuntu-22.04`, `macos-latest` and `windows-latest` once the branch is pushed (pushing and opening the PR only happens when asked).
- This matches the M1 exit criterion in [roadmap.md](../../roadmap.md): the app builds and runs on the three OSes in CI with a mock backend simulating a flash.
