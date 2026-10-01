use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::time::Duration;

use flashr_core::SimulatedWorld;
use tauri::{AppHandle, Emitter};

pub const SNAPSHOT_EVENT: &str = "snapshot-changed";

/// A panic while holding the lock leaves the world usable: it is plain data.
pub fn lock_world(world: &Mutex<SimulatedWorld>) -> MutexGuard<'_, SimulatedWorld> {
    world.lock().unwrap_or_else(|e| e.into_inner())
}

pub fn emit_snapshot(app: &AppHandle, world: &Mutex<SimulatedWorld>) {
    // Emitting under the lock keeps two emits in stage order.
    let world = lock_world(world);
    // No window yet, or one closing: its next `snapshot` call catches up.
    let _ = app.emit(SNAPSHOT_EVENT, world.snapshot());
}

/// If the current stage has an AfterMs transition, sleep on a thread, then elapse(generation) and emit; repeats for the next stage.
pub fn schedule_delay(app: AppHandle, world: Arc<Mutex<SimulatedWorld>>) {
    let Some((generation, delay)) = next_delay(&world) else {
        return;
    };
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(delay));
        // A trigger may have moved the stage meanwhile: `elapse` then refuses the old generation.
        let changed = lock_world(&world).elapse(generation);
        if changed {
            emit_snapshot(&app, &world);
            schedule_delay(app, world);
        }
    });
}

/// The generation a timer must present, and how long it sleeps.
pub fn next_delay(world: &Mutex<SimulatedWorld>) -> Option<(u64, u64)> {
    let world = lock_world(world);
    world.pending_delay().map(|ms| (world.generation(), ms))
}

#[cfg(test)]
mod tests {
    use super::*;
    use flashr_core::load_scenario;

    fn world(name: &str) -> Mutex<SimulatedWorld> {
        Mutex::new(SimulatedWorld::new(load_scenario(name).unwrap()))
    }

    #[test]
    fn a_timed_stage_asks_for_a_timer() {
        let w = world("waiting-board");
        assert_eq!(next_delay(&w), Some((0, 4000)));
        assert!(lock_world(&w).elapse(0));
        assert_eq!(next_delay(&w), None);
    }

    #[test]
    fn an_untimed_stage_asks_for_none() {
        assert_eq!(next_delay(&world("default")), None);
        assert_eq!(next_delay(&world("driver-missing")), None);
    }

    #[test]
    fn a_second_timer_for_the_same_stage_changes_nothing() {
        let w = world("ambiguous-hex");
        let (generation, delay) = next_delay(&w).unwrap();
        assert_eq!(delay, 8000);
        assert!(lock_world(&w).elapse(generation));
        assert!(!lock_world(&w).elapse(generation));
        assert_eq!(lock_world(&w).generation(), 1);
    }
}
