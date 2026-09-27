use serde::{Deserialize, Serialize};

/// The three chip families Chip Flashr programs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Family {
    Esp32,
    Stm32,
    Nrf,
}

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
