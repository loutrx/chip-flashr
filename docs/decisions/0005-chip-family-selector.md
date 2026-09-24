# 0005 · Always-visible chip family selector, preselected when certain

- Status: Accepted
- Date: 2026-09-24

## Context

Some inputs identify their target unambiguously (ESP-IDF zips, ESP images, most ELF files). Others don't: an Intel HEX or a raw `.bin` could be for an STM32 or an nRF, and two `.hex` files look alike. Guessing wrong means probing the wrong interface, or worse, writing the wrong image.

## Decision

- A **three-way selector (ESP32 · STM32 · nRF)** is always visible on the home screen.
- When detection is **certain**, it's preselected and labelled *"Detected automatically"*.
- When it's **ambiguous**, nothing is selected, the selector is highlighted, a **suggestion** is shown with its reason (e.g. "addresses start at 0x08000000, usually an STM32"), and **Program is disabled** until the user picks.
- Before writing, the connected hardware must **confirm** the family (probe IDCODE/FICR, ESP chip id). A mismatch blocks the operation with an explanation.

## Consequences

- ✅ No silent guess on ambiguous files; one obvious click for the user.
- ✅ The same control teaches non-technical users which family they're dealing with.
- ⚠️ One more visible element on the simplest screen. Kept compact, and it doesn't require action when certain.
