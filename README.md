# Nik's Zoom / Pan Options

Adds touchpad and scroll wheel pan and zoom controls, along with other canvas navigation options for Foundry VTT.

## Features

- **Pan/Zoom Modes**:
  - **Mouse**: Standard Foundry controls (wheel to zoom, Shift/Ctrl + wheel to rotate), with configurable horizontal scroll handling (ignore by default or pan horizontally for mouse thumb wheels like Logitech MX Master).
  - **Touchpad**: Natural two-finger panning, two-finger pinch or Ctrl+scroll to zoom, Shift + scroll to rotate with trackpad dampening.
  - **Alternative**: Pan with drag, wheel, or Shift+wheel; zoom with pinch or Ctrl+wheel; rotate with Alt + Shift + wheel.
- **Horizontal Scroll Behavior**: In Mouse mode, configure horizontal scrolling (e.g., Logitech MX Master thumb wheels or tilt wheels) to ignore (default), pan the canvas horizontally, or zoom.
- **Placement Rotation Dampening**: Smooth 5° rotation steps for template and token placement workflows in Touchpad mode, preventing high-frequency trackpad bursts from spinning previews.
- **Middle-Mouse Drag Pan**: Middle-click drag to pan the canvas just like right-click drag, while preventing unwanted browser autoscroll overlay icons. Also works while drawing a region, drawing, wall or other shape, without interrupting it.
- **Custom Min/Max Zoom Limits**: Configurable overrides for scene zoom scale limits with dynamic viewport resize synchronization.
- **Keybinding Toggles**: Easily switch between Mouse, Touchpad, and Alternative modes on the fly.
- **First-Time Setup Prompt**: On first load, choose Mouse or Touchpad and settings are tuned accordingly (closing the prompt asks again next time).

---

## Compatibility

- **Foundry VTT**: V13 – V14
- **System**: System-agnostic
- **Dependency**: Requires [libWrapper](https://foundryvtt.com/packages/lib-wrapper)

---

## Languages

🇬🇧 English · 🇩🇪 Deutsch · 🇫🇷 Français · 🇯🇵 日本語

Translations into other languages by native speakers are welcome as an issue or pull request.

---

## Modules by Nik

### 🧩 Nik's Tweaks
* **[Nik's Foundry Tweaks](https://github.com/nschoenwald/niks-foundry-tweaks)** – System-independent quality-of-life tweaks and the shared settings dashboard of Nik's Tweaks modules.

### 🎲 D&D 5e Specific
* **[Nik's DnD5e Tweaks](https://github.com/nschoenwald/niks-dnd5e-tweaks)** – Consolidated collection of quality-of-life enhancements and combat automation tweaks for DnD5e.

### ⚔️ Combat & Token Tools
* **[Nik's Action HUD](https://github.com/nschoenwald/niks-action-hud)** – Sleek, modern canvas-docked Action HUD for quick access to attacks, spells, inventory, and utility rolls.
* **[Nik's Effects Panel](https://github.com/nschoenwald/niks-effects-panel)** – Floating panel next to the sidebar that shows the selected token's active effects, to check, disable or remove them without opening the character sheet.
* **[Nik's Token Tags](https://github.com/nschoenwald/niks-token-tags)** – Automatically numbers duplicate combatant NPCs (A, B, C…) with color-coded letter overlays.
* **[Nik's Shared NPC Initiative](https://github.com/nschoenwald/niks-shared-npc-initiative)** – Groups NPCs of the same type in combat so they share a single initiative roll.
* **[Nik's Movement Control](https://github.com/nschoenwald/niks-movement-control)** – GM controls to toggle player movement and automatically restrict/allow movement on combat start and end.
* **[Nik's Token Motion](https://github.com/nschoenwald/niks-token-motion)** – Tokens hop square by square like miniatures, lift and set down like chess pieces, or glide smoothly, and long moves no longer crawl across the map.
* **[Nik's Tiny Change Logs](https://github.com/nschoenwald/niks-tiny-changelogs)** – Compact, single-line chat messages logging token HP and Temp HP changes.

### 🎨 Visuals & Display
* **[Nik's Dynamic Roll Area](https://github.com/nschoenwald/niks-dynamic-roll-area)** – Dynamically restricts Dice So Nice 3D dice rolling area to exclude the sidebar / chat log across all screen resolutions and window sizes.

### ⚙️ Utilities & System Management
* **[Nik's Settings Locks](https://github.com/nschoenwald/niks-settings-locks)** – Soft-lock and hard-lock client settings and keybindings across all connected players.
* **[Nik's Compendium Search Tweaks](https://github.com/nschoenwald/niks-compendium-search-tweaks)** – Configure which compendium packs are included or excluded from native sidebar search.
* **[Nik's Copy Environment](https://github.com/nschoenwald/niks-copy-environment)** – Copy the list of systems, modules, and versions, and export/import game and player settings.
* **[Nik's Show & Tell](https://github.com/nschoenwald/niks-show-and-tell)** – Share popout images to chat and paste image files directly into chat messages.
* **[Nik's Zoom / Pan Options](https://github.com/nschoenwald/niks-zoom-pan-options)** – Touchpad and scroll wheel pan/zoom controls and canvas navigation enhancements.
* **[Nik's Scene Transformations](https://github.com/nschoenwald/niks-scene-transformations)** – Rotate scenes or add playable space around them, with tokens, walls, lights, tiles and regions moved along so everything stays in place.
* **[Nik's Wall Height](https://github.com/nschoenwald/niks-wall-height)** – Give walls a bottom and top elevation, so tokens, lights and sounds above or below a wall ignore it.
* **[Nik's Scene Defaults](https://github.com/nschoenwald/niks-scene-defaults)** – Set your own defaults for new scenes (grid, vision, fog, lighting, background and more), so you don't have to change them on every scene.
