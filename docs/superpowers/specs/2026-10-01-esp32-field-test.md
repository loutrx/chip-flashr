# ESP32 package field test: findings for plans 4 and 6

- Date: 2026-10-01
- Feeds: plan 4 (firmware packages) and plan 6 (ESP32 backend), both still to write
- Corrects: [firmware-packages.md](../../firmware-packages.md), [architecture.md](../../architecture.md#the-backend-contract)

## What was tested

A real product firmware went through the whole path the app will take, on real hardware, before any of plans 4 and 6 exists. The product is a customer's, so its name is replaced by `product_app` below.

| | |
|---|---|
| Firmware | ESP-IDF **v6.0.2** project, ESP32-S3, custom partition table with two OTA slots and no `factory` |
| Package | `product-app_v0.1.0_esp32s3_test.zip`, 544 KB, made by a packaging script in the firmware's own repository |
| Flasher | A throwaway Rust program (~150 lines) using `espflash` **4.6** as a library: open the zip, resolve `flasher_args.json`, check the plan against the connected chip, write, reset |
| Board | ESP32-S3 rev 0.2, 16 MB flash, 8 MB PSRAM, on its **native USB-Serial/JTAG** (VID `303A`, PID `1001`), Windows 11 |

Result: **flashed, verified and booted** on the first real attempt. The serial log showed the new image (`App version: 0.1.0`, `Loaded app from partition at offset 0x20000`) and the product's UI reached its home screen.

| Step | Measured |
|---|---|
| Connect + chip identification (`Flasher::connect` + `device_info`) | 0.36 s |
| Bootloader 22 KB · table 3 KB · otadata 8 KB | 0.27 s · 0.03 s · 0.05 s |
| Application 971 KB (0x20000) | 6.5 s |
| Whole write, verify included | **7.2 s** |

## The package that was flashed

```text
product-app_v0.1.0_esp32s3_test.zip
├── flasher_args.json                    1 073 B
├── bootloader/bootloader.bin           22 528 B   → 0x0
├── partition_table/partition-table.bin  3 072 B   → 0x8000
├── ota_data_initial.bin                 8 192 B   → 0xf000
└── product_app.bin                    971 040 B   → 0x20000
```

`flasher_args.json` as ESP-IDF 6 writes it (abridged):

```json
{
  "write_flash_args": ["--flash-mode", "dio", "--flash-size", "16MB", "--flash-freq", "80m"],
  "flash_settings": { "flash_mode": "dio", "flash_size": "16MB", "flash_freq": "80m" },
  "flash_files": {
    "0x0": "bootloader/bootloader.bin",
    "0x8000": "partition_table/partition-table.bin",
    "0xf000": "ota_data_initial.bin",
    "0x20000": "product_app.bin"
  },
  "app": { "offset": "0x20000", "file": "product_app.bin", "encrypted": "false" },
  "extra_esptool_args": { "after": "hard-reset", "before": "default-reset", "stub": true, "chip": "esp32s3" }
}
```

## Confirmed

- **`flasher_args.json` is enough.** `flash_files` plus `extra_esptool_args.chip` resolved the whole plan, with no partition-table parsing and no per-chip rule.
- **Same relative layout first, flat lookup by file name second** works. The packaging script keeps the `build/` layout, so the first rule matched every file.
- **Checking against the connected chip before writing** comes almost free: `device_info()` returns the chip, revision, flash size and MAC in the same 0.36 s connection. The package's chip (`esp32s3`) and the end of its last region (0x10D0A0) were checked against them before the first byte was written.
- **The app descriptor is where the docs say.** `esp_app_desc_t` sits at offset 0x20 of the app image (magic `0xABCD5432`): version at +16, project name at +48, time at +80, date at +96, IDF version at +112.
- **Native USB-Serial/JTAG needs no driver** on Windows 11 and resets into download mode by itself with `DefaultReset`. No BOOT button.

## Corrections

### 1. `flasher_args.json` changed shape with ESP-IDF 6

The reset values use **hyphens** (`hard-reset`, `default-reset`, esptool v5 style) where older IDF versions write underscores (`hard_reset`). A new boolean `stub` appears, and `write_flash_args` lists the same flash settings again.

→ Plan 4: parse `before` / `after` accepting both spellings. Ignore unknown keys. Read flash settings from `flash_settings` and never from `write_flash_args`. Keep one fixture per IDF major version (5.x, 6.x).

### 2. No erase step before writing

[architecture.md](../../architecture.md#the-backend-contract) described `flash` as "erase → write each region → verify → reset". `espflash` erases only the sectors it writes. That is what kept the device's **NVS settings** in this test (the product was still provisioned after flashing). A full erase first would have sent a provisioned device in the field back to factory state.

→ Plan 6: `flash` writes each region (sector erase included), verifies, resets. Full erase stays a separate, confirmed Expert action (`erase(EraseScope::All)`).

### 3. Write the images as they are, don't patch their headers

`flash_settings` says `dio` while the running app reports `flash io: qio`. That is expected: the bootloader header holds the boot-time mode and the app switches afterwards. `write_bins_to_flash` writes the bytes unchanged, which is right for files that come from one build.

→ Plan 6: no header patching by default. Patch flash mode, size or frequency only when a `flash.toml` override asks for it, and show it in the Expert log.

### 4. Project names contain underscores

The descriptor's project name is `product_app`, while the file-name convention forbids `_` in `<project>` (it is the separator). The packaging script turned it into `product-app`.

→ Plan 4: when a name comes from the descriptor, `_` becomes `-` for the file name preview of *Create a package*. The firmware card shows the descriptor name unchanged.

### 5. Zips made on Windows may use `\`

PowerShell 5.1's `Compress-Archive` writes entry names with backslashes, which the ZIP format doesn't allow. People will send such zips anyway.

→ Plan 4: normalise `\` to `/` in entry names before matching and before the `../` escape check.

### 6. Always reset when leaving the bootloader

An identify-only connection (no write) left the chip in download mode: the device stays dark until reset. The next connection still worked, but a customer would see a board that "stopped working".

→ Plan 6: every path that connects (identify, cancel, error) ends with `reset_after`, not only a successful flash.

### 7. Packaging needs a freshness check

The firmware repository had sources newer than its last build. The packaging script warns about it, and compares the descriptor version with the repository's `VERSION` file before naming the zip.

→ Plan 5 (*Create a package*): warn when the build folder is older than its sources, if a source tree is visible next to it.

## espflash as a library: what plan 6 needs

```rust
let serial = serialport::new(&port, 115_200).flow_control(FlowControl::None).open_native()?;
let conn = Connection::new(serial, usb_info, ResetAfterOperation::HardReset,
                           ResetBeforeOperation::DefaultReset, 115_200);
let mut flasher = Flasher::connect(conn, /*stub*/ true, /*verify*/ true, /*skip*/ false, None, None)?;
let info = flasher.device_info()?;            // chip, revision, flash size, MAC
flasher.write_bins_to_flash(&segments, &mut progress)?;
flasher.connection().reset_after(true, info.chip)?;
```

- Dependencies: `espflash = { version = "4.6", default-features = false, features = ["serialport"] }` and `serialport` 4.7 (same version as espflash's, for `UsbPortInfo`). Clean release build: 15 s.
- `Connection::new` takes the concrete port type (`COMPort` on Windows, `TTYPort` elsewhere) and the USB VID/PID. espflash uses the VID/PID to pick the USB-JTAG reset sequence, so plan 6 must pass the real values.
- `ProgressCallbacks` (`init(addr, total)`, `update(n)`, `verifying()`, `finish(skipped)`) is called once per region. It maps directly onto the job's progress channel: one step per region, with a verify sub-phase.
- `skip = true` skips regions whose content is already on the chip. That is worth enabling for "Programmer une autre carte" flows where most boards already carry the bootloader.
- Cancellation: `write_bins_to_flash` is blocking with no cancel hook. Plan 6 has to cancel between regions, or by closing the port from the job's worker.
