use std::sync::{Arc, Mutex};
use std::time::Duration;

use flashr_core::{MockBackend, SimulatedWorld, resolve_scenario};

use crate::jobs::JobSlot;

/// Everything the commands share. Managed by Tauri.
pub struct AppState {
    pub mock: Arc<MockBackend>,
    pub world: Arc<Mutex<SimulatedWorld>>,
    /// The unknown scenario name that was asked for, when the app fell back to `default`.
    pub scenario_warning: Option<String>,
    pub jobs: Arc<JobSlot>,
}

/// Mock tuned to be watched. `CHIP_FLASHR_MOCK_FAIL_AT` (0–100) injects a failure.
pub fn mock_from_env(fail_at: Option<&str>) -> MockBackend {
    MockBackend {
        chunk_delay: Duration::from_millis(15),
        fail_at_percent: fail_at
            .and_then(|v| v.trim().parse::<u8>().ok())
            .filter(|p| *p <= 100),
    }
}

impl AppState {
    /// Until real backends land (plan 6), the app runs on the mock and a simulated world.
    pub fn from_env() -> Self {
        Self::new(
            std::env::var("CHIP_FLASHR_SCENARIO").ok().as_deref(),
            std::env::var("CHIP_FLASHR_MOCK_FAIL_AT").ok().as_deref(),
        )
    }

    /// `from_env` with explicit values, for tests.
    pub fn new(scenario: Option<&str>, fail_at: Option<&str>) -> Self {
        let (scenario, scenario_warning) = resolve_scenario(scenario);
        Self {
            mock: Arc::new(mock_from_env(fail_at)),
            world: Arc::new(Mutex::new(SimulatedWorld::new(scenario))),
            scenario_warning,
            jobs: Arc::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::world::lock_world;

    #[test]
    fn plays_the_requested_scenario() {
        let state = AppState::new(Some("waiting-board"), None);
        assert_eq!(lock_world(&state.world).scenario_name(), "waiting-board");
        assert_eq!(state.scenario_warning, None);
    }

    #[test]
    fn an_unknown_scenario_falls_back_to_default_with_a_warning() {
        let state = AppState::new(Some("nope"), None);
        assert_eq!(lock_world(&state.world).scenario_name(), "default");
        assert_eq!(state.scenario_warning.as_deref(), Some("nope"));
    }

    #[test]
    fn no_scenario_means_default_without_warning() {
        let state = AppState::new(None, None);
        assert_eq!(lock_world(&state.world).scenario_name(), "default");
        assert_eq!(state.scenario_warning, None);
    }

    #[test]
    fn the_failure_switch_combines_with_any_scenario() {
        let state = AppState::new(Some("single"), Some("41"));
        assert_eq!(state.mock.fail_at_percent, Some(41));
        assert_eq!(lock_world(&state.world).scenario_name(), "single");
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
