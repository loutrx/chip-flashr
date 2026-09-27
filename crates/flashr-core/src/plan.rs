use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::Family;

/// A contiguous block of bytes to write at a flash address.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Region {
    pub address: u32,
    pub label: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EraseScope {
    /// Erase only the sectors covered by the regions.
    #[default]
    Regions,
    /// Erase the whole flash before writing.
    Full,
}

/// Backend-agnostic description of what to write where.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FlashPlan {
    pub family: Family,
    /// Exact chip when known (e.g. "esp32s3"), used later to refuse a mismatching target.
    pub chip: Option<String>,
    pub regions: Vec<Region>,
    pub erase: EraseScope,
    pub verify: bool,
    pub reset_after: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum PlanError {
    #[error("the plan has no region to write")]
    Empty,
    #[error("region `{label}` is empty")]
    EmptyRegion { label: String },
    #[error("region `{label}` ends past the 32-bit address space")]
    OutOfAddressSpace { label: String },
    #[error("regions `{first}` and `{second}` overlap")]
    Overlap { first: String, second: String },
}

impl Region {
    pub fn new(address: u32, label: impl Into<String>, data: Vec<u8>) -> Self {
        Self {
            address,
            label: label.into(),
            data,
        }
    }

    /// First address after the region, in u64 so a region ending at 4 GiB can't overflow.
    pub fn end(&self) -> u64 {
        u64::from(self.address) + self.data.len() as u64
    }
}

impl FlashPlan {
    pub fn new(family: Family, regions: Vec<Region>) -> Self {
        Self {
            family,
            chip: None,
            regions,
            erase: EraseScope::Regions,
            verify: true,
            reset_after: true,
        }
    }

    pub fn total_bytes(&self) -> u64 {
        self.regions.iter().map(|r| r.data.len() as u64).sum()
    }

    /// Structural checks that need no device: something to write, no empty region,
    /// nothing past the 32-bit address space, no two regions overlapping.
    pub fn validate(&self) -> Result<(), PlanError> {
        if self.regions.is_empty() {
            return Err(PlanError::Empty);
        }
        for r in &self.regions {
            if r.data.is_empty() {
                return Err(PlanError::EmptyRegion {
                    label: r.label.clone(),
                });
            }
            if r.end() > u64::from(u32::MAX) + 1 {
                return Err(PlanError::OutOfAddressSpace {
                    label: r.label.clone(),
                });
            }
        }
        let mut sorted: Vec<&Region> = self.regions.iter().collect();
        sorted.sort_by_key(|r| r.address);
        for pair in sorted.windows(2) {
            if pair[0].end() > u64::from(pair[1].address) {
                return Err(PlanError::Overlap {
                    first: pair[0].label.clone(),
                    second: pair[1].label.clone(),
                });
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn region(address: u32, label: &str, len: usize) -> Region {
        Region::new(address, label, vec![0xAA; len])
    }

    fn esp_layout() -> Vec<Region> {
        vec![
            region(0x0, "bootloader", 0x5000),
            region(0x8000, "partition-table", 0xC00),
            region(0xD000, "ota-data", 0x2000),
            region(0x1_0000, "app", 0x1_0000),
        ]
    }

    #[test]
    fn total_bytes_sums_every_region() {
        let plan = FlashPlan::new(Family::Esp32, esp_layout());
        assert_eq!(plan.total_bytes(), 0x5000 + 0xC00 + 0x2000 + 0x1_0000);
    }

    #[test]
    fn new_plan_verifies_and_resets_by_default() {
        let plan = FlashPlan::new(Family::Stm32, vec![region(0x0800_0000, "app", 16)]);
        assert!(plan.verify && plan.reset_after);
        assert_eq!(plan.erase, EraseScope::Regions);
        assert_eq!(plan.chip, None);
    }

    #[test]
    fn a_normal_esp_layout_is_valid() {
        assert_eq!(
            FlashPlan::new(Family::Esp32, esp_layout()).validate(),
            Ok(())
        );
    }

    #[test]
    fn adjacent_regions_are_valid() {
        let plan = FlashPlan::new(
            Family::Nrf,
            vec![region(0x0, "a", 0x1000), region(0x1000, "b", 0x1000)],
        );
        assert_eq!(plan.validate(), Ok(()));
    }

    #[test]
    fn rejects_an_empty_plan() {
        assert_eq!(
            FlashPlan::new(Family::Esp32, vec![]).validate(),
            Err(PlanError::Empty)
        );
    }

    #[test]
    fn rejects_an_empty_region() {
        let plan = FlashPlan::new(Family::Esp32, vec![region(0x0, "bootloader", 0)]);
        assert_eq!(
            plan.validate(),
            Err(PlanError::EmptyRegion {
                label: "bootloader".into()
            })
        );
    }

    #[test]
    fn rejects_overlapping_regions_even_when_unsorted() {
        let plan = FlashPlan::new(
            Family::Esp32,
            vec![
                region(0x8000, "partition-table", 0xC00),
                region(0x0, "bootloader", 0x9000),
            ],
        );
        assert_eq!(
            plan.validate(),
            Err(PlanError::Overlap {
                first: "bootloader".into(),
                second: "partition-table".into()
            })
        );
    }

    #[test]
    fn rejects_a_region_past_4_gib() {
        let plan = FlashPlan::new(Family::Stm32, vec![region(0xFFFF_FF00, "tail", 0x200)]);
        assert_eq!(
            plan.validate(),
            Err(PlanError::OutOfAddressSpace {
                label: "tail".into()
            })
        );
    }

    #[test]
    fn a_region_ending_exactly_at_4_gib_is_valid() {
        let plan = FlashPlan::new(Family::Stm32, vec![region(0xFFFF_FF00, "tail", 0x100)]);
        assert_eq!(plan.validate(), Ok(()));
    }
}
