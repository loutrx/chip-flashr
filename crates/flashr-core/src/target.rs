use serde::{Deserialize, Serialize};

use crate::Family;

/// How the computer reaches the chip.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Link {
    /// The chip's own USB port (ESP32-S3, -C3, -C6).
    UsbJtag,
    /// A USB-to-serial bridge on the board ("CP2102N", "CH340").
    UsbSerial { bridge: String },
    /// A debug probe ("ST-Link V3", "nRF52840 DK").
    Probe { name: String },
}

/// Something we can program: a serial port, a probe, a DFU device.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Target {
    /// Stable id within one app session ("mock:esp32s3:COM4", later "serial:COM4").
    pub id: String,
    pub family: Family,
    /// Chip display name shown in the top bar pill ("ESP32-S3").
    pub label: String,
    /// Lower-case chip id when the board told us ("esp32s3").
    pub chip: Option<String>,
    pub port: String,
    pub link: Link,
    pub flash_size: Option<u32>,
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
    /// Technical lines for the report and the "Détails techniques" console.
    pub log: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn esp32s3() -> Target {
        Target {
            id: "mock:esp32s3:COM4".into(),
            family: Family::Esp32,
            label: "ESP32-S3".into(),
            chip: Some("esp32s3".into()),
            port: "COM4".into(),
            link: Link::UsbJtag,
            flash_size: Some(8 * 1024 * 1024),
        }
    }

    #[test]
    fn target_serializes_in_camel_case() {
        assert_eq!(
            serde_json::to_value(esp32s3()).unwrap(),
            json!({
                "id": "mock:esp32s3:COM4",
                "family": "esp32",
                "label": "ESP32-S3",
                "chip": "esp32s3",
                "port": "COM4",
                "link": { "kind": "usb-jtag" },
                "flashSize": 8388608
            })
        );
    }

    #[test]
    fn absent_chip_and_flash_size_are_null() {
        let target = Target {
            chip: None,
            flash_size: None,
            ..esp32s3()
        };
        let wire = serde_json::to_value(&target).unwrap();
        assert_eq!(wire["chip"], json!(null));
        assert_eq!(wire["flashSize"], json!(null));
    }

    #[test]
    fn link_wire_format() {
        let cases = [
            (Link::UsbJtag, json!({ "kind": "usb-jtag" })),
            (
                Link::UsbSerial {
                    bridge: "CP2102N".into(),
                },
                json!({ "kind": "usb-serial", "bridge": "CP2102N" }),
            ),
            (
                Link::Probe {
                    name: "ST-Link V3".into(),
                },
                json!({ "kind": "probe", "name": "ST-Link V3" }),
            ),
        ];
        for (link, wire) in cases {
            assert_eq!(serde_json::to_value(&link).unwrap(), wire);
            assert_eq!(serde_json::from_value::<Link>(wire).unwrap(), link);
        }
    }

    #[test]
    fn target_round_trips() {
        let wire = serde_json::to_value(esp32s3()).unwrap();
        assert_eq!(serde_json::from_value::<Target>(wire).unwrap(), esp32s3());
    }

    #[test]
    fn report_serializes_in_camel_case() {
        let r = FlashReport {
            bytes_written: 4,
            duration_ms: 5,
            verified: true,
            log: vec!["connect ESP32-S3".into()],
        };
        assert_eq!(
            serde_json::to_value(&r).unwrap(),
            json!({
                "bytesWritten": 4,
                "durationMs": 5,
                "verified": true,
                "log": ["connect ESP32-S3"]
            })
        );
    }
}
