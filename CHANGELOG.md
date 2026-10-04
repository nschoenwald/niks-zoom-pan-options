# Changelog

All notable changes to this project will be documented in this file.

## [14.3.5] - 2026-10-04
- **Touchpad Template Placement Rotation Sensitivity**:
  - Implemented scroll delta accumulation dampening for template placement rotation in Touchpad mode, requiring ~40px of trackpad stroke per 5° rotation step. Prevents high-frequency trackpad wheel event bursts from spinning templates uncontrollably.


## [14.3.4] - 2026-10-03
### Fixed
- **Canvas Zoom Delegation**:
  - `Canvas.prototype._onMouseWheel` override registered via libWrapper now forwards wheel events to `zoom(event)` rather than acting as a dead no-op. This enables external callers, HUD overlays, and companion modules (such as *Nik's DnD5e Tweaks* Template Placement HUD) to trigger canvas zoom reliably.
- **macOS Shift-Scroll & Horizontal Delta Support**:
  - Updated `zoom(event)` to resolve delta from `event.delta ?? (event.deltaY === 0 ? event.deltaX : event.deltaY)`. On macOS, holding Shift converts vertical scrolling into horizontal delta (`deltaX`) while zeroing `deltaY`, which previously caused zoom events to abort immediately.
- **Touchpad Rotation Delta**:
  - In Touchpad mode, rotation now passes `event.delta` rather than raw `deltaY`, ensuring rotation inputs are correctly handled when Shift is held on macOS.
- **Touchpad Template Placement Rotation**:
  - Added support for Foundry V14 Region template placement sessions (`canvas.regions._placementContext`) under Touchpad mode so holding Shift and scrolling rotates the active template preview.