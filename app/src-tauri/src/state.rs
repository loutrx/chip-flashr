use std::sync::Arc;
use std::time::Duration;

use flashr_core::{FlashBackend, MockBackend, Target};

use crate::jobs::JobSlot;

/// Everything the commands share. Managed by Tauri.
pub struct AppState {
    pub backends: Vec<Arc<dyn FlashBackend>>,
    pub jobs: Arc<JobSlot>,
}

/// Mock tuned for the demo screen. `CHIP_FLASHR_MOCK_FAIL_AT` (0–100) injects a failure.
pub fn mock_from_env(fail_at: Option<&str>) -> MockBackend {
    MockBackend {
        chunk_delay: Duration::from_millis(15),
        fail_at_percent: fail_at
            .and_then(|v| v.trim().parse::<u8>().ok())
            .filter(|p| *p <= 100),
    }
}

impl AppState {
    /// Until real backends land (plan 6), the app runs on the mock.
    pub fn from_env() -> Self {
        let mock = mock_from_env(std::env::var("CHIP_FLASHR_MOCK_FAIL_AT").ok().as_deref());
        Self {
            backends: vec![Arc::new(mock)],
            jobs: Arc::default(),
        }
    }

    /// Every reachable target across backends. A backend that fails to enumerate is skipped.
    pub fn list_targets(&self) -> Vec<Target> {
        self.backends
            .iter()
            .flat_map(|b| b.discover().unwrap_or_default())
            .collect()
    }

    pub fn find(&self, target_id: &str) -> Option<(Arc<dyn FlashBackend>, Target)> {
        self.backends.iter().find_map(|b| {
            b.discover()
                .ok()?
                .into_iter()
                .find(|t| t.id == target_id)
                .map(|t| (Arc::clone(b), t))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_the_three_simulated_boards() {
        let ids: Vec<_> = AppState::from_env()
            .list_targets()
            .into_iter()
            .map(|t| t.id)
            .collect();
        assert_eq!(ids, ["mock:esp32", "mock:stm32", "mock:nrf"]);
    }

    #[test]
    fn finds_a_target_by_id_and_rejects_unknown_ids() {
        let state = AppState::from_env();
        assert_eq!(
            state.find("mock:nrf").map(|(_, t)| t.label),
            Some("DK simulé · nRF52840".to_string())
        );
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
