use crate::{
    Family, FirmwareSummary, FlashPlan, Region, Scenario, Snapshot, Target, Transition, Trigger,
};

/// A scenario being played: the current stage and a counter that moves with it.
#[derive(Debug, Clone)]
pub struct SimulatedWorld {
    scenario: Scenario,
    stage: usize,
    generation: u64,
}

impl SimulatedWorld {
    /// # Panics
    ///
    /// If the scenario does not pass `Scenario::validate`.
    pub fn new(scenario: Scenario) -> Self {
        if let Err(e) = scenario.validate() {
            panic!("{e}");
        }
        Self {
            scenario,
            stage: 0,
            generation: 0,
        }
    }

    pub fn scenario_name(&self) -> &str {
        &self.scenario.name
    }

    pub fn snapshot(&self) -> &Snapshot {
        &self.scenario.stages[self.stage].snapshot
    }

    /// +1 on every stage change, so a timer armed for an older stage can tell it is stale.
    pub fn generation(&self) -> u64 {
        self.generation
    }

    /// Follows the first transition whose `on` equals `trigger` (never AfterMs). Returns true if the stage changed.
    pub fn trigger(&mut self, trigger: &Trigger) -> bool {
        if matches!(trigger, Trigger::AfterMs(_)) {
            return false;
        }
        let to = self.current_next().find(|t| t.on == *trigger).map(|t| t.to);
        to.is_some_and(|to| self.go(to))
    }

    /// The current stage's first AfterMs transition, as milliseconds.
    pub fn pending_delay(&self) -> Option<u64> {
        self.current_next().find_map(|t| match t.on {
            Trigger::AfterMs(ms) => Some(ms),
            _ => None,
        })
    }

    /// Follows that AfterMs transition, only if `generation` is still current. Returns true if the stage changed.
    pub fn elapse(&mut self, generation: u64) -> bool {
        if generation != self.generation {
            return false;
        }
        let to = self
            .current_next()
            .find(|t| matches!(t.on, Trigger::AfterMs(_)))
            .map(|t| t.to);
        to.is_some_and(|to| self.go(to))
    }

    pub fn firmware(&self, id: &str) -> Option<&FirmwareSummary> {
        self.snapshot().firmwares.iter().find(|f| f.id == id)
    }

    pub fn target(&self, id: &str) -> Option<&Target> {
        self.snapshot().targets.iter().find(|t| t.id == id)
    }

    fn current_next(&self) -> impl Iterator<Item = &Transition> {
        self.scenario.stages[self.stage].next.iter()
    }

    /// Any followed transition counts as a change, even back to the same stage, so the UI gets it again.
    fn go(&mut self, to: usize) -> bool {
        self.stage = to;
        self.generation += 1;
        true
    }
}

