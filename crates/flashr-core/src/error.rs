use serde::Serialize;
use thiserror::Error;

use crate::{Family, PlanError};

#[derive(Debug, Error)]
pub enum FlashError {
    #[error("cancelled by the user")]
    Cancelled,
    #[error("target `{0}` not found")]
    TargetNotFound(String),
    #[error("invalid plan: {0}")]
    InvalidPlan(#[from] PlanError),
    #[error("plan is for {plan:?} but the target is {target:?}")]
    FamilyMismatch { plan: Family, target: Family },
    #[error("device error: {0}")]
    Device(String),
}

/// Stable identifiers the UI turns into localized messages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ErrorCode {
    Cancelled,
    TargetNotFound,
    InvalidPlan,
    FamilyMismatch,
    DeviceError,
    AlreadyRunning,
}

/// What the UI receives when something goes wrong: a code to localize, plus the raw
/// detail shown only under "Détails techniques".
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserFacingError {
    pub code: ErrorCode,
    pub technical: String,
}

impl UserFacingError {
    pub fn new(code: ErrorCode, technical: impl Into<String>) -> Self {
        Self {
            code,
            technical: technical.into(),
        }
    }
}

impl From<&FlashError> for UserFacingError {
    fn from(err: &FlashError) -> Self {
        let code = match err {
            FlashError::Cancelled => ErrorCode::Cancelled,
            FlashError::TargetNotFound(_) => ErrorCode::TargetNotFound,
            FlashError::InvalidPlan(_) => ErrorCode::InvalidPlan,
            FlashError::FamilyMismatch { .. } => ErrorCode::FamilyMismatch,
            FlashError::Device(_) => ErrorCode::DeviceError,
        };
        Self {
            code,
            technical: err.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_flash_error_maps_to_a_code() {
        let cases = [
            (FlashError::Cancelled, ErrorCode::Cancelled),
            (
                FlashError::TargetNotFound("x".into()),
                ErrorCode::TargetNotFound,
            ),
            (
                FlashError::InvalidPlan(PlanError::Empty),
                ErrorCode::InvalidPlan,
            ),
            (
                FlashError::FamilyMismatch {
                    plan: Family::Esp32,
                    target: Family::Nrf,
                },
                ErrorCode::FamilyMismatch,
            ),
            (FlashError::Device("timeout".into()), ErrorCode::DeviceError),
        ];
        for (err, code) in cases {
            let ui = UserFacingError::from(&err);
            assert_eq!(ui.code, code);
            assert_eq!(ui.technical, err.to_string());
        }
    }

    #[test]
    fn serializes_code_as_kebab_case() {
        let e = UserFacingError::new(ErrorCode::AlreadyRunning, "busy");
        assert_eq!(
            serde_json::to_value(&e).unwrap(),
            serde_json::json!({ "code": "already-running", "technical": "busy" })
        );
    }
}
