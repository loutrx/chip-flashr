use std::thread;
use std::time::{Duration, Instant};

use crate::{
    CancelToken, ChipInfo, EraseScope, Family, FlashBackend, FlashError, FlashPlan, FlashReport,
    Link, Phase, ProgressEvent, ProgressSink, Target,
};

/// Size of one simulated write, like a flash sector.
const CHUNK: usize = 4096;

/// Simulated backend: one fake board per family, configurable speed and failure.
#[derive(Debug, Clone, Default)]
pub struct MockBackend {
    /// Pause after each chunk, to make progress visible in the UI.
    pub chunk_delay: Duration,
    /// Fail with a device error once this share of the job is written.
    pub fail_at_percent: Option<u8>,
}

impl MockBackend {
    /// The simulated board for a family.
    pub fn target(family: Family) -> Target {
        let (id, label) = match family {
            Family::Esp32 => ("mock:esp32", "ESP32-S3"),
            Family::Stm32 => ("mock:stm32", "STM32F411"),
            Family::Nrf => ("mock:nrf", "nRF52840"),
        };
        Target {
            id: id.into(),
            family,
            label: label.into(),
            chip: None,
            port: "mock".into(),
            link: Link::UsbJtag,
            flash_size: Some(8 * 1024 * 1024),
        }
    }

    fn pause(&self, cancel: &CancelToken) -> Result<(), FlashError> {
        if cancel.is_cancelled() {
            return Err(FlashError::Cancelled);
        }
        if !self.chunk_delay.is_zero() {
            thread::sleep(self.chunk_delay);
        }
        Ok(())
    }
}