/// One region per image, filled with 0xFF, `chip` copied from the firmware.
pub fn plan_for(firmware: &FirmwareSummary, family: Family) -> FlashPlan {
    let regions = firmware
        .images
        .iter()
        .map(|image| {
            Region::new(
                image.address,
                image.name.clone(),
                vec![0xFF; image.size as usize],
            )
        })
        .collect();
    let mut plan = FlashPlan::new(family, regions);
    plan.chip = firmware.chip.clone();
    plan
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{SCENARIO_NAMES, load_scenario};

    fn world(name: &str) -> SimulatedWorld {
        SimulatedWorld::new(load_scenario(name).unwrap())
    }

    fn target_ids(world: &SimulatedWorld) -> Vec<&str> {
        world
            .snapshot()
            .targets
            .iter()
            .map(|t| t.id.as_str())
            .collect()
    }

    #[test]
    fn starts_on_the_first_stage() {
        let w = world("driver-missing");
        assert_eq!(w.scenario_name(), "driver-missing");
        assert_eq!(w.generation(), 0);
        assert_eq!(w.snapshot().issues.len(), 1);
        assert!(target_ids(&w).is_empty());
    }

    #[test]
    fn a_matching_trigger_moves_to_its_stage() {
        let mut w = world("driver-missing");
        assert!(w.trigger(&Trigger::Recheck));
        assert_eq!(w.generation(), 1);
        assert!(w.snapshot().issues.is_empty());
        assert_eq!(target_ids(&w), ["mock:esp32s3:COM4"]);
        assert!(
            !w.trigger(&Trigger::Recheck),
            "the last stage has no way out"
        );
        assert_eq!(w.generation(), 1);
    }

    #[test]
    fn other_triggers_change_nothing() {
        let mut w = world("driver-missing");
        assert!(!w.trigger(&Trigger::AddFolder));
        assert!(!w.trigger(&Trigger::OpenFile));
        assert!(!w.trigger(&Trigger::AfterMs(0)));
        assert_eq!(w.generation(), 0);
        assert_eq!(w.snapshot().issues.len(), 1);
    }

    #[test]
    fn a_transition_back_to_the_same_stage_still_counts() {
        let mut scenario = load_scenario("single").unwrap();
        scenario.stages[0].next.push(Transition {
            on: Trigger::Recheck,
            to: 0,
        });
        let mut w = SimulatedWorld::new(scenario);
        assert!(w.trigger(&Trigger::Recheck));
        assert_eq!(w.generation(), 1);
        assert!(w.trigger(&Trigger::Recheck));
        assert_eq!(w.generation(), 2);
    }

    #[test]
    fn add_folder_and_open_file_both_fill_an_empty_world() {
        for trigger in [Trigger::AddFolder, Trigger::OpenFile] {
            let mut w = world("no-firmware");
            assert!(w.snapshot().firmwares.is_empty());
            assert!(w.trigger(&trigger));
            assert!(w.firmware("thermostat-1.4.2-prod").is_some());
        }
    }

    #[test]
    fn a_delay_is_followed_only_by_elapse() {
        let mut w = world("waiting-board");
        assert_eq!(w.pending_delay(), Some(4000));
        assert!(!w.trigger(&Trigger::AfterMs(4000)));
        assert!(w.elapse(0));
        assert_eq!(target_ids(&w), ["mock:esp32s3:COM4"]);
        assert_eq!(w.pending_delay(), None);
        assert!(!w.elapse(1), "no delay left");
    }

    #[test]
    fn a_stale_elapse_is_ignored() {
        let mut w = world("ambiguous-hex");
        assert_eq!(w.pending_delay(), Some(8000));
        assert!(!w.elapse(3), "a generation from the future");
        assert_eq!(w.generation(), 0);
        assert!(w.elapse(0));
        assert!(!w.elapse(0), "the same timer firing twice");
        assert_eq!(w.generation(), 1);
    }

    #[test]
    fn looks_up_firmwares_and_targets_in_the_current_stage() {
        let mut w = world("ambiguous-hex");
        assert!(w.firmware("firmware-hex").is_some());
        assert!(w.firmware("nope").is_none());
        assert!(w.target("mock:stm32f411:ST-Link").is_none());
        w.elapse(0);
        assert_eq!(
            w.target("mock:stm32f411:ST-Link").map(|t| t.label.as_str()),
            Some("STM32F411")
        );
    }

    #[test]
    #[should_panic(expected = "has no stage")]
    fn refuses_an_invalid_scenario() {
        SimulatedWorld::new(Scenario {
            name: "empty".into(),
            stages: vec![],
        });
    }

    #[test]
    fn plan_for_writes_one_region_per_image() {
        let w = world("default");
        let plan = plan_for(w.firmware("thermostat-1.4.2-prod").unwrap(), Family::Esp32);
        assert_eq!(plan.family, Family::Esp32);
        assert_eq!(plan.chip.as_deref(), Some("esp32s3"));
        let layout: Vec<_> = plan
            .regions
            .iter()
            .map(|r| (r.address, r.label.as_str(), r.data.len()))
            .collect();
        assert_eq!(
            layout,
            [
                (0x0, "bootloader.bin", 21504),
                (0x8000, "partition-table.bin", 3072),
                (0xD000, "ota_data_initial.bin", 8192),
                (0x1_0000, "thermostat.bin", 1_153_434),
            ]
        );
        assert!(
            plan.regions
                .iter()
                .all(|r| r.data.iter().all(|b| *b == 0xFF))
        );
        assert_eq!(plan.total_bytes(), 1_186_202);
    }

    #[test]
    fn plan_for_uses_the_family_it_is_given() {
        let w = world("ambiguous-hex");
        let plan = plan_for(w.firmware("firmware-hex").unwrap(), Family::Stm32);
        assert_eq!(plan.family, Family::Stm32);
        assert_eq!(plan.chip, None);
        assert_eq!(plan.regions[0].address, 0x0800_0000);
    }

    #[test]
    fn every_scenario_firmware_gives_a_valid_plan() {
        for name in SCENARIO_NAMES {
            let scenario = load_scenario(name).unwrap();
            for stage in &scenario.stages {
                for firmware in &stage.snapshot.firmwares {
                    let plan = plan_for(firmware, Family::Esp32);
                    assert_eq!(plan.validate(), Ok(()), "{name} / {}", firmware.id);
                    assert_eq!(plan.total_bytes(), firmware.size_bytes);
                }
            }
        }
    }
}
