/**
 * Settings, Constants, and Static Definitions
 * Responsible for:
 * 1. Registering settings in Foundry VTT.
 * 2. Managing the Settings Menu (UI).
 * 3. Integrations with System UI (Menu Buttons).
 */

import { MODULE_ID, FLAG_KEY, ADV_FLAG_KEY, MAX_POSSIBLE_VALUE, ADV_MAX_POSSIBLE_VALUE, AVAILABLE_ICONS, CHARACTER_TRACKERS, TRACKER_SETTING_FIELDS } from './constants.js';

// Re-export constants so existing importers that pull from config.js keep working.
export { MODULE_ID, FLAG_KEY, ADV_FLAG_KEY, MAX_POSSIBLE_VALUE, ADV_MAX_POSSIBLE_VALUE, AVAILABLE_ICONS };

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Builds the icon choice list for the <select> in the settings template.
 * @returns {{ value: string, label: string }[]}
 */
function _getIconChoices() {
    return AVAILABLE_ICONS.reduce((acc, icon) => {
        const label = !icon
            ? "Default (Skull)"
            : icon.replace('fa-solid fa-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        acc.push({ value: icon, label });
        return acc;
    }, []);
}

/**
 * Intermediate base Application for a character tracker's complete settings.
 * The module supports up to two character trackers, each backed by its own set of
 * world settings. This class is parameterized by the tracker definition exposed on
 * the concrete subclass via `static TRACKER`; the leaf subclasses (see below) only
 * supply their `id`, window title, and tracker definition.
 */
class CharacterTrackerSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    // Tracker definition ({@link CHARACTER_TRACKERS} entry); overridden by each subclass.
    static TRACKER = null;

    // Keep ApplicationV2 as the merge-chain floor so its built-in DEFAULT_OPTIONS
    // (window.frame, window.positioned, …) are preserved for the subclasses.
    static BASE_APPLICATION = foundry.applications.api.ApplicationV2;

    static DEFAULT_OPTIONS = {
        classes: [MODULE_ID],
        tag: "form",
        window: { resizable: true },
        position: { width: 570, height: 640 }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/settings-menu.hbs` }
    };

    /**
     * The tracker definition this instance edits.
     * @returns {object} A {@link CHARACTER_TRACKERS} entry.
     */
    get tracker() {
        return this.constructor.TRACKER;
    }

    /**
     * Builds the Handlebars context from the current settings of this tracker.
     * Called from ApplicationV2 render lifecycle.
     * @param {object} _options
     * @returns {Promise<object>}
     */
    async _prepareContext(_options) {
        const keys = this.tracker.keys;
        const get = (field) => game.settings.get(MODULE_ID, keys[field]);

        return {
            // Activation
            enabled: get('enabled'),

            // Core Settings
            attributeName: get('attributeName'),
            attributeMax: get('attributeMax'),
            attributeInverted: get('attributeInverted'),
            attributeColor: get('attributeColor'),
            iconColor: get('iconColor'),
            attributeIcon: get('attributeIcon'),

            // Background Settings
            enableCustomBackground: get('enableCustomBackground'),
            customBackgroundColor: get('customBackgroundColor'),

            // Border Settings
            enableCustomBorder: get('enableCustomBorder'),
            customBorderColor: get('customBorderColor'),

            attributeSound: get('attributeSound'),
            attributeVolume: get('attributeVolume'),
            pipClickSound: get('pipClickSound'),
            pipClickVolume: get('pipClickVolume'),

            // Chat Settings
            verbose: get('attributeVerbose'),
            chatImage: get('chatImage'),
            textMax: get('textMax'),
            textDepleted: get('textDepleted'),

            // Rules
            trackerRules: JSON.parse(get('trackerRules') || '[]'),

            // Visibility
            hideFromPlayers: get('hideFromPlayers'),

            // Helpers
            iconChoices: _getIconChoices(),
            maxPossible: MAX_POSSIBLE_VALUE
        };
    }

    /**
     * Attaches non-action DOM listeners after each render.
     * Called from ApplicationV2 render lifecycle.
     * @param {object} context
     * @param {object} options
     */
    _onRender(context, options) {
        // --- TAB SWITCHING LOGIC ---
        const navItems = this.element.querySelectorAll('.tracker-nav .item');
        const tabItems = this.element.querySelectorAll('.tab-content .tab');

        navItems.forEach(nav => {
            nav.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = nav.dataset.tab;
                navItems.forEach(n => n.classList.toggle('active', n.dataset.tab === targetTab));
                tabItems.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
            });
        });

        // --- CUSTOM BACKGROUND TOGGLE ---
        const bgToggle = this.element.querySelector('input[name="enableCustomBackground"]');
        const bgPickerContainer = this.element.querySelector('.custom-bg-picker-container');
        if (bgToggle && bgPickerContainer) {
            const updateBgVisibility = () => bgPickerContainer.classList.toggle('visible', bgToggle.checked);
            updateBgVisibility();
            bgToggle.addEventListener('change', updateBgVisibility);
        }

        // --- CUSTOM BORDER TOGGLE ---
        const borderToggle = this.element.querySelector('input[name="enableCustomBorder"]');
        const borderPickerContainer = this.element.querySelector('.custom-border-picker-container');
        if (borderToggle && borderPickerContainer) {
            const updateBorderVisibility = () => borderPickerContainer.classList.toggle('visible', borderToggle.checked);
            updateBorderVisibility();
            borderToggle.addEventListener('change', updateBorderVisibility);
        }

        // --- FILE PICKERS ---
        // Resolve the active FilePicker implementation so host environments (e.g. Forge)
        // can substitute their own class without breaking this module.
        const FP = foundry.applications.apps.FilePicker.implementation ?? foundry.applications.apps.FilePicker;
        this.element.querySelectorAll('button.file-picker').forEach(btn => {
            btn.addEventListener('click', event => {
                event.preventDefault();
                const target = event.currentTarget.dataset.target;
                const type = event.currentTarget.dataset.type || "image";
                const input = this.element.querySelector(`input[name="${target}"]`);
                new FP({
                    type,
                    current: input.value,
                    callback: path => { input.value = path; }
                }).render(true);
            });
        });

        // --- RANGE DISPLAY (volume sliders) ---
        const alertVolRange = this.element.querySelector('input[name="attributeVolume"]');
        const alertVolDisplay = this.element.querySelector('.volume-display');
        if (alertVolRange && alertVolDisplay) {
            alertVolRange.addEventListener('input', e => { alertVolDisplay.textContent = e.target.value; });
        }

        const pipVolRange = this.element.querySelector('input[name="pipClickVolume"]');
        const pipVolDisplay = this.element.querySelector('.pip-volume-display');
        if (pipVolRange && pipVolDisplay) {
            pipVolRange.addEventListener('input', e => { pipVolDisplay.textContent = e.target.value; });
        }

        // --- RULES TAB ---
        const rulesList = this.element.querySelector('.rules-list');
        const addRuleBtn = this.element.querySelector('.rule-add-btn');

        if (addRuleBtn && rulesList) {
            addRuleBtn.addEventListener('click', () => {
                const ruleId = foundry.utils.randomID();
                const row = document.createElement('div');
                row.classList.add('rule-row');
                row.dataset.ruleId = ruleId;
                row.innerHTML = `
                    <select class="rule-trigger" name="ruleTrigger">
                        <option value="mark">On Mark</option>
                        <option value="unmark">On Unmark</option>
                        <option value="maximum">On Maximum</option>
                        <option value="minimum">On Minimum</option>
                    </select>
                    <select class="rule-target" name="ruleTarget">
                        <option value="hope">Hope Max</option>
                        <option value="hpMax">HP Max</option>
                        <option value="stressMax">Stress Max</option>
                        <option value="scars">Scars</option>
                        <option value="evasion">Evasion</option>
                        <option value="spellcasting">Spellcasting</option>
                    </select>
                    <select class="rule-action" name="ruleAction">
                        <option value="add">Add</option>
                        <option value="remove">Remove</option>
                    </select>
                    <button type="button" class="rule-delete" title="Delete Rule"><i class="fas fa-trash"></i></button>
                `;
                rulesList.appendChild(row);
                row.querySelector('.rule-delete').addEventListener('click', () => row.remove());
            });

            rulesList.querySelectorAll('.rule-delete').forEach(btn => {
                btn.addEventListener('click', () => btn.closest('.rule-row').remove());
            });
        }

        // --- FORM SUBMISSION ---
        this.element.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const keys = this.tracker.keys;

            // Collect rules from dynamically generated rows
            const ruleRows = this.element.querySelectorAll('.rule-row');
            const rules = Array.from(ruleRows).map(row => ({
                id: row.dataset.ruleId,
                trigger: row.querySelector('.rule-trigger').value,
                target: row.querySelector('.rule-target').value,
                action: row.querySelector('.rule-action').value
            }));

            const values = {
                enabled: formData.get('enabled') === 'on',

                attributeName: formData.get('attributeName'),
                attributeMax: parseInt(formData.get('attributeMax')),
                attributeInverted: formData.get('attributeInverted') === 'on',
                attributeColor: formData.get('attributeColor'),
                iconColor: formData.get('iconColor'),
                attributeIcon: formData.get('attributeIcon'),

                enableCustomBackground: formData.get('enableCustomBackground') === 'on',
                customBackgroundColor: formData.get('customBackgroundColor'),
                enableCustomBorder: formData.get('enableCustomBorder') === 'on',
                customBorderColor: formData.get('customBorderColor'),

                attributeSound: formData.get('attributeSound'),
                attributeVolume: parseFloat(formData.get('attributeVolume')),
                pipClickSound: formData.get('pipClickSound'),
                pipClickVolume: parseFloat(formData.get('pipClickVolume')),

                attributeVerbose: formData.get('verbose') === 'on',
                chatImage: formData.get('chatImage'),
                textMax: formData.get('textMax'),
                textDepleted: formData.get('textDepleted'),

                trackerRules: JSON.stringify(rules),
                hideFromPlayers: formData.get('hideFromPlayers') === 'on'
            };

            // Written in parallel so the changed settings' onChange calls (which refresh the open
            // sheets) arrive together and their debounce collapses them into one refresh, instead
            // of one per server round trip.
            await Promise.all(Object.entries(values).map(([field, value]) => game.settings.set(MODULE_ID, keys[field], value)));

            this.close();
        });
    }
}

/**
 * Leaf settings Application for character tracker 1 (legacy keys, enabled by default).
 */
class Tracker1SettingsApp extends CharacterTrackerSettingsApp {
    static TRACKER = CHARACTER_TRACKERS[0];

    static DEFAULT_OPTIONS = {
        id: "tracker-settings-app",
        window: { title: "Tracker 1 Configuration" }
    };
}

/**
 * Leaf settings Application for character tracker 2 (t2-prefixed keys, disabled by default).
 */
class Tracker2SettingsApp extends CharacterTrackerSettingsApp {
    static TRACKER = CHARACTER_TRACKERS[1];

    static DEFAULT_OPTIONS = {
        id: "tracker-2-settings-app",
        window: { title: "Tracker 2 Configuration" }
    };
}

/**
 * Menu Application for adversary tracker settings (Identity + Mechanics + Rules).
 */
class AdversaryTrackerSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static BASE_APPLICATION = foundry.applications.api.ApplicationV2;

    static DEFAULT_OPTIONS = {
        id: "adversary-tracker-settings-app",
        classes: [MODULE_ID],
        tag: "form",
        window: { title: "Adversary Tracker Configuration", resizable: true },
        position: { width: 570, height: 500 }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/adversary-settings-menu.hbs` }
    };

    /**
     * Builds the Handlebars context from current adversary settings.
     * Called from ApplicationV2 render lifecycle.
     * @param {object} _options
     * @returns {Promise<object>}
     */
    async _prepareContext(_options) {
        return {
            attributeName: game.settings.get(MODULE_ID, 'advAttributeName'),
            attributeMax: game.settings.get(MODULE_ID, 'advAttributeMax'),
            attributeInverted: game.settings.get(MODULE_ID, 'advAttributeInverted'),
            attributeColor: game.settings.get(MODULE_ID, 'advAttributeColor'),
            iconColor: game.settings.get(MODULE_ID, 'advIconColor'),
            attributeIcon: game.settings.get(MODULE_ID, 'advAttributeIcon'),
            enableCustomBackground: game.settings.get(MODULE_ID, 'advEnableCustomBackground'),
            customBackgroundColor: game.settings.get(MODULE_ID, 'advCustomBackgroundColor'),
            enableCustomBorder: game.settings.get(MODULE_ID, 'advEnableCustomBorder'),
            customBorderColor: game.settings.get(MODULE_ID, 'advCustomBorderColor'),
            advTrackerRules: JSON.parse(game.settings.get(MODULE_ID, 'advTrackerRules') || '[]'),
            hideAdversaryTracker: game.settings.get(MODULE_ID, 'hideAdversaryTracker'),
            iconChoices: _getIconChoices(),
            maxPossible: ADV_MAX_POSSIBLE_VALUE
        };
    }

    /**
     * Attaches non-action DOM listeners after each render.
     * Called from ApplicationV2 render lifecycle.
     * @param {object} context
     * @param {object} options
     */
    _onRender(context, options) {
        // --- TAB SWITCHING LOGIC ---
        const navItems = this.element.querySelectorAll('.tracker-nav .item');
        const tabItems = this.element.querySelectorAll('.tab-content .tab');

        navItems.forEach(nav => {
            nav.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = nav.dataset.tab;
                navItems.forEach(n => n.classList.toggle('active', n.dataset.tab === targetTab));
                tabItems.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
            });
        });

        // --- CUSTOM BACKGROUND TOGGLE ---
        const bgToggle = this.element.querySelector('input[name="enableCustomBackground"]');
        const bgPickerContainer = this.element.querySelector('.custom-bg-picker-container');
        if (bgToggle && bgPickerContainer) {
            const updateBgVisibility = () => bgPickerContainer.classList.toggle('visible', bgToggle.checked);
            updateBgVisibility();
            bgToggle.addEventListener('change', updateBgVisibility);
        }

        // --- CUSTOM BORDER TOGGLE ---
        const borderToggle = this.element.querySelector('input[name="enableCustomBorder"]');
        const borderPickerContainer = this.element.querySelector('.custom-border-picker-container');
        if (borderToggle && borderPickerContainer) {
            const updateBorderVisibility = () => borderPickerContainer.classList.toggle('visible', borderToggle.checked);
            updateBorderVisibility();
            borderToggle.addEventListener('change', updateBorderVisibility);
        }

        // --- RULES TAB ---
        const rulesList = this.element.querySelector('.rules-list');
        const addRuleBtn = this.element.querySelector('.rule-add-btn');

        if (addRuleBtn && rulesList) {
            addRuleBtn.addEventListener('click', () => {
                const ruleId = foundry.utils.randomID();
                const row = document.createElement('div');
                row.classList.add('rule-row');
                row.dataset.ruleId = ruleId;
                row.innerHTML = `
                    <select class="rule-trigger" name="ruleTrigger">
                        <option value="mark">On Mark</option>
                        <option value="unmark">On Unmark</option>
                        <option value="maximum">On Maximum</option>
                        <option value="minimum">On Minimum</option>
                    </select>
                    <select class="rule-target" name="ruleTarget">
                        <option value="stressMax">Stress Max</option>
                        <option value="hpMax">HP Max</option>
                        <option value="attackBonus">Attack Bonus</option>
                        <option value="critical">Critical</option>
                        <option value="physicalDmg">Physical Damage</option>
                        <option value="magicalDmg">Magical Damage</option>
                        <option value="majorThreshold">Major Threshold</option>
                        <option value="severeThreshold">Severe Threshold</option>
                    </select>
                    <select class="rule-action" name="ruleAction">
                        <option value="add">Add</option>
                        <option value="remove">Remove</option>
                    </select>
                    <button type="button" class="rule-delete" title="Delete Rule"><i class="fas fa-trash"></i></button>
                `;
                rulesList.appendChild(row);
                row.querySelector('.rule-delete').addEventListener('click', () => row.remove());
            });

            rulesList.querySelectorAll('.rule-delete').forEach(btn => {
                btn.addEventListener('click', () => btn.closest('.rule-row').remove());
            });
        }

        // --- FORM SUBMISSION ---
        this.element.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            const ruleRows = this.element.querySelectorAll('.rule-row');
            const rules = Array.from(ruleRows).map(row => ({
                id: row.dataset.ruleId,
                trigger: row.querySelector('.rule-trigger').value,
                target: row.querySelector('.rule-target').value,
                action: row.querySelector('.rule-action').value
            }));

            const values = {
                advAttributeName: formData.get('attributeName'),
                advAttributeMax: Math.min(ADV_MAX_POSSIBLE_VALUE, parseInt(formData.get('attributeMax'))),
                advAttributeInverted: formData.get('attributeInverted') === 'on',
                advAttributeColor: formData.get('attributeColor'),
                advIconColor: formData.get('iconColor'),
                advAttributeIcon: formData.get('attributeIcon'),
                advEnableCustomBackground: formData.get('enableCustomBackground') === 'on',
                advCustomBackgroundColor: formData.get('customBackgroundColor'),
                advEnableCustomBorder: formData.get('enableCustomBorder') === 'on',
                advCustomBorderColor: formData.get('customBorderColor'),
                hideAdversaryTracker: formData.get('hideAdversaryTracker') === 'on',
                advTrackerRules: JSON.stringify(rules)
            };

            // In parallel, so the onChange refreshes arrive together (see the character tracker form).
            await Promise.all(Object.entries(values).map(([key, value]) => game.settings.set(MODULE_ID, key, value)));

            this.close();
        });
    }
}

