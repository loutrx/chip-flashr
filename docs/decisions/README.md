# Architecture Decision Records

Short notes explaining **why** things are the way they are. Each one has a context, the decision and its consequences. When a decision changes, a new record supersedes the old one instead of silently editing it.

| # | Decision | Status |
|---|---|---|
| [0001](0001-rust-and-tauri.md) | Build with Rust + Tauri 2 | Accepted |
| [0002](0002-read-standard-build-outputs.md) | Read standard build outputs instead of requiring a custom manifest | Accepted |
| [0003](0003-probe-rs-first.md) | probe-rs first for STM32 and Nordic, vendor tools as fallback | Accepted |
| [0004](0004-single-executable-and-config.md) | Single executable; config in the OS folder, portable override | Accepted |
| [0005](0005-chip-family-selector.md) | Always-visible chip family selector, preselected when certain | Accepted |
| [0006](0006-instructions-panel.md) | Instructions panel rendered from a README next to the executable | Accepted |

Template:

```markdown
# NNNN · Title
- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
## Decision
## Consequences
```
