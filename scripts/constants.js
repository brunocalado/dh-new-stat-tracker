/**
 * Module-wide constants.
 * This is the single source of truth for the module ID and all flag/value limits.
 * Import from here — never hardcode the module ID as a string literal elsewhere.
 */

export const MODULE_ID = 'dh-new-stat-tracker';

/** Flag key for the character tracker value stored on each Actor. */
export const FLAG_KEY = 'value';

/** Flag key for the adversary tracker value stored on each Actor. */
export const ADV_FLAG_KEY = 'adversaryValue';

/** Absolute maximum number of pips for character trackers. */
export const MAX_POSSIBLE_VALUE = 15;

/** Absolute maximum number of pips for adversary trackers. */
export const ADV_MAX_POSSIBLE_VALUE = 9;

/**
 * All Font Awesome icon classes available for pip customisation.
 * The first entry is an empty string representing the default (skull) icon.
 */
export const AVAILABLE_ICONS = [
    "",
    "fa-solid fa-shield-halved", "fa-solid fa-skull", "fa-solid fa-dragon", "fa-solid fa-hand-fist",
    "fa-solid fa-map-location-dot", "fa-solid fa-compass", "fa-solid fa-key", "fa-solid fa-eye",
    "fa-solid fa-mountain", "fa-solid fa-ghost", "fa-solid fa-hat-wizard", "fa-solid fa-book", "fa-solid fa-flask",
    "fa-solid fa-bolt", "fa-solid fa-sun", "fa-solid fa-moon", "fa-solid fa-crown", "fa-solid fa-feather", "fa-solid fa-mask",
    "fa-solid fa-hand-holding-heart", "fa-solid fa-music", "fa-solid fa-balance-scale", "fa-solid fa-trophy", "fa-solid fa-gem",
    "fa-solid fa-hammer", "fa-solid fa-leaf", "fa-solid fa-anchor", "fa-solid fa-star", "fa-solid fa-khanda", "fa-solid fa-wand-magic-sparkles",
    "fa-solid fa-scroll", "fa-solid fa-coins", "fa-solid fa-dice", "fa-solid fa-fire", "fa-solid fa-snowflake", "fa-solid fa-droplet",
    "fa-solid fa-wind", "fa-solid fa-cloud-bolt", "fa-solid fa-brain", "fa-solid fa-person-running",
    "fa-solid fa-campground", "fa-solid fa-landmark", "fa-solid fa-biohazard", "fa-solid fa-eye-slash",
    "fa-solid fa-heart-pulse", "fa-solid fa-clover",
    "fa-solid fa-vial", "fa-solid fa-hourglass-half", "fa-solid fa-spider", "fa-solid fa-hand-sparkles", "fa-solid fa-crosshairs",
    "fa-solid fa-explosion", "fa-solid fa-ban", "fa-solid fa-handcuffs", "fa-solid fa-magnifying-glass", "fa-solid fa-mountain-sun",
    "fa-solid fa-wand-magic", "fa-solid fa-user-ninja", "fa-solid fa-shoe-prints", "fa-solid fa-puzzle-piece",
    "fa-solid fa-dungeon", "fa-solid fa-mound", "fa-solid fa-vault", "fa-solid fa-ring", "fa-solid fa-envelope-open-text",
    "fa-solid fa-lightbulb", "fa-solid fa-bullseye", "fa-solid fa-seedling", "fa-solid fa-virus",
    "fa-solid fa-link", "fa-solid fa-gears", "fa-solid fa-user-shield", "fa-solid fa-burst", "fa-solid fa-chess-knight"
];