/**
 * Registers the "Tracker Manager" button in the Daggerheart system sidebar menu.
 */
export function registerDaggerheartMenuButton() {
    // DaggerheartMenu is an ApplicationV2, so the hook receives an HTMLElement.
    Hooks.on("renderDaggerheartMenu", (app, html, data) => {

        const myButton = document.createElement("button");
        myButton.type = "button";
        myButton.innerHTML = `<i class="fas fa-tasks"></i> Tracker Manager`;
        myButton.classList.add("dh-custom-btn", "dh-new-stat-tracker-menu-btn");

        myButton.onclick = () => {
            if (window.DHStatTracker) {
                window.DHStatTracker.openManager();
            } else {
                ui.notifications.error("Stat Tracker module not fully initialized.");
            }
        };

        const fieldset = html.querySelector("fieldset");
        if (fieldset) {
            const newFieldset = document.createElement("fieldset");
            const legend = document.createElement("legend");
            legend.innerText = "Custom Stat Tracker";
            newFieldset.appendChild(legend);
            newFieldset.appendChild(myButton);
            fieldset.after(newFieldset);
        } else {
            html.appendChild(myButton);
        }
    });
}

/**
 * Registers all module settings. Every setting that changes what a sheet shows refreshes the
 * open sheets through its onChange, the settings windows' saves included.
 * Called during the `init` hook.
 * @param {Function} refreshCallback - Called whenever a visual setting changes so all open sheets re-render.
 */
