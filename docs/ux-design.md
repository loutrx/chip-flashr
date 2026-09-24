# UX & design

> Status: **first design pass validated** (M0). Mockups are static; behaviour is described in the [user guide](user-guide.md) and [architecture](architecture.md#application-states).

## Principles

1. **One screen, one decision.** In Simple mode, the only thing to do is press **Program**, and everything else is already decided or clearly asked.
2. **Never a dead end.** Every problem screen says what happened, why, and what to do next, with the official link when something must be installed.
3. **Ask only what can't be detected.** The chip family is preselected when detection is certain. It becomes a required choice, with a suggestion, only when it's ambiguous.
4. **The customer's instructions live in the app.** A README next to the exe is rendered on the right and follows edits live.
5. **Neutral and friendly.** No vendor branding. Warm greys, black and cream, soft "clay" buttons that feel pressable, small motion that respects *reduce motion*.

## Screen map

```mermaid
flowchart TD
    start(["Start"]) --> scan{"Firmwares found?"}
    scan -- none --> S10["10 · No firmware"]
    scan -- several --> S02["02 · Firmware list"]
    scan -- one --> S01["01 · Home: package ready"]
    S02 --> S01
    S01 -- "ambiguous family" --> S03["03 · Choose the chip"]
    S03 --> S01
    S01 -- "package broken" --> S11["11 · Incomplete package"]
    S01 -- "no board" --> S04["04 · Waiting for the board"]
    S04 -- "driver missing" --> S08["08 · Missing USB driver"]
    S04 -- "tool missing / chip locked" --> S09["09 · External tool required"]
    S08 --> S04
    S09 --> S04
    S04 --> S01
    S01 -- Program --> S05["05 · Programming"]
    S05 --> S06["06 · Success"]
    S05 --> S07["07 · Failure"]
    S07 -- Retry --> S05
    S06 -- "another board" --> S05
    S01 -. "Expert" .-> S12["12 · Expert mode"]
    S12 -.-> S13["13 · Create a package"]
    S01 -. "settings" .-> S14["14 · Settings"]
```

## Mockups

UI copy is in French in these mockups; the app ships in French and English.

| | |
|---|---|
| <img src="assets/screens/01-home.jpg" alt="Home, package ready" width="420"><br/><sub>01 · Home: package ready</sub> | <img src="assets/screens/02-firmware-list.jpg" alt="Firmware list" width="420"><br/><sub>02 · Several firmwares found</sub> |
| <img src="assets/screens/03-choose-chip.jpg" alt="Choose the chip for an ambiguous .hex" width="420"><br/><sub>03 · Ambiguous .hex: choose the chip</sub> | <img src="assets/screens/04-waiting-for-board.jpg" alt="Waiting for the board" width="420"><br/><sub>04 · Waiting for the board</sub> |
| <img src="assets/screens/05-flashing.jpg" alt="Programming in progress" width="420"><br/><sub>05 · Programming</sub> | <img src="assets/screens/06-success.jpg" alt="Success" width="420"><br/><sub>06 · Success</sub> |
| <img src="assets/screens/07-failure.jpg" alt="Failure" width="420"><br/><sub>07 · Failure, causes and report</sub> | <img src="assets/screens/08-missing-driver.jpg" alt="Missing USB driver" width="420"><br/><sub>08 · Missing USB driver</sub> |
| <img src="assets/screens/09-nordic-external-tool.jpg" alt="Nordic external tool required" width="420"><br/><sub>09 · Nordic: external tool required</sub> | <img src="assets/screens/10-no-firmware.jpg" alt="No firmware found" width="420"><br/><sub>10 · No firmware found</sub> |
| <img src="assets/screens/11-incomplete-package.jpg" alt="Incomplete package" width="420"><br/><sub>11 · Incomplete package</sub> | <img src="assets/screens/12-expert-mode.jpg" alt="Expert mode" width="420"><br/><sub>12 · Expert mode</sub> |
| <img src="assets/screens/13-create-package.jpg" alt="Create a package" width="420"><br/><sub>13 · Create a package</sub> | <img src="assets/screens/14-settings.jpg" alt="Settings" width="420"><br/><sub>14 · Settings and watched folders</sub> |
| <img src="assets/screens/15-dark-theme.jpg" alt="Dark theme" width="420"><br/><sub>15 · Dark theme (STM32)</sub> | |

## Visual language

| Token | Light | Dark | Use |
|---|---|---|---|
| Ground | `#E3E1DC` | `#151412` | Window background (warm grey) |
| Surface | `#FBF8F1` | `#1F1D1A` | Cards, panels (cream) |
| Ink | `#1B1A18` | `#F0EADD` | Text, primary button |
| Selection | `#EEE4D0` | `#3A3329` | Selected chip family, highlights |
| Success / Warning / Error | `#2C7550` · `#945800` · `#B0281F` | `#6CC794` · `#E8AD55` · `#F08A7E` | Status only, always paired with an icon and text |

- **Type:** Bricolage Grotesque (titles), Instrument Sans (UI text), JetBrains Mono (addresses, file names, logs).
- **Clay buttons:** soft outer shadow + inner highlight at rest; lift on hover, sink on press. The selected chip family looks *pressed in*.
- **Motion:** breathing status dots, striped progress bar, pop-in success check, all disabled under `prefers-reduced-motion`.
- **Accessibility:** real buttons and labels, 4.5:1 text contrast, colour never the only signal, 44 px minimum targets on primary actions.

## Next design pass (planned)

User tests with non-technical people · first-launch onboarding · choosing between several connected boards · confirmation dialogs (full erase, Nordic recover) · production mode (flash in series) · English copy lengths · app icon.
