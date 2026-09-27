use flashr_core::{
    ErrorCode, FlashReport, ProgressEvent, ProgressSink, Target, UserFacingError, demo_plan,
};
use tauri::State;
use tauri::ipc::Channel;

use crate::jobs::run_flash_job;
use crate::state::AppState;

/// Forwards backend progress to the UI over a Tauri channel.
struct ChannelSink(Channel<ProgressEvent>);

impl ProgressSink for ChannelSink {
    fn report(&self, event: ProgressEvent) {
        // The window may be closing; losing a progress tick is harmless.
        let _ = self.0.send(event);
    }
}

#[tauri::command]
pub fn list_targets(state: State<'_, AppState>) -> Vec<Target> {
    state.list_targets()
}

#[tauri::command]
pub async fn flash_demo(
    state: State<'_, AppState>,
    target_id: String,
    on_progress: Channel<ProgressEvent>,
) -> Result<FlashReport, UserFacingError> {
    let (backend, target) = state.find(&target_id).ok_or_else(|| {
        UserFacingError::new(
            ErrorCode::TargetNotFound,
            format!("unknown target `{target_id}`"),
        )
    })?;
    let job = state.jobs.start()?;
    let plan = demo_plan(target.family);
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
