use std::sync::{Arc, Mutex};

use flashr_core::{
    CancelToken, ErrorCode, FlashBackend, FlashPlan, FlashReport, ProgressSink, Target,
    UserFacingError,
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

/// Run one job on the current thread and translate the outcome for the UI.
pub fn run_flash_job(
    backend: &dyn FlashBackend,
    target: &Target,
    plan: &FlashPlan,
    sink: &dyn ProgressSink,
    cancel: &CancelToken,
) -> Result<FlashReport, UserFacingError> {
    backend
        .flash(target, plan, sink, cancel)
        .map_err(|e| UserFacingError::from(&e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use flashr_core::{Family, MockBackend, Phase, ProgressEvent, RecordingSink, demo_plan};

    fn esp() -> Target {
        MockBackend::target(Family::Esp32)
    }

    #[test]
    fn successful_job_returns_the_report() {
        let slot = Arc::new(JobSlot::default());
        let job = slot.start().unwrap();
        let plan = demo_plan(Family::Esp32);
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
                &demo_plan(Family::Esp32),
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
            &demo_plan(Family::Esp32),
            &sink,
            &job.token,
        )
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::Cancelled);
    }
}
