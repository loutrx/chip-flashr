use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::{Family, Target};

/// What the backend knows right now: firmwares found, boards plugged in, problems seen.
/// The UI derives its screen from it and never computes these facts itself.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Snapshot {
    pub folders: Vec<WatchedFolder>,
    pub firmwares: Vec<FirmwareSummary>,
    pub targets: Vec<Target>,
    pub issues: Vec<DeviceIssue>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WatchedFolder {
    pub path: String,
    pub kind: FolderKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FolderKind {
    /// The folder next to the application.
    App,
    Watched,
}

/// Where the firmware's name, version and chip were read from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceKind {
    EspIdfBuild,
    Arduino,
    PlatformIo,
    Elf,
    Hex,
    Bin,
    FileName,
}

/// One file of the firmware and the flash address it goes to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImageEntry {
    pub address: u32,
    pub name: String,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum FamilyGuess {
    Certain { family: Family },
    Suggested { family: Family, reason: GuessReason },
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum GuessReason {
    StartAddress { address: u32 },
    FileName,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CheckStatus {
    Ok,
    Warning,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CheckCode {
    ManifestRead,
    FilePresent,
    FileMissing,
    NonstandardName,
}

/// One validation result. The UI words it from `code` and `params` (string values only).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Check {
    pub status: CheckStatus,
    pub code: CheckCode,
    pub params: BTreeMap<String, String>,
}

/// A README exists for this firmware; its content arrives with plan 4.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Readme {
    pub file_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FirmwareSummary {
    pub id: String,
    pub path: String,
    pub file_name: String,
    /// Index into `Snapshot::folders`.
    pub folder: usize,
    pub source: SourceKind,
    pub name: Option<String>,
    pub version: Option<String>,
    pub variant: Option<String>,
    /// Lower-case chip id ("esp32s3"); the UI formats it.
    pub chip: Option<String>,
    pub family: FamilyGuess,
    pub toolchain: Option<String>,
    /// Local time without zone, "2026-09-12T14:32:00".
    pub built_at: Option<String>,
    pub size_bytes: u64,
    pub address_ranges: u32,
    pub images: Vec<ImageEntry>,
    pub manifest: Option<String>,
    pub checks: Vec<Check>,
    pub readme: Option<Readme>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LockKind {
    /// Nordic access-port protection: the chip refuses reads and writes until erased.
    Approtect,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ToolStatus {
    pub name: String,
    pub installed: bool,
}

/// Where to get a missing driver or tool. Titles and URLs are data; the UI words the rest.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Download {
    pub title: String,
    pub publisher: String,
    pub version_hint: String,
    pub size_hint: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum DeviceIssue {
    MissingDriver {
        family: Family,
        vendor: String,
        name: String,
        vid: u16,
        pid: u16,
        download: Download,
        inf: Option<String>,
    },
    MissingTool {
        family: Family,
        target_label: String,
        locked: Option<LockKind>,
        tools: Vec<ToolStatus>,
        download: Download,
        install_command: Option<String>,
    },
}

impl FirmwareSummary {
    /// A firmware with any failed check cannot be programmed. Derived, never stored.
    pub fn is_invalid(&self) -> bool {
        self.checks.iter().any(|c| c.status == CheckStatus::Error)
    }
}

impl DeviceIssue {
    pub fn family(&self) -> Family {
        match self {
            DeviceIssue::MissingDriver { family, .. } | DeviceIssue::MissingTool { family, .. } => {
                *family
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Link;
    use serde_json::json;

    fn params(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    fn check(status: CheckStatus, code: CheckCode) -> Check {
        Check {
            status,
            code,
            params: BTreeMap::new(),
        }
    }

    fn hex_firmware() -> FirmwareSummary {
        FirmwareSummary {
            id: "firmware-hex".into(),
            path: "D:\\Firmwares\\firmware.hex".into(),
            file_name: "firmware.hex".into(),
            folder: 1,
            source: SourceKind::Hex,
            name: None,
            version: None,
            variant: None,
            chip: None,
            family: FamilyGuess::Suggested {
                family: Family::Stm32,
                reason: GuessReason::StartAddress {
                    address: 0x0800_0000,
                },
            },
            toolchain: None,
            built_at: Some("2026-09-21T16:48:00".into()),
            size_bytes: 126_976,
            address_ranges: 1,
            images: vec![ImageEntry {
                address: 0x0800_0000,
                name: "firmware.hex".into(),
                size: 126_976,
            }],
            manifest: None,
            checks: vec![Check {
                status: CheckStatus::Ok,
                code: CheckCode::FilePresent,
                params: params(&[
                    ("file", "firmware.hex"),
                    ("address", "0x8000000"),
                    ("size", "126976"),
                ]),
            }],
            readme: Some(Readme {
                file_name: "LISEZMOI.md".into(),
            }),
        }
    }

    fn cp210x() -> DeviceIssue {
        DeviceIssue::MissingDriver {
            family: Family::Esp32,
            vendor: "Silicon Labs".into(),
            name: "CP210x".into(),
            vid: 0x10C4,
            pid: 0xEA60,
            download: Download {
                title: "CP210x Universal Windows Driver".into(),
                publisher: "Silicon Labs".into(),
                version_hint: "11.x".into(),
                size_hint: None,
                url: "https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers".into(),
            },
            inf: Some("silabs-ser.inf".into()),
        }
    }

    fn nordic_lock() -> DeviceIssue {
        DeviceIssue::MissingTool {
            family: Family::Nrf,
            target_label: "nRF52840".into(),
            locked: Some(LockKind::Approtect),
            tools: vec![ToolStatus {
                name: "nRF Util · device".into(),
                installed: false,
            }],
            download: Download {
                title: "nRF Util".into(),
                publisher: "Nordic Semiconductor".into(),
                version_hint: "7.x".into(),
                size_hint: None,
                url: "https://www.nordicsemi.com/Products/Development-tools/nRF-Util".into(),
            },
            install_command: None,
        }
    }

    #[test]
    fn firmware_summary_wire_format() {
        assert_eq!(
            serde_json::to_value(hex_firmware()).unwrap(),
            json!({
                "id": "firmware-hex",
                "path": "D:\\Firmwares\\firmware.hex",
                "fileName": "firmware.hex",
                "folder": 1,
                "source": "hex",
                "name": null,
                "version": null,
                "variant": null,
                "chip": null,
                "family": {
                    "kind": "suggested",
                    "family": "stm32",
                    "reason": { "kind": "start-address", "address": 134217728 }
                },
                "toolchain": null,
                "builtAt": "2026-09-21T16:48:00",
                "sizeBytes": 126976,
                "addressRanges": 1,
                "images": [{ "address": 134217728, "name": "firmware.hex", "size": 126976 }],
                "manifest": null,
                "checks": [{
                    "status": "ok",
                    "code": "file-present",
                    "params": { "address": "0x8000000", "file": "firmware.hex", "size": "126976" }
                }],
                "readme": { "fileName": "LISEZMOI.md" }
            })
        );
    }

    #[test]
    fn family_guess_and_reason_wire_format() {
        let cases = [
            (
                FamilyGuess::Certain {
                    family: Family::Esp32,
                },
                json!({ "kind": "certain", "family": "esp32" }),
            ),
            (
                FamilyGuess::Suggested {
                    family: Family::Nrf,
                    reason: GuessReason::FileName,
                },
                json!({ "kind": "suggested", "family": "nrf", "reason": { "kind": "file-name" } }),
            ),
            (FamilyGuess::Unknown, json!({ "kind": "unknown" })),
        ];
        for (guess, wire) in cases {
            assert_eq!(serde_json::to_value(&guess).unwrap(), wire);
            assert_eq!(serde_json::from_value::<FamilyGuess>(wire).unwrap(), guess);
        }
    }

    #[test]
    fn unit_enums_use_kebab_case() {
        let sources = [
            (SourceKind::EspIdfBuild, "esp-idf-build"),
            (SourceKind::Arduino, "arduino"),
            (SourceKind::PlatformIo, "platform-io"),
            (SourceKind::Elf, "elf"),
            (SourceKind::Hex, "hex"),
            (SourceKind::Bin, "bin"),
            (SourceKind::FileName, "file-name"),
        ];
        for (source, wire) in sources {
            assert_eq!(serde_json::to_value(source).unwrap(), json!(wire));
        }
        let codes = [
            (CheckCode::ManifestRead, "manifest-read"),
            (CheckCode::FilePresent, "file-present"),
            (CheckCode::FileMissing, "file-missing"),
            (CheckCode::NonstandardName, "nonstandard-name"),
        ];
        for (code, wire) in codes {
            assert_eq!(serde_json::to_value(code).unwrap(), json!(wire));
        }
        assert_eq!(
            serde_json::to_value([CheckStatus::Ok, CheckStatus::Warning, CheckStatus::Error])
                .unwrap(),
            json!(["ok", "warning", "error"])
        );
        assert_eq!(
            serde_json::to_value([FolderKind::App, FolderKind::Watched]).unwrap(),
            json!(["app", "watched"])
        );
        assert_eq!(
            serde_json::to_value(LockKind::Approtect).unwrap(),
            json!("approtect")
        );
    }

    #[test]
    fn device_issue_wire_format() {
        assert_eq!(
            serde_json::to_value(cp210x()).unwrap(),
            json!({
                "kind": "missing-driver",
                "family": "esp32",
                "vendor": "Silicon Labs",
                "name": "CP210x",
                "vid": 4292,
                "pid": 60000,
                "download": {
                    "title": "CP210x Universal Windows Driver",
                    "publisher": "Silicon Labs",
                    "versionHint": "11.x",
                    "sizeHint": null,
                    "url": "https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers"
                },
                "inf": "silabs-ser.inf"
            })
        );
        assert_eq!(
            serde_json::to_value(nordic_lock()).unwrap(),
            json!({
                "kind": "missing-tool",
                "family": "nrf",
                "targetLabel": "nRF52840",
                "locked": "approtect",
                "tools": [{ "name": "nRF Util · device", "installed": false }],
                "download": {
                    "title": "nRF Util",
                    "publisher": "Nordic Semiconductor",
                    "versionHint": "7.x",
                    "sizeHint": null,
                    "url": "https://www.nordicsemi.com/Products/Development-tools/nRF-Util"
                },
                "installCommand": null
            })
        );
    }

    #[test]
    fn snapshot_round_trips_through_json() {
        let snapshot = Snapshot {
            folders: vec![WatchedFolder {
                path: "D:\\Firmwares".into(),
                kind: FolderKind::Watched,
            }],
            firmwares: vec![hex_firmware()],
            targets: vec![Target {
                id: "mock:stm32f411:ST-Link".into(),
                family: Family::Stm32,
                label: "STM32F411".into(),
                chip: Some("stm32f411".into()),
                port: "ST-Link".into(),
                link: Link::Probe {
                    name: "ST-Link V3".into(),
                },
                flash_size: Some(524_288),
            }],
            issues: vec![cp210x(), nordic_lock()],
        };
        let wire = serde_json::to_value(&snapshot).unwrap();
        assert_eq!(
            wire["folders"],
            json!([{ "path": "D:\\Firmwares", "kind": "watched" }])
        );
        assert_eq!(serde_json::from_value::<Snapshot>(wire).unwrap(), snapshot);
    }

    #[test]
    fn a_missing_field_is_an_error() {
        let mut wire = serde_json::to_value(hex_firmware()).unwrap();
        wire.as_object_mut().unwrap().remove("sizeBytes");
        let err = serde_json::from_value::<FirmwareSummary>(wire).unwrap_err();
        assert!(
            err.to_string().contains("missing field `sizeBytes`"),
            "{err}"
        );
    }

    #[test]
    fn an_unknown_field_is_rejected() {
        let mut wire = serde_json::to_value(hex_firmware()).unwrap();
        wire["colour"] = json!("red");
        let err = serde_json::from_value::<FirmwareSummary>(wire).unwrap_err();
        assert!(err.to_string().contains("unknown field `colour`"), "{err}");

        let mut issue = serde_json::to_value(cp210x()).unwrap();
        issue["serial"] = json!("0001");
        assert!(serde_json::from_value::<DeviceIssue>(issue).is_err());
    }

    #[test]
    fn invalid_only_when_a_check_failed() {
        let mut firmware = hex_firmware();
        assert!(!firmware.is_invalid());
        firmware.checks = vec![
            check(CheckStatus::Ok, CheckCode::ManifestRead),
            check(CheckStatus::Warning, CheckCode::NonstandardName),
        ];
        assert!(!firmware.is_invalid());
        firmware
            .checks
            .push(check(CheckStatus::Error, CheckCode::FileMissing));
        assert!(firmware.is_invalid());
    }

    #[test]
    fn an_issue_knows_its_family() {
        assert_eq!(cp210x().family(), Family::Esp32);
        assert_eq!(nordic_lock().family(), Family::Nrf);
    }
}