export function registerModuleSettings(refreshCallback) {
    // --- CHARACTER TRACKER SETTINGS (hidden from the standard settings menu) ---
    // The same field list is registered once per tracker, mapped to that tracker's
    // concrete keys. Tracker 2 overrides a few defaults (notably `enabled: false`).
    for (const tracker of CHARACTER_TRACKERS) {
        for (const [field, type, defaultValue] of TRACKER_SETTING_FIELDS) {
            const value = field in tracker.defaults ? tracker.defaults[field] : defaultValue;
            game.settings.register(MODULE_ID, tracker.keys[field], {
                scope: 'world',
                config: false,
                type,
                default: value,
                onChange: refreshCallback
            });
        }
    }

    // --- ADVERSARY SETTINGS (hidden from the standard settings menu) ---
    const advHiddenSettings = [
        ['advAttributeName', String, 'Tracker'],
        ['advAttributeMax', Number, 6],
        ['advAttributeInverted', Boolean, false],
        ['advAttributeIcon', String, 'fa-solid fa-skull'],
        ['advAttributeColor', String, '#e54e4e'],
        ['advIconColor', String, '#e54e4e'],
        ['advEnableCustomBackground', Boolean, false],
        ['advCustomBackgroundColor', String, '#18162e'],
        ['advEnableCustomBorder', Boolean, false],
        ['advCustomBorderColor', String, '#f3c267'],
        ['advTrackerRules', String, '[]']
    ];

    advHiddenSettings.forEach(([key, type, defaultValue]) => {
        game.settings.register(MODULE_ID, key, {
            scope: 'world',
            config: false,
            type,
            default: defaultValue,
            onChange: refreshCallback
        });
    });

    // --- VISIBLE SETTINGS (shown in the standard settings menu) ---
    game.settings.register(MODULE_ID, 'gmOnly', {
        name: 'GM Only Mode',
        hint: 'If checked, only the GM can modify tracker values directly on the sheet.',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        onChange: refreshCallback
    });

    game.settings.register(MODULE_ID, 'hideAdversaryTracker', {
        name: 'Hide Adversary Tracker',
        hint: 'If checked, the tracker will not be displayed on adversary sheets for anyone, including the GM.',
        scope: 'world',
        config: false,
        type: Boolean,
        default: false,
        onChange: refreshCallback
    });

    // --- MENU BUTTONS ---
    game.settings.registerMenu(MODULE_ID, 'trackerSettingsMenu', {
        name: 'Tracker 1 Configuration',
        label: 'Open Tracker 1 Settings',
        hint: 'Configure the first character tracker: activation, attributes, visuals, sounds, and chat notifications.',
        icon: 'fas fa-cogs',
        type: Tracker1SettingsApp,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, 'tracker2SettingsMenu', {
        name: 'Tracker 2 Configuration',
        label: 'Open Tracker 2 Settings',
        hint: 'Configure the optional second character tracker (disabled by default).',
        icon: 'fas fa-cogs',
        type: Tracker2SettingsApp,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, 'advTrackerSettingsMenu', {
        name: 'Adversary Configuration',
        label: 'Open Adversary Tracker Settings',
        hint: 'Configure adversary tracker visuals and mechanics.',
        icon: 'fas fa-cogs',
        type: AdversaryTrackerSettingsApp,
        restricted: true
    });
}
