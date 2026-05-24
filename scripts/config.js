/**
 * Settings, Constants, and Static Definitions
 * Responsible for:
 * 1. Registering settings in Foundry VTT.
 * 2. Managing the Settings Menu (UI).
 * 3. Integrations with System UI (Menu Buttons).
 */

import { MODULE_ID, FLAG_KEY, ADV_FLAG_KEY, MAX_POSSIBLE_VALUE, ADV_MAX_POSSIBLE_VALUE, AVAILABLE_ICONS } from './constants.js';

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
 * Menu Application for the character tracker complete settings.
 */
class TrackerSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    // Static callback to trigger a sheet refresh after saving.
    static onSaveCallback = null;

    static BASE_APPLICATION = foundry.applications.api.ApplicationV2;

    static DEFAULT_OPTIONS = {
        id: "tracker-settings-app",
        classes: [MODULE_ID],
        tag: "form",
        window: { title: "Tracker Configuration", resizable: true },
        position: { width: 570, height: 600 }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/settings-menu.hbs` }
    };

    /**
     * Builds the Handlebars context from current settings.
     * Called from ApplicationV2 render lifecycle.
     * @param {object} _options
     * @returns {Promise<object>}
     */
    async _prepareContext(_options) {
        return {
            // Core Settings
            attributeName: game.settings.get(MODULE_ID, 'attributeName'),
            attributeMax: game.settings.get(MODULE_ID, 'attributeMax'),
            attributeInverted: game.settings.get(MODULE_ID, 'attributeInverted'),
            attributeColor: game.settings.get(MODULE_ID, 'attributeColor'),
            iconColor: game.settings.get(MODULE_ID, 'iconColor'),
            attributeIcon: game.settings.get(MODULE_ID, 'attributeIcon'),

            // Background Settings
            enableCustomBackground: game.settings.get(MODULE_ID, 'enableCustomBackground'),
            customBackgroundColor: game.settings.get(MODULE_ID, 'customBackgroundColor'),

            // Border Settings
            enableCustomBorder: game.settings.get(MODULE_ID, 'enableCustomBorder'),
            customBorderColor: game.settings.get(MODULE_ID, 'customBorderColor'),

            attributeSound: game.settings.get(MODULE_ID, 'attributeSound'),
            attributeVolume: game.settings.get(MODULE_ID, 'attributeVolume'),
            pipClickSound: game.settings.get(MODULE_ID, 'pipClickSound'),
            pipClickVolume: game.settings.get(MODULE_ID, 'pipClickVolume'),

            // Chat Settings
            verbose: game.settings.get(MODULE_ID, 'attributeVerbose'),
            chatImage: game.settings.get(MODULE_ID, 'chatImage'),
            textMax: game.settings.get(MODULE_ID, 'textMax'),
            textDepleted: game.settings.get(MODULE_ID, 'textDepleted'),

            // Rules
            trackerRules: JSON.parse(game.settings.get(MODULE_ID, 'trackerRules') || '[]'),

            // Visibility
            hideFromPlayers: game.settings.get(MODULE_ID, 'hideFromPlayers'),

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

            await game.settings.set(MODULE_ID, 'attributeName', formData.get('attributeName'));
            await game.settings.set(MODULE_ID, 'attributeMax', parseInt(formData.get('attributeMax')));
            await game.settings.set(MODULE_ID, 'attributeInverted', formData.get('attributeInverted') === 'on');
            await game.settings.set(MODULE_ID, 'attributeColor', formData.get('attributeColor'));
            await game.settings.set(MODULE_ID, 'iconColor', formData.get('iconColor'));
            await game.settings.set(MODULE_ID, 'attributeIcon', formData.get('attributeIcon'));

            await game.settings.set(MODULE_ID, 'enableCustomBackground', formData.get('enableCustomBackground') === 'on');
            await game.settings.set(MODULE_ID, 'customBackgroundColor', formData.get('customBackgroundColor'));
            await game.settings.set(MODULE_ID, 'enableCustomBorder', formData.get('enableCustomBorder') === 'on');
            await game.settings.set(MODULE_ID, 'customBorderColor', formData.get('customBorderColor'));

            await game.settings.set(MODULE_ID, 'attributeSound', formData.get('attributeSound'));
            await game.settings.set(MODULE_ID, 'attributeVolume', parseFloat(formData.get('attributeVolume')));
            await game.settings.set(MODULE_ID, 'pipClickSound', formData.get('pipClickSound'));
            await game.settings.set(MODULE_ID, 'pipClickVolume', parseFloat(formData.get('pipClickVolume')));

            await game.settings.set(MODULE_ID, 'attributeVerbose', formData.get('verbose') === 'on');
            await game.settings.set(MODULE_ID, 'chatImage', formData.get('chatImage'));
            await game.settings.set(MODULE_ID, 'textMax', formData.get('textMax'));
            await game.settings.set(MODULE_ID, 'textDepleted', formData.get('textDepleted'));

            // Collect rules from dynamically generated rows
            const ruleRows = this.element.querySelectorAll('.rule-row');
            const rules = Array.from(ruleRows).map(row => ({
                id: row.dataset.ruleId,
                trigger: row.querySelector('.rule-trigger').value,
                target: row.querySelector('.rule-target').value,
                action: row.querySelector('.rule-action').value
            }));
            await game.settings.set(MODULE_ID, 'trackerRules', JSON.stringify(rules));

            await game.settings.set(MODULE_ID, 'hideFromPlayers', formData.get('hideFromPlayers') === 'on');

            this.close();
            if (TrackerSettingsApp.onSaveCallback) TrackerSettingsApp.onSaveCallback();
        });
    }
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
    TrackerSettingsApp.onSaveCallback = refreshCallback;

    // --- CORE SETTINGS (hidden from the standard settings menu) ---
    const hiddenSettings = [
        ['attributeName', String, 'Despair'],
        ['attributeMax', Number, 6],
        ['attributeInverted', Boolean, false],
        ['attributeIcon', String, 'fa-solid fa-skull'],
        ['attributeColor', String, '#e54e4e'],
        ['iconColor', String, '#e54e4e'],
        ['enableCustomBackground', Boolean, false],
        ['customBackgroundColor', String, '#18162e'],
        ['enableCustomBorder', Boolean, false],
        ['customBorderColor', String, '#f3c267'],
        ['attributeSound', String, `modules/${MODULE_ID}/assets/sfx/fear.mp3`],
        ['attributeVolume', Number, 0.9],
        ['pipClickSound', String, `modules/${MODULE_ID}/assets/sfx/pipchange.mp3`],
        ['pipClickVolume', Number, 0.8],
        ['attributeVerbose', Boolean, false],
        ['chatImage', String, `modules/${MODULE_ID}/assets/chat-messages/skull.webp`],
        ['textMax', String, 'MAXIMUM REACHED'],
        ['textDepleted', String, 'DEPLETED'],
        ['trackerRules', String, '[]'],
        ['hideFromPlayers', Boolean, false]
    ];

    hiddenSettings.forEach(([key, type, defaultValue]) => {
        game.settings.register(MODULE_ID, key, {
            scope: 'world',
            config: false,
            type,
            default: defaultValue,
            onChange: refreshCallback
        });
    });

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
        name: 'Configuration',
        label: 'Open Tracker Settings',
        hint: 'Configure attributes, visuals, sounds, and chat notifications.',
        icon: 'fas fa-cogs',
        type: TrackerSettingsApp,
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
