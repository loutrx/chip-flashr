# 0004 · Single executable; config in the OS folder, portable override

- Status: Accepted
- Date: 2026-09-24

## Context

The core use case is "send one executable plus firmware files to a customer". Several files, installers or side folders confuse people. But the app still needs to remember a few settings (watched folders, language, mode), and a single file can't safely rewrite itself.

## Decision

- Ship **one executable** per platform (Windows `.exe`, Linux AppImage, macOS `.app`), with the UI embedded.
- Store settings in the **standard per-user config folder** (`%APPDATA%/chip-flashr`, `~/Library/Application Support/chip-flashr`, `~/.config/chip-flashr`).
- If a **`chip-flashr.toml` sits next to the executable**, use it instead (**portable mode**) and disable auto-update. Settings → *Export for a customer…* writes this file.
- The executable's own folder is **always** watched for firmware.

## Consequences

- ✅ The delivery folder stays trivial: exe + firmware (+ instructions).
- ✅ Suppliers can pre-configure a customer's app by adding one text file.
- ✅ Settings survive updates in normal mode.
- ⚠️ Two config locations to explain. The Settings screen always shows which one is active.
- ⚠️ Portable mode on read-only media (CD, locked share) must degrade gracefully (settings changes not saved, with a notice).
