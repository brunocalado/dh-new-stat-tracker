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