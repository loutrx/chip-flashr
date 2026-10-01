mod commands;
mod jobs;
mod state;
mod world;

use std::sync::Arc;

use serde::Serialize;
use tauri::{Manager, State};

use crate::state::AppState;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    /// The simulated scenario being played; `None` once real backends exist.
    pub scenario: Option<String>,
    /// The unknown scenario name that was asked for; the UI words the warning.
    pub scenario_warning: Option<String>,
}

fn app_info_value(state: &AppState) -> AppInfo {
    AppInfo {
        name: "Chip Flashr",
        version: env!("CARGO_PKG_VERSION"),
        scenario: Some(world::lock_world(&state.world).scenario_name().to_owned()),
        scenario_warning: state.scenario_warning.clone(),
    }
}

#[tauri::command]
fn app_info(state: State<'_, AppState>) -> AppInfo {
    app_info_value(&state)
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::from_env())
        .setup(|app| {
            // A first stage with a delay (waiting-board, ambiguous-hex) starts its timer now.
            let world = Arc::clone(&app.state::<AppState>().world);
            world::schedule_delay(app.handle().clone(), world);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            commands::snapshot,
            commands::flash,
            commands::cancel_flash,
            commands::recheck,
            commands::add_folder,
            commands::open_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Chip Flashr");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_reports_product_version_and_scenario() {
        assert_eq!(
            app_info_value(&AppState::new(Some("single"), None)),
            AppInfo {
                name: "Chip Flashr",
                version: env!("CARGO_PKG_VERSION"),
                scenario: Some("single".into()),
                scenario_warning: None,
            }
        );
    }

    #[test]
    fn app_info_carries_the_unknown_scenario_name() {
        let info = app_info_value(&AppState::new(Some("nope"), None));
        assert_eq!(
            serde_json::to_value(&info).unwrap(),
            serde_json::json!({
                "name": "Chip Flashr",
                "version": env!("CARGO_PKG_VERSION"),
                "scenario": "default",
                "scenarioWarning": "nope"
            })
        );
    }
}