impl FlashBackend for MockBackend {
    fn families(&self) -> &'static [Family] {
        &Family::ALL
    }

    fn discover(&self) -> Result<Vec<Target>, FlashError> {
        Ok(Family::ALL.into_iter().map(Self::target).collect())
    }

    fn identify(&self, target: &Target) -> Result<ChipInfo, FlashError> {
        Ok(ChipInfo {
            model: target.label.clone(),
            flash_size: Some(8 * 1024 * 1024),
            details: vec![],
        })
    }

    fn flash(
        &self,
        target: &Target,
        plan: &FlashPlan,
        progress: &dyn ProgressSink,
        cancel: &CancelToken,
    ) -> Result<FlashReport, FlashError> {
        plan.validate()?;
        if plan.family != target.family {
            return Err(FlashError::FamilyMismatch {
                plan: plan.family,
                target: target.family,
            });
        }

        let started = Instant::now();
        let total = plan.total_bytes();
        let emit = |phase: Phase, done: u64| {
            progress.report(ProgressEvent {
                phase,
                bytes_done: done,
                bytes_total: total,
            })
        };
        let mut log = vec![format!("connect {}", target.label)];

        emit(Phase::Connecting, 0);
        self.pause(cancel)?;
        emit(Phase::Erasing, 0);
        self.pause(cancel)?;

        let mut done: u64 = 0;
        let count = plan.regions.len();
        for (index, region) in plan.regions.iter().enumerate() {
            let blocks = region.data.len().div_ceil(CHUNK);
            for (n, chunk) in region.data.chunks(CHUNK).enumerate() {
                self.pause(cancel)?;
                done += chunk.len() as u64;
                if let Some(limit) = self.fail_at_percent
                    && done * 100 >= u64::from(limit) * total
                {
                    // Blocks are counted within the image being written.
                    let block = n + 1;
                    let at = u64::from(region.address) + (n * CHUNK) as u64;
                    return Err(FlashError::Device(format!(
                        "write block {block}/{blocks} @ {at:#010x}\nerror: simulated disconnect"
                    )));
                }
                let phase = Phase::Writing {
                    index,
                    count,
                    label: region.label.clone(),
                    address: region.address,
                };
                emit(phase, done);
            }
            log.push(format!(
                "write {:#x} {} {} B",
                region.address,
                region.label,
                region.data.len()
            ));
        }

        if plan.verify {
            emit(Phase::Verifying, done);
            self.pause(cancel)?;
            log.push("verify ok".into());
        }
        if plan.reset_after {
            emit(Phase::Resetting, done);
            log.push("reset".into());
        }
        Ok(FlashReport {
            bytes_written: done,
            duration_ms: started.elapsed().as_millis() as u64,
            verified: plan.verify,
            log,
        })
    }

    fn erase(
        &self,
        _target: &Target,
        _scope: EraseScope,
        progress: &dyn ProgressSink,
    ) -> Result<(), FlashError> {
        progress.report(ProgressEvent {
            phase: Phase::Erasing,
            bytes_done: 0,
            bytes_total: 0,
        });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        ErrorCode, RecordingSink, Region, SimulatedWorld, UserFacingError, load_scenario, plan_for,
    };

    fn small_plan() -> FlashPlan {
        FlashPlan::new(
            Family::Esp32,
            vec![
                Region::new(0x0, "bootloader", vec![0; 3 * CHUNK]),
                Region::new(0x1_0000, "app", vec![0; 5 * CHUNK]),
            ],
        )
    }

    fn kinds(events: &[ProgressEvent]) -> Vec<&'static str> {
        events
            .iter()
            .map(|e| match e.phase {
                Phase::Connecting => "connecting",
                Phase::Erasing => "erasing",
                Phase::Writing { .. } => "writing",
                Phase::Verifying => "verifying",
                Phase::Resetting => "resetting",
            })
            .collect()
    }

    #[test]
    fn discovers_one_board_per_family() {
        let ids: Vec<_> = MockBackend::default()
            .discover()
            .unwrap()
            .into_iter()
            .map(|t| t.id)
            .collect();
        assert_eq!(ids, ["mock:esp32", "mock:stm32", "mock:nrf"]);
    }

    #[test]
    fn flash_reports_phases_in_order_and_ends_at_total() {
        let sink = RecordingSink::default();
        let plan = small_plan();
        let report = MockBackend::default()
            .flash(
                &MockBackend::target(Family::Esp32),
                &plan,
                &sink,
                &CancelToken::new(),
            )
            .unwrap();

        let events = sink.events();
        let mut expected = vec!["connecting", "erasing"];
        expected.extend(std::iter::repeat_n("writing", 8));
        expected.extend(["verifying", "resetting"]);
        assert_eq!(kinds(&events), expected);
        assert_eq!(events.last().unwrap().bytes_done, plan.total_bytes());
        assert_eq!(report.bytes_written, plan.total_bytes());
        assert!(report.verified);
    }

    #[test]
    fn flash_logs_one_line_per_phase() {
        let report = MockBackend::default()
            .flash(
                &MockBackend::target(Family::Esp32),
                &small_plan(),
                &RecordingSink::default(),
                &CancelToken::new(),
            )
            .unwrap();
        assert_eq!(
            report.log,
            [
                "connect ESP32-S3",
                "write 0x0 bootloader 12288 B",
                "write 0x10000 app 20480 B",
                "verify ok",
                "reset",
            ]
        );
    }

    #[test]
    fn written_bytes_never_go_backwards() {
        let sink = RecordingSink::default();
        MockBackend::default()
            .flash(
                &MockBackend::target(Family::Esp32),
                &small_plan(),
                &sink,
                &CancelToken::new(),
            )
            .unwrap();
        let done: Vec<u64> = sink.events().iter().map(|e| e.bytes_done).collect();
        assert!(done.windows(2).all(|w| w[0] <= w[1]), "{done:?}");
    }

    #[test]
    fn skips_verify_and_reset_when_disabled() {
        let sink = RecordingSink::default();
        let mut plan = small_plan();
        plan.verify = false;
        plan.reset_after = false;
        let report = MockBackend::default()
            .flash(
                &MockBackend::target(Family::Esp32),
                &plan,
                &sink,
                &CancelToken::new(),
            )
            .unwrap();
        assert_eq!(kinds(&sink.events()).last(), Some(&"writing"));
        assert!(!report.verified);
        assert_eq!(
            report.log.last().map(String::as_str),
            Some("write 0x10000 app 20480 B")
        );
    }

    /// Cancels the job as soon as the first chunk is written.
    struct CancelOnFirstWrite {
        token: CancelToken,
        inner: RecordingSink,
    }

    impl ProgressSink for CancelOnFirstWrite {
        fn report(&self, event: ProgressEvent) {
            if matches!(event.phase, Phase::Writing { .. }) {
                self.token.cancel();
            }
            self.inner.report(event);
        }
    }

    #[test]
    fn cancel_stops_within_one_chunk() {
        let token = CancelToken::new();
        let sink = CancelOnFirstWrite {
            token: token.clone(),
            inner: RecordingSink::default(),
        };
        let err = MockBackend::default()
            .flash(
                &MockBackend::target(Family::Esp32),
                &small_plan(),
                &sink,
                &token,
            )
            .unwrap_err();
        assert!(matches!(err, FlashError::Cancelled));
        let writes = kinds(&sink.inner.events())
            .iter()
            .filter(|k| **k == "writing")
            .count();
        assert_eq!(writes, 1);
    }

    #[test]
    fn fails_at_requested_percentage() {
        let sink = RecordingSink::default();
        let plan = small_plan();
        let backend = MockBackend {
            fail_at_percent: Some(50),
            ..MockBackend::default()
        };
        let err = backend
            .flash(
                &MockBackend::target(Family::Esp32),
                &plan,
                &sink,
                &CancelToken::new(),
            )
            .unwrap_err();
        assert_eq!(UserFacingError::from(&err).code, ErrorCode::DeviceError);
        assert!(sink.events().last().unwrap().bytes_done < plan.total_bytes());
    }

    #[test]
    fn failure_names_the_block_and_address() {
        let backend = MockBackend {
            fail_at_percent: Some(50),
            ..MockBackend::default()
        };
        let err = backend
            .flash(
                &MockBackend::target(Family::Esp32),
                &small_plan(),
                &RecordingSink::default(),
                &CancelToken::new(),
            )
            .unwrap_err();
        // 4 of the 8 blocks reach 50 %: the first of the 5 blocks of `app`.
        assert_eq!(
            UserFacingError::from(&err).technical,
            "device error: write block 1/5 @ 0x00010000\nerror: simulated disconnect"
        );
    }

    #[test]
    fn invalid_plan_emits_no_progress() {
        let sink = RecordingSink::default();
        let plan = FlashPlan::new(Family::Esp32, vec![]);
        let err = MockBackend::default()
            .flash(
                &MockBackend::target(Family::Esp32),
                &plan,
                &sink,
                &CancelToken::new(),
            )
            .unwrap_err();
        assert!(matches!(err, FlashError::InvalidPlan(_)));
        assert!(sink.events().is_empty());
    }

    #[test]
    fn refuses_a_plan_for_another_family() {
        let sink = RecordingSink::default();
        let err = MockBackend::default()
            .flash(
                &MockBackend::target(Family::Nrf),
                &small_plan(),
                &sink,
                &CancelToken::new(),
            )
            .unwrap_err();
        assert!(matches!(
            err,
            FlashError::FamilyMismatch {
                plan: Family::Esp32,
                target: Family::Nrf
            }
        ));
        assert!(sink.events().is_empty());
    }

    #[test]
    fn flashes_a_scenario_firmware_end_to_end() {
        let world = SimulatedWorld::new(load_scenario("single").unwrap());
        let firmware = world.firmware("thermostat-1.4.2-prod").unwrap();
        let target = world.target("mock:esp32s3:COM4").unwrap();
        let report = MockBackend::default()
            .flash(
                target,
                &plan_for(firmware, Family::Esp32),
                &RecordingSink::default(),
                &CancelToken::new(),
            )
            .unwrap();
        assert_eq!(report.bytes_written, firmware.size_bytes);
        assert_eq!(report.log[0], "connect ESP32-S3");
        assert_eq!(report.log[4], "write 0x10000 thermostat.bin 1153434 B");
    }
}
