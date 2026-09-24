# 0001 · Build with Rust + Tauri 2

- Status: Accepted
- Date: 2026-09-24

## Context

The app must be **small, fast, a single executable, cross-platform**, and able to talk to serial ports, USB probes and DFU devices. It should reuse existing flashing implementations rather than reinvent protocols. It must also be **code-signable and not trip antivirus heuristics**, because it's meant to be sent to customers.

The two flashing engines we want to build on already exist, both in Rust:

- [`espflash`](https://github.com/esp-rs/espflash): ESP32 family, library + CLI, maintained by the esp-rs community.
- [`probe-rs`](https://probe.rs): ST-Link / J-Link / CMSIS-DAP, hundreds of ARM and RISC-V targets including STM32 and nRF.

The UI direction validated in M0 (clay buttons, soft shadows, micro-animations, Markdown rendering) is natural in HTML/CSS.

## Options considered

| Option | For | Against |
|---|---|---|
| **Rust + Tauri 2** | espflash/probe-rs linked **in-process**; a few-MB binary; single exe; HTML/CSS UI; strong typing for protocol code | Relies on the OS WebView (WebKitGTK on Linux is the weakest); Rust compile times; probe-rs is a heavy dependency |
| Electron + Node | Huge ecosystem, same UI tech | 100+ MB, no native equivalent of espflash/probe-rs (would shell out to CLIs), more AV noise |
| Python (esptool, pyOCD) + Qt, packaged with PyInstaller | esptool is the reference ESP tool | Heavy bundles; **PyInstaller executables are a classic source of antivirus false positives**; slower start-up |
| .NET (WPF / Avalonia) | Great on Windows, good tooling | No native ESP/probe libraries (shell out again); cross-platform UI less mature for this look |
| Go + Wails | Small binaries, simple | No Go equivalent of espflash/probe-rs |
| Rust native UI (egui, Slint, iced) | Even smaller, no WebView | The clay/animated design and Markdown panel become much more work; less accessible out of the box |

## Decision

Use **Rust** for everything that touches files and hardware, and **Tauri 2** for the desktop shell with a light web frontend (framework chosen in M1: Svelte, Solid or vanilla TS; the constraint is a small bundle).

## Consequences

- ✅ Flashing runs in-process through espflash and probe-rs: no Python, no external CLI for the main paths, precise progress events, structured errors.
- ✅ Single signed executable of a few megabytes; fast start-up.
- ✅ Future headless CLI can reuse all crates.
- ⚠️ **Linux WebKitGTK** can render differently or be slower. The design avoids exotic CSS, and Linux gets explicit visual testing.
- ⚠️ **Compile times** grow with probe-rs. Mitigated by crate boundaries, CI caching, and keeping probe-rs behind the `flashr-probe` crate.
- ⚠️ **Library API churn** in espflash/probe-rs: pin versions, wrap them behind our `FlashBackend` trait, upgrade deliberately.
- ⚠️ Some Nordic operations (recover/APPROTECT, newest chips) may still need vendor tools. See [0003](0003-probe-rs-first.md).
