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
    // Static callback to trigger a sheet refresh after saving. Shared by both subclasses.
    static onSaveCallback = null;

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
            const set = (field, value) => game.settings.set(MODULE_ID, keys[field], value);

            await set('enabled', formData.get('enabled') === 'on');

            await set('attributeName', formData.get('attributeName'));
            await set('attributeMax', parseInt(formData.get('attributeMax')));
            await set('attributeInverted', formData.get('attributeInverted') === 'on');
            await set('attributeColor', formData.get('attributeColor'));
            await set('iconColor', formData.get('iconColor'));
            await set('attributeIcon', formData.get('attributeIcon'));

            await set('enableCustomBackground', formData.get('enableCustomBackground') === 'on');
            await set('customBackgroundColor', formData.get('customBackgroundColor'));
            await set('enableCustomBorder', formData.get('enableCustomBorder') === 'on');
            await set('customBorderColor', formData.get('customBorderColor'));

            await set('attributeSound', formData.get('attributeSound'));
            await set('attributeVolume', parseFloat(formData.get('attributeVolume')));
            await set('pipClickSound', formData.get('pipClickSound'));
            await set('pipClickVolume', parseFloat(formData.get('pipClickVolume')));

            await set('attributeVerbose', formData.get('verbose') === 'on');
            await set('chatImage', formData.get('chatImage'));
            await set('textMax', formData.get('textMax'));
            await set('textDepleted', formData.get('textDepleted'));

            // Collect rules from dynamically generated rows
            const ruleRows = this.element.querySelectorAll('.rule-row');
            const rules = Array.from(ruleRows).map(row => ({
                id: row.dataset.ruleId,
                trigger: row.querySelector('.rule-trigger').value,
                target: row.querySelector('.rule-target').value,
                action: row.querySelector('.rule-action').value
            }));
            await set('trackerRules', JSON.stringify(rules));

            await set('hideFromPlayers', formData.get('hideFromPlayers') === 'on');

            this.close();
            if (CharacterTrackerSettingsApp.onSaveCallback) CharacterTrackerSettingsApp.onSaveCallback();
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
    static onSaveCallback = null;

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

            await game.settings.set(MODULE_ID, 'advAttributeName', formData.get('attributeName'));
            await game.settings.set(MODULE_ID, 'advAttributeMax', Math.min(ADV_MAX_POSSIBLE_VALUE, parseInt(formData.get('attributeMax'))));
            await game.settings.set(MODULE_ID, 'advAttributeInverted', formData.get('attributeInverted') === 'on');
            await game.settings.set(MODULE_ID, 'advAttributeColor', formData.get('attributeColor'));
            await game.settings.set(MODULE_ID, 'advIconColor', formData.get('iconColor'));
            await game.settings.set(MODULE_ID, 'advAttributeIcon', formData.get('attributeIcon'));
            await game.settings.set(MODULE_ID, 'advEnableCustomBackground', formData.get('enableCustomBackground') === 'on');
            await game.settings.set(MODULE_ID, 'advCustomBackgroundColor', formData.get('customBackgroundColor'));
            await game.settings.set(MODULE_ID, 'advEnableCustomBorder', formData.get('enableCustomBorder') === 'on');
            await game.settings.set(MODULE_ID, 'advCustomBorderColor', formData.get('customBorderColor'));
            await game.settings.set(MODULE_ID, 'hideAdversaryTracker', formData.get('hideAdversaryTracker') === 'on');

            const ruleRows = this.element.querySelectorAll('.rule-row');
            const rules = Array.from(ruleRows).map(row => ({
                id: row.dataset.ruleId,
                trigger: row.querySelector('.rule-trigger').value,
                target: row.querySelector('.rule-target').value,
                action: row.querySelector('.rule-action').value
            }));
            await game.settings.set(MODULE_ID, 'advTrackerRules', JSON.stringify(rules));

            this.close();
            if (AdversaryTrackerSettingsApp.onSaveCallback) AdversaryTrackerSettingsApp.onSaveCallback();
        });
    }
}

/**
 * Registers the "Tracker Manager" button in the Daggerheart system sidebar menu.
 */
export function registerDaggerheartMenuButton() {
    Hooks.on("renderDaggerheartMenu", (app, element, data) => {
        const html = element instanceof jQuery ? element[0] : element;

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
 * Registers all module settings and wires up the settings UI callbacks.
 * Called during the `init` hook.
 * @param {Function} refreshCallback - Called whenever a visual setting changes so all open sheets re-render.
 */
export function registerModuleSettings(refreshCallback) {
    CharacterTrackerSettingsApp.onSaveCallback = refreshCallback;

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

    AdversaryTrackerSettingsApp.onSaveCallback = refreshCallback;

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
