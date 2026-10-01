use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

/// Where a flash job currently is.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum Phase {
    Connecting,
    Erasing,
    Writing {
        index: usize,
        count: usize,
        label: String,
        address: u32,
    },
    Verifying,
    Resetting,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub phase: Phase,
    pub bytes_done: u64,
    pub bytes_total: u64,
}

/// Receives progress from a backend. Implemented by the app (Tauri channel) and by tests.
pub trait ProgressSink: Send + Sync {
    fn report(&self, event: ProgressEvent);
}

/// Sink that keeps every event, for tests and, later, for the exported report.
#[derive(Debug, Default)]
pub struct RecordingSink(Mutex<Vec<ProgressEvent>>);

/// Cooperative cancellation, checked by backends between blocks. Clones share state.
#[derive(Debug, Clone, Default)]
pub struct CancelToken(Arc<AtomicBool>);

impl ProgressEvent {
    /// Whole-job completion in percent, clamped to 0..=100, 0 when there is nothing to write.
    pub fn percent(&self) -> u8 {
        if self.bytes_total == 0 {
            return 0;
        }
        (self.bytes_done.min(self.bytes_total) * 100 / self.bytes_total) as u8
    }
}

impl RecordingSink {
    pub fn events(&self) -> Vec<ProgressEvent> {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }
}

impl ProgressSink for RecordingSink {
    fn report(&self, event: ProgressEvent) {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).push(event);
    }
}

impl CancelToken {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(done: u64, total: u64) -> ProgressEvent {
        ProgressEvent {
            phase: Phase::Erasing,
            bytes_done: done,
            bytes_total: total,
        }
    }

    #[test]
    fn percent_is_clamped_and_safe() {
        assert_eq!(event(0, 0).percent(), 0);
        assert_eq!(event(50, 200).percent(), 25);
        assert_eq!(event(199, 200).percent(), 99);
        assert_eq!(event(200, 200).percent(), 100);
        assert_eq!(event(500, 200).percent(), 100);
    }

    #[test]
    fn writing_phase_serializes_for_the_ui() {
        let e = ProgressEvent {
            phase: Phase::Writing {
                index: 3,
                count: 4,
                label: "app".into(),
                address: 0x1_0000,
            },
            bytes_done: 10,
            bytes_total: 20,
        };
        assert_eq!(
            serde_json::to_value(&e).unwrap(),
            serde_json::json!({
                "phase": { "kind": "writing", "index": 3, "count": 4, "label": "app", "address": 65536 },
                "bytesDone": 10,
                "bytesTotal": 20
            })
        );
    }

    #[test]
    fn phase_round_trips_through_json() {
        let phases = [
            Phase::Connecting,
            Phase::Erasing,
            Phase::Writing {
                index: 0,
                count: 1,
                label: "firmware.hex".into(),
                address: 0x0800_0000,
            },
            Phase::Verifying,
            Phase::Resetting,
        ];
        for phase in phases {
            let wire = serde_json::to_value(&phase).unwrap();
            assert_eq!(serde_json::from_value::<Phase>(wire).unwrap(), phase);
        }
        assert_eq!(
            serde_json::from_value::<Phase>(serde_json::json!({ "kind": "verifying" })).unwrap(),
            Phase::Verifying
        );
    }

    #[test]
    fn recording_sink_keeps_events_in_order() {
        let sink = RecordingSink::default();
        sink.report(event(1, 2));
        sink.report(event(2, 2));
        assert_eq!(sink.events(), vec![event(1, 2), event(2, 2)]);
    }

    #[test]
    fn cancel_token_clones_share_state() {
        let token = CancelToken::new();
        let clone = token.clone();
        assert!(!clone.is_cancelled());
        token.cancel();
        assert!(clone.is_cancelled());
    }
}
