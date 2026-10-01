use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::Snapshot;

/// A simulated world: snapshots the mock walks through on triggers.
/// The same JSON files feed the browser preview, so both worlds stay identical.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Scenario {
    pub name: String,
    pub stages: Vec<Stage>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Stage {
    pub snapshot: Snapshot,
    pub next: Vec<Transition>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Transition {
    pub on: Trigger,
    /// Index into `Scenario::stages`.
    pub to: usize,
}

/// Wire: `"recheck"`, `"add-folder"`, `"open-file"` or `{ "afterMs": 4000 }`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Trigger {
    #[serde(rename = "recheck")]
    Recheck,
    #[serde(rename = "add-folder")]
    AddFolder,
    #[serde(rename = "open-file")]
    OpenFile,
    #[serde(rename = "afterMs")]
    AfterMs(u64),
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ScenarioError {
    #[error("scenario `{name}` has no stage")]
    NoStage { name: String },
    #[error("scenario `{name}`: stage {stage} leads to stage {to}, which does not exist")]
    UnknownStage {
        name: String,
        stage: usize,
        to: usize,
    },
    #[error("scenario `{name}`: firmware `{firmware}` is in folder {folder}, which does not exist")]
    UnknownFolder {
        name: String,
        firmware: String,
        folder: usize,
    },
}

pub const SCENARIO_NAMES: [&str; 8] = [
    "default",
    "single",
    "no-firmware",
    "ambiguous-hex",
    "waiting-board",
    "driver-missing",
    "nordic-locked",
    "incomplete",
];

pub const DEFAULT_SCENARIO: &str = "default";

/// The bundled JSON of a scenario, or `None` for an unknown name.
pub fn scenario_source(name: &str) -> Option<&'static str> {
    Some(match name {
        "default" => include_str!("../scenarios/default.json"),
        "single" => include_str!("../scenarios/single.json"),
        "no-firmware" => include_str!("../scenarios/no-firmware.json"),
        "ambiguous-hex" => include_str!("../scenarios/ambiguous-hex.json"),
        "waiting-board" => include_str!("../scenarios/waiting-board.json"),
        "driver-missing" => include_str!("../scenarios/driver-missing.json"),
        "nordic-locked" => include_str!("../scenarios/nordic-locked.json"),
        "incomplete" => include_str!("../scenarios/incomplete.json"),
        _ => return None,
    })
}

/// Parses and validates a bundled scenario. `None` for an unknown name.
///
/// # Panics
///
/// If a bundled file is broken, which the tests below rule out before any release.
pub fn load_scenario(name: &str) -> Option<Scenario> {
    let source = scenario_source(name)?;
    let scenario: Scenario = serde_json::from_str(source)
        .unwrap_or_else(|e| panic!("bundled scenario `{name}` does not parse: {e}"));
    if let Err(e) = scenario.validate() {
        panic!("bundled scenario `{name}` is invalid: {e}");
    }
    Some(scenario)
}

/// Unknown or absent name → default; the warning names the unknown value.
/// The warning is the raw name, not a sentence: the UI words it.
pub fn resolve_scenario(requested: Option<&str>) -> (Scenario, Option<String>) {
    let requested = requested.map(str::trim).filter(|name| !name.is_empty());
    if let Some(scenario) = requested.and_then(load_scenario) {
        return (scenario, None);
    }
    let fallback = load_scenario(DEFAULT_SCENARIO).expect("the default scenario is bundled");
    (fallback, requested.map(str::to_owned))
}

