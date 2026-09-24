# 0002 · Read standard build outputs instead of requiring a custom manifest

- Status: Accepted
- Date: 2026-09-24

## Context

An ESP32 build produces several binaries that must each be written at a specific address (bootloader, partition table, OTA data, application, data images). Asking developers to hand-write a manifest for every release is friction and a source of mistakes. Build systems already describe this:

- ESP-IDF writes **`flasher_args.json`** (every file + offset + chip + flash settings).
- The **partition table** (`partitions.csv` / `partition-table.bin`) describes app and data partitions. It doesn't give the bootloader or table offsets, which depend on the chip and configuration.
- Arduino IDE and PlatformIO use stable file names.
- The ESP-IDF app image embeds **name, version, IDF version and build date** (`esp_app_desc_t`).

## Decision

1. Chip Flashr reads existing outputs in this order: `flasher_args.json` → partition table + per-chip rules → Arduino/PlatformIO conventions → single merged image.
2. Display name/version come from embedded metadata first, then from the naming convention `<project>_<version>_<chip>[_<variant>]`, then from the raw file name.
3. A `flash.toml` inside the zip is **optional**, only to override or complete detection.

Details: [firmware-packages.md](../firmware-packages.md).

## Consequences

- ✅ "Build, zip, send" works with no extra step for ESP-IDF users.
- ✅ Displayed version always matches the binary (no stale manifest).
- ⚠️ Several parsers to maintain: covered by a fixture suite of real ESP-IDF / Arduino / PlatformIO outputs per chip.
- ⚠️ Partition-table-only packages depend on per-chip offset rules. When a value can't be known (custom table offset, unknown chip), the package is reported incomplete rather than guessed.
