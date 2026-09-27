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
        let t = Target {
            id: "mock:esp32".into(),
            family: Family::Esp32,
            label: "ESP32-S3".into(),
        };
        assert_eq!(
            serde_json::to_value(&t).unwrap(),
            serde_json::json!({ "id": "mock:esp32", "family": "esp32", "label": "ESP32-S3" })
        );
    }

    #[test]
    fn report_serializes_in_camel_case() {
        let r = FlashReport {
            bytes_written: 4,
            duration_ms: 5,
            verified: true,
        };
        assert_eq!(
            serde_json::to_value(&r).unwrap(),
            serde_json::json!({ "bytesWritten": 4, "durationMs": 5, "verified": true })
        );
    }
}
