//! Domain types shared by every Chip Flashr backend and the app shell.

pub mod backend;
pub mod error;
pub mod family;
pub mod plan;
pub mod progress;
pub mod target;

pub use backend::FlashBackend;
pub use error::{ErrorCode, FlashError, UserFacingError};
pub use family::Family;
pub use plan::{EraseScope, FlashPlan, PlanError, Region};
pub use progress::{CancelToken, Phase, ProgressEvent, ProgressSink, RecordingSink};
pub use target::{ChipInfo, FlashReport, Target};
