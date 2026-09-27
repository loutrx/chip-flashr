use crate::{
    CancelToken, ChipInfo, EraseScope, Family, FlashError, FlashPlan, FlashReport, ProgressSink,
    Target,
};

/// One implementation per transport family (mock, espflash, probe-rs, DFU, Nordic tools).
/// Methods block: the app runs them on a worker thread.
pub trait FlashBackend: Send + Sync {
    /// Chip families this backend can program.
    fn families(&self) -> &'static [Family];

    /// Boards / probes currently reachable.
    fn discover(&self) -> Result<Vec<Target>, FlashError>;

    /// Connect and read the chip identity.
    fn identify(&self, target: &Target) -> Result<ChipInfo, FlashError>;

    /// Execute a plan: connect → erase → write each region → verify → reset.
    /// Must check `cancel` between blocks and return `FlashError::Cancelled` promptly.
    fn flash(
        &self,
        target: &Target,
        plan: &FlashPlan,
        progress: &dyn ProgressSink,
        cancel: &CancelToken,
    ) -> Result<FlashReport, FlashError>;

    fn erase(
        &self,
        target: &Target,
        scope: EraseScope,
        progress: &dyn ProgressSink,
    ) -> Result<(), FlashError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    // Compile-time check: the app stores backends as `Arc<dyn FlashBackend>`.
    #[allow(dead_code)]
    fn assert_object_safe(_: &dyn FlashBackend) {}
}
