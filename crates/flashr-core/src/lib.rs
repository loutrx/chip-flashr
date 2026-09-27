//! Domain types shared by every Chip Flashr backend and the app shell.

pub mod family;
pub mod plan;

pub use family::Family;
pub use plan::{EraseScope, FlashPlan, PlanError, Region};