impl Scenario {
    /// At least one stage, every transition and every firmware folder pointing somewhere.
    pub fn validate(&self) -> Result<(), ScenarioError> {
        if self.stages.is_empty() {
            return Err(ScenarioError::NoStage {
                name: self.name.clone(),
            });
        }
        for (index, stage) in self.stages.iter().enumerate() {
            if let Some(t) = stage.next.iter().find(|t| t.to >= self.stages.len()) {
                return Err(ScenarioError::UnknownStage {
                    name: self.name.clone(),
                    stage: index,
                    to: t.to,
                });
            }
            let folders = stage.snapshot.folders.len();
            if let Some(f) = stage
                .snapshot
                .firmwares
                .iter()
                .find(|f| f.folder >= folders)
            {
                return Err(ScenarioError::UnknownFolder {
                    name: self.name.clone(),
                    firmware: f.id.clone(),
                    folder: f.folder,
                });
            }
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::{FamilyGuess, Snapshot};
    use serde_json::{Value, json};

    fn all() -> Vec<Scenario> {
        SCENARIO_NAMES
            .iter()
            .map(|name| load_scenario(name).unwrap())
            .collect()
    }

    fn ids(snapshot: &Snapshot) -> (Vec<&str>, Vec<&str>) {
        (
            snapshot.firmwares.iter().map(|f| f.id.as_str()).collect(),
            snapshot.targets.iter().map(|t| t.id.as_str()).collect(),
        )
    }

    #[test]
    fn every_name_loads_and_carries_its_own_name() {
        for name in SCENARIO_NAMES {
            assert_eq!(load_scenario(name).unwrap().name, name);
        }
        assert!(SCENARIO_NAMES.contains(&DEFAULT_SCENARIO));
    }

    #[test]
    fn an_unknown_name_has_no_source() {
        assert_eq!(scenario_source("nope"), None);
        assert_eq!(load_scenario("nope"), None);
    }

    #[test]
    fn bundled_files_are_canonical() {
        // Re-serializing gives back the file: every field present, `null` spelled out, nothing extra.
        for name in SCENARIO_NAMES {
            let source = scenario_source(name).unwrap();
            let parsed: Scenario = serde_json::from_str(source).unwrap();
            let file: Value = serde_json::from_str(source).unwrap();
            assert_eq!(serde_json::to_value(&parsed).unwrap(), file, "{name}");
        }
    }

    #[test]
    fn every_bundled_scenario_validates() {
        for scenario in all() {
            assert_eq!(scenario.validate(), Ok(()), "{}", scenario.name);
        }
    }

    #[test]
    fn every_firmware_has_disjoint_images_that_add_up() {
        for scenario in all() {
            for stage in &scenario.stages {
                for f in &stage.snapshot.firmwares {
                    let at = format!("{} / {}", scenario.name, f.id);
                    assert!(!f.images.is_empty(), "{at}");
                    assert!(f.images.iter().all(|i| i.size > 0), "{at}");
                    let mut images: Vec<_> = f.images.iter().collect();
                    images.sort_by_key(|i| i.address);
                    for pair in images.windows(2) {
                        let end = u64::from(pair[0].address) + pair[0].size;
                        assert!(end <= u64::from(pair[1].address), "{at}: overlap");
                    }
                    let total: u64 = f.images.iter().map(|i| i.size).sum();
                    assert_eq!(f.size_bytes, total, "{at}");
                    assert_eq!(f.address_ranges as usize, f.images.len(), "{at}");
                }
            }
        }
    }

    /// Firmware ids, then target ids, of one stage.
    type StageIds = (&'static [&'static str], &'static [&'static str]);

    #[test]
    fn scenarios_hold_the_expected_firmwares_and_boards() {
        let expected: [(&str, &[StageIds]); 8] = [
            (
                "default",
                &[(
                    &[
                        "thermostat-1.4.2-prod",
                        "thermostat-1.3.0-prod",
                        "capteur-porte-2.0.1",
                        "passerelle-0.9.0-rc2",
                        "sonde-air-1.0.0",
                        "firmware-hex",
                    ],
                    &["mock:esp32s3:COM4"],
                )],
            ),
            (
                "single",
                &[(&["thermostat-1.4.2-prod"], &["mock:esp32s3:COM4"])],
            ),
            (
                "no-firmware",
                &[
                    (&[], &[]),
                    (&["thermostat-1.4.2-prod"], &["mock:esp32s3:COM4"]),
                ],
            ),
            (
                "ambiguous-hex",
                &[
                    (&["firmware-hex"], &[]),
                    (&["firmware-hex"], &["mock:stm32f411:ST-Link"]),
                ],
            ),
            (
                "waiting-board",
                &[
                    (&["thermostat-1.4.2-prod"], &[]),
                    (&["thermostat-1.4.2-prod"], &["mock:esp32s3:COM4"]),
                ],
            ),
            (
                "driver-missing",
                &[
                    (&["thermostat-1.4.2-prod"], &[]),
                    (&["thermostat-1.4.2-prod"], &["mock:esp32s3:COM4"]),
                ],
            ),
            (
                "nordic-locked",
                &[
                    (&["capteur-porte-2.0.1"], &[]),
                    (&["capteur-porte-2.0.1"], &["mock:nrf52840:J-Link"]),
                ],
            ),
            (
                "incomplete",
                &[(&["thermostat-1.5.0-beta"], &["mock:esp32s3:COM4"])],
            ),
        ];
        for (name, stages) in expected {
            let scenario = load_scenario(name).unwrap();
            let actual: Vec<_> = scenario.stages.iter().map(|s| ids(&s.snapshot)).collect();
            let wanted: Vec<_> = stages
                .iter()
                .map(|(f, t)| (f.to_vec(), t.to_vec()))
                .collect();
            assert_eq!(actual, wanted, "{name}");
        }
    }

