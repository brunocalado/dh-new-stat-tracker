# 0.1.2

- [Removed] `assets/chat-messages/skull.webp` (AI-generated image) and its use as the default **Chat Card Background**. The setting now defaults to empty (no background image); users may still pick their own image via the file picker in the Chat tab of the settings menu.


# 0.1.1

- [Added] Support for a **second character tracker**. Up to two independent trackers can now be shown on a character sheet, stacked one below the other (Tracker 1 on top).
- [Added] **Enable this Tracker** toggle in each tracker's configuration (Identity tab), allowing any tracker to be fully disabled. Tracker 1 is enabled by default; Tracker 2 is disabled by default.
- [Added] New **Tracker 2 Configuration** settings menu, with the same options as Tracker 1 (identity, mechanics, audio, chat, and rules). Each tracker keeps its own name, icon, colors, max value, sounds, chat alerts, visibility, and automation rules.
- [Added] `DHStatTracker.updateActor()` now accepts an optional `tracker` property (`1` or `2`) to choose which tracker to modify. Defaults to Tracker 1.
- [Changed] **Tracker Status** (Tracker Manager) now lists one control row per enabled tracker for each character. Value, max modifier, player visibility, and GM visibility are managed independently per tracker.
- [Changed] Player/GM visibility flags and the per-actor max modifier are now stored per tracker.
- [Removed] Support for unofficial character sheets (DaggerheartPlus and Sleek UI), including the `renderActorSheet` fallback hook and their dedicated layouts/styles. Only the official Daggerheart character and adversary sheets are supported.
- [Note] Existing worlds are unaffected: Tracker 1 keeps its original settings and actor flags, and remains enabled.
- https://github.com/brunocalado/dh-new-stat-tracker/issues/1

# 0.1.0

- v14 only
- [Changed] Refactored codebase for v14 ApplicationV2 compliance and CSS leak prevention.
- [Added] `scripts/constants.js` — single source of truth for module ID and limits (per CLAUDE.md §1).
- [Changed] CSS split into 5 files (base, injection, settings-app, status-app, chat-card) for easier maintenance.
- [Fixed] All ApplicationV2 classes now have `BASE_APPLICATION` and `classes: [MODULE_ID]` — prevents CSS leaks and ensures proper scoping.
- [Fixed] CSS now properly scoped under `.dh-new-stat-tracker` — respects user themes and dark mode.
- [Changed] CSS custom properties prefixed with module ID (`--dh-new-stat-tracker-*`) to prevent collisions.
- [Changed] Hardcoded colors replaced with Foundry CSS variables where applicable (theme compliance).
- [Fixed] FilePicker instantiation corrected to support host environments (Forge, etc).
- [Fixed] `renderActorSheet` hook no longer uses jQuery — now vanilla DOM API.

# 0.0.9

- [Changed] Tracker Manager: "GM Off" is now a separate independent button — the GM can hide their own view of a tracker without affecting the player visibility cycle (Inherit → Visible → Hidden).

# 0.0.8

- [Added] Tracker Manager: visibility button now shows a text label alongside its icon for clarity.
- [Added] Tracker Manager: new "GM Off" visibility state (`gm-hidden`) — hides the tracker bar from the GM's sheet view for a specific character without affecting player visibility.
- [Changed] Tracker Manager: window width increased to avoid label word-wrap.
- Rules: Evasion and Spellcasting
- Fix: old data don't cause problem anymore