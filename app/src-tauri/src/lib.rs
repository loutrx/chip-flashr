use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
}

pub fn app_info_value() -> AppInfo {
    AppInfo {
        name: "Chip Flashr",
        version: env!("CARGO_PKG_VERSION"),
    }
}

#[tauri::command]
fn app_info() -> AppInfo {
    app_info_value()
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running Chip Flashr");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_reports_product_name_and_crate_version() {
        assert_eq!(
            app_info_value(),
            AppInfo {
                name: "Chip Flashr",
                version: env!("CARGO_PKG_VERSION")
            }
        );
    }
}
