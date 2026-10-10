# Changelog

All notable changes to this project will be documented in this file.

## [14.5.1] - 2026-10-10
### Fixed
- **Canvas Reference Safety on Load**:
  - Fixed a `ReferenceError: canvas is not defined` error occurring on initial world load or early window resize before Foundry initializes the game canvas.

## [14.5.0] - 2026-10-06
### Added
- **Horizontal Scroll Behavior Setting (Mouse Mode)**:
  - Added a client setting `Horizontal scroll behavior (Mouse mode)` (`mouse-horizontal-scroll`) with choices for `Ignore horizontal scroll` (default), `Pan canvas horizontally`, and `Zoom canvas (legacy)`.
  - Fixes an issue where horizontal mouse scroll wheels (such as the Logitech MX Master 3/4 horizontal thumb wheel) or horizontal tilt wheels zoomed the canvas when in Mouse mode.

## [14.4.0] - 2026-10-04
### Fixed
- **Initial Scene Zoom Limit Null Safety**:
  - Fixed an issue where `canvas.scene.initial.scale` being null or undefined (the default for scenes without explicit initial views) caused `minZoom` to evaluate to `0` or `NaN`. Clamping is now applied only when an initial scale is explicitly configured.
- **Touchpad Token Placement Rotation**:
  - Expanded touchpad placement rotation dampening to support Foundry V14 token placement (`canvas.tokens._placementContext`) alongside region template placement. Previously, rotating a placed token on a trackpad fell through to canvas panning.
- **Alternative Mode Trackpad Pinch-to-Zoom**:
  - Fixed pinch gestures falling through to canvas panning in Alternative mode by handling `event.ctrlKey` pinch gestures for both Touchpad and Alternative modes.
- **Alternative Mode Browser Navigation Prevention**:
  - Extended `overscrollBehaviorX = 'none'` to Alternative mode to prevent trackpad horizontal swipes from triggering native browser back/forward history navigation.
- **Stage Event Listener Accumulation**:
  - Prevented duplicate `mousedown` and `mouseup` listener registration on `canvas.stage` across repeated scene transitions.
- **Federated Events & Null Safety for Middle-Click Drag**:
  - Updated middle-mouse button detection to support PixiJS FederatedPointerEvents directly (`mouseDownEvent.button`) with fallbacks, and added guards against uninitialized `canvas.mouseInteractionManager`.
- **Keyboard Modifier Cross-Version Compatibility**:
  - Safely resolved `MODIFIER_KEYS` across Foundry V13 and V14 environments and incorporated `event.shiftKey` / `event.altKey` fallbacks.
- **Viewport Resize Zoom Bounds Sync**:
  - Added canvas resize listening so min/max zoom scale boundaries recalculate when the browser window or viewport changes.

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