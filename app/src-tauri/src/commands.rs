use std::sync::Arc;

use flashr_core::{
    ErrorCode, Family, FamilyGuess, FlashPlan, FlashReport, ProgressEvent, ProgressSink,
    SimulatedWorld, Snapshot, Target, Trigger, UserFacingError, plan_for,
};
use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use crate::jobs::run_flash_job;
use crate::state::AppState;
use crate::world::{emit_snapshot, lock_world, schedule_delay};

/// Forwards backend progress to the UI over a Tauri channel.
struct ChannelSink(Channel<ProgressEvent>);

impl ProgressSink for ChannelSink {
    fn report(&self, event: ProgressEvent) {
        // The window may be closing; losing a progress tick is harmless.
        let _ = self.0.send(event);
    }
}

/// The plan and board for a flash request, checked against the current snapshot.
/// A certain family wins over `family`, which only settles an ambiguous firmware.
pub fn resolve_flash(
    world: &SimulatedWorld,
    firmware_id: &str,
    target_id: &str,
    family: Option<Family>,
) -> Result<(FlashPlan, Target), UserFacingError> {
    let firmware = world.firmware(firmware_id).ok_or_else(|| {
        UserFacingError::new(
            ErrorCode::InvalidPlan,
            format!("unknown firmware `{firmware_id}`"),
        )
    })?;
    let target = world.target(target_id).ok_or_else(|| {
        UserFacingError::new(
            ErrorCode::TargetNotFound,
            format!("unknown target `{target_id}`"),
        )
    })?;
    let family = match (&firmware.family, family) {
        (FamilyGuess::Certain { family }, _) => *family,
        (_, Some(chosen)) => chosen,
        _ => {
            return Err(UserFacingError::new(
                ErrorCode::InvalidPlan,
                format!("no chip family for firmware `{firmware_id}`"),
            ));
        }
    };
    Ok((plan_for(firmware, family), target.clone()))
}

/// Follows `trigger`; when the stage changed, tells the UI and arms the new stage's timer.
fn follow(app: &AppHandle, state: &AppState, trigger: &Trigger) {
    let changed = lock_world(&state.world).trigger(trigger);
    if changed {
        emit_snapshot(app, &state.world);
        schedule_delay(app.clone(), Arc::clone(&state.world));
    }
}

#[tauri::command]
pub fn snapshot(state: State<'_, AppState>) -> Snapshot {
    lock_world(&state.world).snapshot().clone()
}

#[tauri::command]
pub async fn flash(
    state: State<'_, AppState>,
    firmware_id: String,
    target_id: String,
    family: Option<Family>,
    on_progress: Channel<ProgressEvent>,
) -> Result<FlashReport, UserFacingError> {
    let (plan, target) = {
        let world = lock_world(&state.world);
        resolve_flash(&world, &firmware_id, &target_id, family)?
    };
    let job = state.jobs.start()?;
    let backend = Arc::clone(&state.mock);
    let sink = ChannelSink(on_progress);

    tauri::async_runtime::spawn_blocking(move || {
        let result = run_flash_job(backend.as_ref(), &target, &plan, &sink, &job.token);
        drop(job); // free the slot before answering the UI
        result
    })
    .await
    .map_err(|e| {
        UserFacingError::new(ErrorCode::DeviceError, format!("flash worker stopped: {e}"))
    })?
}

#[tauri::command]
pub fn cancel_flash(state: State<'_, AppState>) -> bool {
    state.jobs.cancel()
}

#[tauri::command]
pub fn recheck(app: AppHandle, state: State<'_, AppState>) {
    follow(&app, &state, &Trigger::Recheck);
}

/// Simulated until the folder picker of plan 4.
#[tauri::command]
pub fn add_folder(app: AppHandle, state: State<'_, AppState>) {
    follow(&app, &state, &Trigger::AddFolder);
}

/// Simulated until the file picker of plan 4.
#[tauri::command]
pub fn open_file(app: AppHandle, state: State<'_, AppState>) {
    follow(&app, &state, &Trigger::OpenFile);
}

#[cfg(test)]
mod tests {
    use super::*;
    use flashr_core::{CancelToken, MockBackend, RecordingSink, load_scenario};

    fn world(name: &str) -> SimulatedWorld {
        SimulatedWorld::new(load_scenario(name).unwrap())
    }

    #[test]
    fn builds_the_plan_from_the_firmware_images() {
        let (plan, target) = resolve_flash(
            &world("default"),
            "thermostat-1.4.2-prod",
            "mock:esp32s3:COM4",
            None,
        )
        .unwrap();
        assert_eq!(plan.family, Family::Esp32);
        assert_eq!(plan.chip.as_deref(), Some("esp32s3"));
        assert_eq!(plan.regions.len(), 4);
        assert_eq!(target.port, "COM4");
    }

    #[test]
    fn an_unknown_firmware_is_an_invalid_plan() {
        let err = resolve_flash(&world("default"), "nope", "mock:esp32s3:COM4", None).unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidPlan);
        assert_eq!(err.technical, "unknown firmware `nope`");
    }

    #[test]
    fn an_unplugged_board_is_not_found() {
        let err = resolve_flash(
            &world("waiting-board"),
            "thermostat-1.4.2-prod",
            "mock:esp32s3:COM4",
            None,
        )
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::TargetNotFound);
        assert_eq!(err.technical, "unknown target `mock:esp32s3:COM4`");
    }

    #[test]
    fn an_ambiguous_firmware_needs_the_chosen_family() {
        let mut w = world("ambiguous-hex");
        w.elapse(0);
        let err = resolve_flash(&w, "firmware-hex", "mock:stm32f411:ST-Link", None).unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidPlan);
        assert_eq!(err.technical, "no chip family for firmware `firmware-hex`");
        let (plan, _) = resolve_flash(
            &w,
            "firmware-hex",
            "mock:stm32f411:ST-Link",
            Some(Family::Stm32),
        )
        .unwrap();
        assert_eq!(plan.family, Family::Stm32);
    }

    #[test]
    fn a_certain_family_wins_over_the_requested_one() {
        let (plan, _) = resolve_flash(
            &world("single"),
            "thermostat-1.4.2-prod",
            "mock:esp32s3:COM4",
            Some(Family::Nrf),
        )
        .unwrap();
        assert_eq!(plan.family, Family::Esp32);
    }

    #[test]
    fn a_board_of_another_family_is_refused_by_the_mock() {
        let (plan, target) = resolve_flash(
            &world("default"),
            "passerelle-0.9.0-rc2",
            "mock:esp32s3:COM4",
            None,
        )
        .unwrap();
        let err = run_flash_job(
            &MockBackend::default(),
            &target,
            &plan,
            &RecordingSink::default(),
            &CancelToken::new(),
        )
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::FamilyMismatch);
        assert_eq!((err.phase, err.percent), (None, None));
    }
}
