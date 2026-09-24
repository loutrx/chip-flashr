# 0006 · Instructions panel rendered from a README next to the executable

- Status: Accepted
- Date: 2026-09-24

## Context

Customers often need device-specific steps (open a cover, which connector, power off first…). Sending a separate PDF means one more window to juggle, and it gets lost.

## Decision

- If a `LISEZMOI.md`, `README.md`, `INSTRUCTIONS.md` (or `.txt`) is found **inside the selected firmware zip**, or otherwise **next to the executable**, it's rendered in a right-hand panel.
- The panel **reloads live** when the file changes, and can be collapsed to a side rail.
- Rendering is **sanitized CommonMark**: headings, lists, emphasis, code, quotes (styled as warnings), tables and **local images only**. **No raw HTML, no scripts, no remote resources, no links that run anything**: external links open in the system browser after a confirmation.

## Consequences

- ✅ Instructions sit beside the Program button, exactly where they're needed.
- ✅ Suppliers write plain Markdown, which is easy to version with the firmware.
- ✅ A malicious or careless README can't execute code or phone home.
- ⚠️ Limited formatting by design (no custom HTML layouts).
