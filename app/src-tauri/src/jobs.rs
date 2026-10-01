use std::sync::{Arc, Mutex};

use flashr_core::{
    CancelToken, ErrorCode, FlashBackend, FlashPlan, FlashReport, ProgressEvent, ProgressSink,
    Target, UserFacingError,
};

/// At most one flash job at a time; holds the running job's cancel token.
#[derive(Debug, Default)]
pub struct JobSlot(Mutex<Option<CancelToken>>);

/// Proof that the slot is held. Dropping it frees the slot, whatever the job's outcome.
#[derive(Debug)]
pub struct RunningJob {
    pub token: CancelToken,
    slot: Arc<JobSlot>,
}

impl JobSlot {
    /// Reserve the slot for a new job, or refuse if one is running.
    pub fn start(self: &Arc<Self>) -> Result<RunningJob, UserFacingError> {
        let mut current = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if current.is_some() {
            return Err(UserFacingError::new(
                ErrorCode::AlreadyRunning,
                "a flash job is already running",
            ));
        }
        let token = CancelToken::new();
        *current = Some(token.clone());
        Ok(RunningJob {
            token,
            slot: Arc::clone(self),
        })
    }

    /// Ask the running job to stop. Returns false when nothing runs.
    pub fn cancel(&self) -> bool {
        match &*self.0.lock().unwrap_or_else(|e| e.into_inner()) {
            Some(token) => {
                token.cancel();
                true
            }
            None => false,
        }
    }
}

impl Drop for RunningJob {
    fn drop(&mut self) {
        *self.slot.0.lock().unwrap_or_else(|e| e.into_inner()) = None;
    }
}

/// Forwards every event and keeps the last one, so a failure can say where it happened.
struct LastEvent<'a> {
    inner: &'a dyn ProgressSink,
    last: Mutex<Option<ProgressEvent>>,
}

impl ProgressSink for LastEvent<'_> {
    fn report(&self, event: ProgressEvent) {
        *self.last.lock().unwrap_or_else(|e| e.into_inner()) = Some(event.clone());
        self.inner.report(event);
    }
}

/// Run one job on the current thread and translate the outcome for the UI.
/// A failure carries the phase and percent of the last progress event, when there was one.
pub fn run_flash_job(
    backend: &dyn FlashBackend,
    target: &Target,
    plan: &FlashPlan,
    sink: &dyn ProgressSink,
    cancel: &CancelToken,
) -> Result<FlashReport, UserFacingError> {
    let tracker = LastEvent {
        inner: sink,
        last: Mutex::new(None),
    };
    let result = backend.flash(target, plan, &tracker, cancel);
    let last = tracker.last.into_inner().unwrap_or_else(|e| e.into_inner());
    result.map_err(|e| {
        let error = UserFacingError::from(&e);
        match last {
            Some(event) => {
                let percent = event.percent();
                error.at(event.phase, percent)
            }
            None => error,
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use flashr_core::{
        Family, MockBackend, Phase, ProgressEvent, RecordingSink, SimulatedWorld, load_scenario,
        plan_for,
    };

    fn esp() -> Target {
        MockBackend::target(Family::Esp32)
    }

    fn thermostat_plan() -> FlashPlan {
        let world = SimulatedWorld::new(load_scenario("single").unwrap());
        plan_for(
            world.firmware("thermostat-1.4.2-prod").unwrap(),
            Family::Esp32,
        )
    }

    #[test]
    fn successful_job_returns_the_report() {
        let slot = Arc::new(JobSlot::default());
        let job = slot.start().unwrap();
        let plan = thermostat_plan();
        let report = run_flash_job(
            &MockBackend::default(),
            &esp(),
            &plan,
            &RecordingSink::default(),
            &job.token,
        )
        .unwrap();
        assert_eq!(report.bytes_written, plan.total_bytes());
    }

    #[test]
    fn second_job_is_refused_while_first_runs() {
        let slot = Arc::new(JobSlot::default());
        let _first = slot.start().unwrap();
        let err = slot.start().unwrap_err();
        assert_eq!(err.code, ErrorCode::AlreadyRunning);
    }

    #[test]
    fn slot_is_released_after_a_failed_job() {
        let slot = Arc::new(JobSlot::default());
        {
            let job = slot.start().unwrap();
            let failing = MockBackend {
                fail_at_percent: Some(10),
                ..MockBackend::default()
            };
            let err = run_flash_job(
                &failing,
                &esp(),
                &thermostat_plan(),
                &RecordingSink::default(),
                &job.token,
            )
            .unwrap_err();
            assert_eq!(err.code, ErrorCode::DeviceError);
        }
        assert!(
            slot.start().is_ok(),
            "the slot must be free once the failed job is dropped"
        );
    }

    #[test]
    fn a_failure_says_where_the_job_stopped() {
        let failing = MockBackend {
            fail_at_percent: Some(41),
            ..MockBackend::default()
        };
        let sink = RecordingSink::default();
        let err = run_flash_job(
            &failing,
            &esp(),
            &thermostat_plan(),
            &sink,
            &CancelToken::new(),
        )
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::DeviceError);
        // The last event before the failing block: 483 328 of 1 186 202 bytes.
        assert_eq!(err.percent, Some(40));
        assert_eq!(
            err.phase,
            Some(Phase::Writing {
                index: 3,
                count: 4,
                label: "thermostat.bin".into(),
                address: 0x1_0000
            })
        );
        assert_eq!(sink.events().last().map(|e| e.percent()), Some(40));
    }

    #[test]
    fn a_failure_before_any_progress_has_no_position() {
        let err = run_flash_job(
            &MockBackend::default(),
            &esp(),
            &FlashPlan::new(Family::Esp32, vec![]),
            &RecordingSink::default(),
            &CancelToken::new(),
        )
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidPlan);
        assert_eq!((err.phase, err.percent), (None, None));
    }

    #[test]
    fn a_successful_job_forwards_every_event() {
        let sink = RecordingSink::default();
        let plan = thermostat_plan();
        run_flash_job(
            &MockBackend::default(),
            &esp(),
            &plan,
            &sink,
            &CancelToken::new(),
        )
        .unwrap();
        let events = sink.events();
        assert_eq!(events.first().map(|e| &e.phase), Some(&Phase::Connecting));
        assert_eq!(
            events.last().map(|e| e.bytes_done),
            Some(plan.total_bytes())
        );
    }

    #[test]
    fn cancel_without_a_job_reports_false() {
        assert!(!JobSlot::default().cancel());
    }

    /// Asks the slot to cancel as soon as writing starts, like a user clicking "Annuler".
    struct ClickCancel(Arc<JobSlot>, RecordingSink);

    impl ProgressSink for ClickCancel {
        fn report(&self, event: ProgressEvent) {
            if matches!(event.phase, Phase::Writing { .. }) {
                assert!(self.0.cancel());
            }
            self.1.report(event);
        }
    }

    #[test]
    fn cancel_mid_job_reports_cancelled() {
        let slot = Arc::new(JobSlot::default());
        let job = slot.start().unwrap();
        let sink = ClickCancel(slot.clone(), RecordingSink::default());
        let err = run_flash_job(
            &MockBackend::default(),
            &esp(),
            &thermostat_plan(),
            &sink,
            &job.token,
        )
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::Cancelled);
    }
}