    #[test]
    fn problem_scenarios_start_with_their_problem() {
        let issue_kinds = |name: &str| {
            let scenario = load_scenario(name).unwrap();
            scenario
                .stages
                .iter()
                .map(|s| serde_json::to_value(&s.snapshot.issues).unwrap())
                .map(|v| {
                    v.as_array()
                        .unwrap()
                        .iter()
                        .map(|i| i["kind"].clone())
                        .collect()
                })
                .collect::<Vec<Vec<Value>>>()
        };
        assert_eq!(
            issue_kinds("driver-missing"),
            [vec![json!("missing-driver")], vec![]]
        );
        assert_eq!(
            issue_kinds("nordic-locked"),
            [vec![json!("missing-tool")], vec![]]
        );
        let incomplete = load_scenario("incomplete").unwrap();
        assert!(incomplete.stages[0].snapshot.firmwares[0].is_invalid());
        let hex = load_scenario("ambiguous-hex").unwrap();
        assert!(matches!(
            hex.stages[0].snapshot.firmwares[0].family,
            FamilyGuess::Suggested { .. }
        ));
    }

    #[test]
    fn trigger_wire_format() {
        let cases = [
            (Trigger::Recheck, json!("recheck")),
            (Trigger::AddFolder, json!("add-folder")),
            (Trigger::OpenFile, json!("open-file")),
            (Trigger::AfterMs(4000), json!({ "afterMs": 4000 })),
        ];
        for (trigger, wire) in cases {
            assert_eq!(serde_json::to_value(&trigger).unwrap(), wire);
            assert_eq!(serde_json::from_value::<Trigger>(wire).unwrap(), trigger);
        }
    }

    #[test]
    fn an_unknown_field_is_rejected() {
        let mut file: Value = serde_json::from_str(scenario_source("single").unwrap()).unwrap();
        file["stages"][0]["snapshot"]["firmwares"][0]["colour"] = json!("red");
        let err = serde_json::from_value::<Scenario>(file).unwrap_err();
        assert!(err.to_string().contains("unknown field `colour`"), "{err}");
    }

    #[test]
    fn unknown_or_absent_names_fall_back_to_default() {
        let (scenario, warning) = resolve_scenario(Some("nope"));
        assert_eq!(
            (scenario.name.as_str(), warning.as_deref()),
            ("default", Some("nope"))
        );
        let (scenario, warning) = resolve_scenario(Some(" incomplete "));
        assert_eq!((scenario.name.as_str(), warning), ("incomplete", None));
        let (scenario, warning) = resolve_scenario(None);
        assert_eq!((scenario.name.as_str(), warning), ("default", None));
        let (scenario, warning) = resolve_scenario(Some(""));
        assert_eq!((scenario.name.as_str(), warning), ("default", None));
    }

    #[test]
    fn validate_rejects_dangling_references() {
        let mut scenario = load_scenario("waiting-board").unwrap();
        scenario.stages[0].next[0].to = 7;
        assert_eq!(
            scenario.validate(),
            Err(ScenarioError::UnknownStage {
                name: "waiting-board".into(),
                stage: 0,
                to: 7
            })
        );

        let mut scenario = load_scenario("single").unwrap();
        scenario.stages[0].snapshot.firmwares[0].folder = 2;
        assert_eq!(
            scenario.validate(),
            Err(ScenarioError::UnknownFolder {
                name: "single".into(),
                firmware: "thermostat-1.4.2-prod".into(),
                folder: 2
            })
        );

        scenario.stages.clear();
        assert_eq!(
            scenario.validate(),
            Err(ScenarioError::NoStage {
                name: "single".into()
            })
        );
    }
}
