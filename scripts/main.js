/**
 * Main Logic (Runtime)
 * Responsible for:
 * 1. Hooks (Init, Render, Update, Create).
 * 2. DOM Manipulation (Sheet injection).
 * 3. Business Logic (Updates, Chat Cards).
 * 4. Operational Applications (Status and Config per Actor).
 */

import { MODULE_ID, ADV_FLAG_KEY, MAX_POSSIBLE_VALUE, ADV_MAX_POSSIBLE_VALUE, CHARACTER_TRACKERS } from './constants.js';
import { registerModuleSettings, registerDaggerheartMenuButton } from './config.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Tracks the previous pip value per actor+tracker for rule evaluation
const _previousValues = new Map();

/**
 * Resolves a character tracker definition by its 1-based index.
 * @param {number} index
 * @returns {object|undefined} The matching {@link CHARACTER_TRACKERS} entry.
 */
function _getTrackerByIndex(index) {
    return CHARACTER_TRACKERS.find(t => t.index === Number(index));
}

/**
 * Builds the `_previousValues` map key for an actor + character tracker.
 * @param {string} actorId
 * @param {object} tracker - A {@link CHARACTER_TRACKERS} entry.
 * @returns {string}
 */
function _prevKey(actorId, tracker) {
    return `${actorId}_t${tracker.index}`;
}

/* -------------------------------------------- */
/* Initialization                               */
/* -------------------------------------------- */

Hooks.once('init', () => {
    registerModuleSettings(_refreshAllSheets);
    registerDaggerheartMenuButton();
});

/* -------------------------------------------- */
/* Runtime Helpers                              */
/* -------------------------------------------- */

/**
 * Reads the resolved (clamped/defaulted) runtime settings for a character tracker.
 * @param {object} tracker - A {@link CHARACTER_TRACKERS} entry.
 * @returns {object} Runtime settings for the tracker.
 */
function _getSettings(tracker) {
    const keys = tracker.keys;
    const get = (field) => game.settings.get(MODULE_ID, keys[field]);
    const rawName = get('attributeName') || 'Despair';

    return {
        enabled: get('enabled'),
        name: rawName.substring(0, 14),
        max: Math.max(1, Math.min(MAX_POSSIBLE_VALUE, get('attributeMax') || 6)),
        inverted: get('attributeInverted') || false,
        gmOnly: game.settings.get(MODULE_ID, 'gmOnly') || false,
        icon: get('attributeIcon') || 'fa-solid fa-skull',
        color: get('attributeColor') || '#e54e4e',
        iconColor: get('iconColor') || '#e54e4e',
        // Background Logic
        enableCustomBackground: get('enableCustomBackground') || false,
        customBackgroundColor: get('customBackgroundColor') || '#18162e',
        // Border Logic
        enableCustomBorder: get('enableCustomBorder') || false,
        customBorderColor: get('customBorderColor') || '#f3c267',

        verbose: get('attributeVerbose') || false,
        sound: get('attributeSound') || '',
        volume: get('attributeVolume') ?? 0.9,
        pipClickSound: get('pipClickSound') || '',
        pipClickVolume: get('pipClickVolume') ?? 0.8,
        chatImage: get('chatImage'),
        textMax: get('textMax') || 'MAXIMUM REACHED',
        textDepleted: get('textDepleted') || 'DEPLETED',
        hideFromPlayers: get('hideFromPlayers') || false
    };
}

function _getAdvSettings() {
    const rawName = game.settings.get(MODULE_ID, 'advAttributeName') || 'Tracker';

    return {
        name: rawName.substring(0, 14),
        max: Math.max(1, Math.min(ADV_MAX_POSSIBLE_VALUE, game.settings.get(MODULE_ID, 'advAttributeMax') || 6)),
        inverted: game.settings.get(MODULE_ID, 'advAttributeInverted') || false,
        gmOnly: true,
        icon: game.settings.get(MODULE_ID, 'advAttributeIcon') || 'fa-solid fa-skull',
        color: game.settings.get(MODULE_ID, 'advAttributeColor') || '#e54e4e',
        iconColor: game.settings.get(MODULE_ID, 'advIconColor') || '#e54e4e',
        enableCustomBackground: game.settings.get(MODULE_ID, 'advEnableCustomBackground') || false,
        customBackgroundColor: game.settings.get(MODULE_ID, 'advCustomBackgroundColor') || '#18162e',
        enableCustomBorder: game.settings.get(MODULE_ID, 'advEnableCustomBorder') || false,
        customBorderColor: game.settings.get(MODULE_ID, 'advCustomBorderColor') || '#f3c267'
    };
}

/* -------------------------------------------- */
/* Rule Evaluation & Active Effects             */
/* -------------------------------------------- */

const RULE_TARGET_MAP = {
    hope:      { key: 'system.resources.hope.max',      name: 'DHStatTracker: Hope' },
    hpMax:     { key: 'system.resources.hitPoints.max',  name: 'DHStatTracker: HP' },
    stressMax: { key: 'system.resources.stress.max',     name: 'DHStatTracker: Stress' },
    scars:        { key: 'system.scars',                         name: 'DHStatTracker: Scars' },
    evasion:      { key: 'system.evasion',                       name: 'DHStatTracker: Evasion' },
    spellcasting: { key: 'system.bonuses.roll.spellcast.bonus',  name: 'DHStatTracker: Spellcasting' }
};

const ADV_RULE_TARGET_MAP = {
    stressMax:      { key: 'system.resources.stress.max',           name: 'DHStatTracker: Stress' },
    hpMax:          { key: 'system.resources.hitPoints.max',        name: 'DHStatTracker: HP' },
    attackBonus:    { key: 'system.bonuses.roll.attack.bonus',      name: 'DHStatTracker: Attack Bonus' },
    critical:       { key: 'system.criticalThreshold',              name: 'DHStatTracker: Critical', invertAction: true },
    physicalDmg:    { key: 'system.bonuses.damage.physical.bonus',  name: 'DHStatTracker: Physical Damage' },
    magicalDmg:     { key: 'system.bonuses.damage.magical.bonus',   name: 'DHStatTracker: Magical Damage' },
    majorThreshold: { key: 'system.damageThresholds.major',         name: 'DHStatTracker: Major Threshold' },
    severeThreshold:{ key: 'system.damageThresholds.severe',        name: 'DHStatTracker: Severe Threshold' }
};

function _getRules(tracker) {
    try {
        return JSON.parse(game.settings.get(MODULE_ID, tracker.keys.trackerRules) || '[]');
    } catch { return []; }
}

function _getAdvRules() {
    try {
        return JSON.parse(game.settings.get(MODULE_ID, 'advTrackerRules') || '[]');
    } catch { return []; }
}

function _buildEffectData(rule, targetMap = RULE_TARGET_MAP) {
    const target = targetMap[rule.target];
    if (!target) return null;

    let value;
    if (target.invertAction) {
        value = rule.action === 'add' ? '-1' : '1';
    } else {
        value = rule.action === 'add' ? '1' : '-1';
    }

    return {
        name: target.name,
        type: 'base',
        system: {
            rangeDependence: {
                enabled: false,
                type: 'withinRange',
                target: 'hostile',
                range: 'melee'
            }
        },
        img: 'icons/magic/symbols/chevron-elipse-circle-blue.webp',
        changes: [{
            key: target.key,
            mode: 2,
            value: value,
            priority: null
        }],
        disabled: false,
        duration: {
            startTime: 0, combat: null, seconds: null, rounds: null,
            turns: null, startRound: null, startTurn: null
        },
        description: '<p>Daggerheart: Custom Stat Tracker</p>',
        origin: null,
        tint: '#ffffff',
        transfer: false,
        statuses: [],
        sort: 0,
        flags: {
            [MODULE_ID]: { ruleId: rule.id }
        }
    };
}

async function _applyRuleEffect(actor, rule, times = 1, targetMap = RULE_TARGET_MAP, isReversal = false) {
    const target = targetMap[rule.target];
    if (!target) return;

    // Find existing AE for this rule
    const existing = actor.effects.find(e => e.getFlag(MODULE_ID, 'ruleId') === rule.id);

    // For inverted targets (like Critical), flip the delta direction
    const invertDelta = target.invertAction ? -1 : 1;

    if (existing) {
        const currentVal = parseInt(existing.changes[0]?.value) || 0;
        const delta = (rule.action === 'add' ? times : -times) * invertDelta;
        const newVal = currentVal + delta;

        if (newVal === 0) {
            await existing.delete();
        } else {
            await existing.update({
                changes: [{ ...existing.changes[0], value: String(newVal) }]
            });
        }
    } else {
        // Reversals undo existing AEs — if none exists, there is nothing to reverse
        if (isReversal) return;

        const effectData = _buildEffectData(rule, targetMap);
        if (!effectData) return;

        const delta = (rule.action === 'add' ? times : -times) * invertDelta;
        effectData.changes[0].value = String(delta);
        await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
    }
}

function _reverseAction(action) {
    return action === 'add' ? 'remove' : 'add';
}

async function _evaluateRulesInternal(actor, oldValue, newValue, effectiveMax, rules, targetMap) {
    if (!rules.length) return;

    const delta = newValue - oldValue;

    for (const rule of rules) {
        switch (rule.trigger) {
            case 'mark':
                if (delta > 0) {
                    await _applyRuleEffect(actor, rule, delta, targetMap);
                } else if (delta < 0) {
                    const reversed = { ...rule, action: _reverseAction(rule.action) };
                    await _applyRuleEffect(actor, reversed, Math.abs(delta), targetMap, true);
                }
                break;
            case 'unmark':
                if (delta < 0) {
                    await _applyRuleEffect(actor, rule, Math.abs(delta), targetMap);
                } else if (delta > 0) {
                    const reversed = { ...rule, action: _reverseAction(rule.action) };
                    await _applyRuleEffect(actor, reversed, delta, targetMap, true);
                }
                break;
            case 'maximum':
                if (newValue === effectiveMax && oldValue !== effectiveMax) {
                    await _applyRuleEffect(actor, rule, 1, targetMap);
                } else if (oldValue === effectiveMax && newValue !== effectiveMax) {
                    const reversed = { ...rule, action: _reverseAction(rule.action) };
                    await _applyRuleEffect(actor, reversed, 1, targetMap, true);
                }
                break;
            case 'minimum':
                if (newValue === 0 && oldValue !== 0) {
                    await _applyRuleEffect(actor, rule, 1, targetMap);
                } else if (oldValue === 0 && newValue !== 0) {
                    const reversed = { ...rule, action: _reverseAction(rule.action) };
                    await _applyRuleEffect(actor, reversed, 1, targetMap, true);
                }
                break;
        }
    }
}

async function _evaluateRules(actor, oldValue, newValue, effectiveMax, tracker) {
    return _evaluateRulesInternal(actor, oldValue, newValue, effectiveMax, _getRules(tracker), RULE_TARGET_MAP);
}

async function _evaluateAdvRules(actor, oldValue, newValue, effectiveMax) {
    return _evaluateRulesInternal(actor, oldValue, newValue, effectiveMax, _getAdvRules(), ADV_RULE_TARGET_MAP);
}

async function _refreshAllSheets() {
    // Data Consistency: Clamp each enabled tracker's value if its Max was reduced (GM Only)
    if (game.user.isGM) {
        const linkedActors = new Set(game.users.map(u => u.character).filter(a => a));

        for (const actor of linkedActors) {
            if (actor.type !== 'character') continue;

            for (const tracker of CHARACTER_TRACKERS) {
                if (!game.settings.get(MODULE_ID, tracker.keys.enabled)) continue;

                const settings = _getSettings(tracker);
                const current = actor.getFlag(MODULE_ID, tracker.flagKey) ?? 0;
                const effectiveMax = _getActorMax(actor, settings.max, tracker.modifierKey);

                if (current > effectiveMax) {
                    await actor.setFlag(MODULE_ID, tracker.flagKey, effectiveMax);
                }
            }
        }
    }

    Object.values(ui.windows).forEach(app => {
        if (app.document?.documentName === 'Actor' &&
            (app.document?.type === 'character' || app.document?.type === 'adversary')) {
            app.render(false);
        }
    });
}

/**
 * Resolves an actor's effective max for a tracker, applying its per-actor modifier flag.
 * @param {Actor} actor
 * @param {number} globalMax - The tracker's global maximum.
 * @param {string} [modifierKey='maxModifier'] - The actor flag holding the per-actor modifier.
 * @returns {number}
 */
function _getActorMax(actor, globalMax, modifierKey = 'maxModifier') {
    const modifier = actor.getFlag(MODULE_ID, modifierKey) ?? 0;
    return Math.max(1, globalMax + modifier);
}

/**
 * Determines whether a specific tracker should be visible to the current user on an actor.
 * @param {Actor} actor
 * @param {object} tracker - A {@link CHARACTER_TRACKERS} entry.
 * @returns {boolean}
 */
function _isTrackerVisibleForUser(actor, tracker) {
    const mode = actor.getFlag(MODULE_ID, tracker.visibilityKey) ?? 'inherit';
    // GM visibility is controlled independently via the per-tracker gmHidden flag so the GM
    // can hide individual trackers from their own view without affecting player visibility.
    if (game.user.isGM) return !actor.getFlag(MODULE_ID, tracker.gmHiddenKey);
    if (mode === 'visible') return true;
    if (mode === 'hidden') return false;
    return !game.settings.get(MODULE_ID, tracker.keys.hideFromPlayers);
}

/* -------------------------------------------- */
/* Hooks: Creation and Rendering                */
/* -------------------------------------------- */

Hooks.on('preCreateActor', (actor, _data, _options, _userId) => {
    if (actor.type === 'character') {
        // Seed every character tracker's value flag so new actors start consistently.
        const updates = {};
        for (const tracker of CHARACTER_TRACKERS) {
            const settings = _getSettings(tracker);
            updates[`flags.${MODULE_ID}.${tracker.flagKey}`] = settings.inverted ? settings.max : 0;
        }
        actor.updateSource(updates);
    } else if (actor.type === 'adversary') {
        const advSettings = _getAdvSettings();
        const initialValue = advSettings.inverted ? advSettings.max : 0;
        actor.updateSource({
            [`flags.${MODULE_ID}.${ADV_FLAG_KEY}`]: initialValue
        });
    }
});

// Official character sheet only. Per-tracker enable/visibility is resolved during injection.
Hooks.on('renderCharacterSheet', (app, _html) => {
    const actor = app.document;
    if (!actor || actor.type !== 'character') return;
    requestAnimationFrame(() => _injectCharacterTrackers(app.element, actor));
});

// Adversary Sheet Support (ApplicationV2 — fires renderAdversarySheet, not renderActorSheet)
Hooks.on('renderAdversarySheet', (app, _html) => {
    const actor = app.document;
    if (!actor || actor.type !== 'adversary') return;
    if (!game.user.isGM) return;
    if (game.settings.get(MODULE_ID, 'hideAdversaryTracker')) return;
    requestAnimationFrame(() => _injectAdversaryAttribute(app.element, actor));
});

/* -------------------------------------------- */
/* DOM Injection Logic                          */
/* -------------------------------------------- */

/**
 * Injects every enabled character tracker into the official character sheet, stacked
 * vertically inside a single wrapper placed right after the `.character-row`.
 * @param {HTMLElement} form - The rendered sheet element.
 * @param {Actor} actor
 */
function _injectCharacterTrackers(form, actor) {
    if (!form || !actor) return;

    const characterRow = form.querySelector('.character-row');
    if (!characterRow) return;

    // A single wrapper holds all stacked tracker sections so their order stays deterministic.
    let wrapper = characterRow.parentElement.querySelector('.dh-new-stat-tracker-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.classList.add('dh-new-stat-tracker-wrapper');
        characterRow.insertAdjacentElement('afterend', wrapper);
    }

    for (const tracker of CHARACTER_TRACKERS) {
        _injectTrackerSection(wrapper, actor, tracker);
    }
}

/**
 * Injects (or updates/removes) a single tracker's section inside the stack wrapper.
 * Sections are keyed by `data-tracker-index` so each tracker updates independently.
 * @param {HTMLElement} wrapper - The `.dh-new-stat-tracker-wrapper` container.
 * @param {Actor} actor
 * @param {object} tracker - A {@link CHARACTER_TRACKERS} entry.
 */
function _injectTrackerSection(wrapper, actor, tracker) {
    const existingSection = wrapper.querySelector(`.dh-new-stat-tracker-section[data-tracker-index="${tracker.index}"]`);

    // Remove the section when the tracker is disabled or hidden for this user.
    const enabled = game.settings.get(MODULE_ID, tracker.keys.enabled);
    if (!enabled || !_isTrackerVisibleForUser(actor, tracker)) {
        if (existingSection) existingSection.remove();
        return;
    }

    const settings = _getSettings(tracker);
    const current = actor.getFlag(MODULE_ID, tracker.flagKey) ?? 0;
    const effectiveMax = _getActorMax(actor, settings.max, tracker.modifierKey);

    // Force Rebuild check (render optimization): if nothing structural changed, only repaint pips.
    if (existingSection) {
        const renderedMax = parseInt(existingSection.dataset.max || 0);
        const renderedName = existingSection.dataset.name || '';
        const renderedIcon = existingSection.dataset.icon || '';
        const renderedColor = existingSection.style.getPropertyValue('--stat-color').trim();
        const renderedIconColor = existingSection.style.getPropertyValue('--stat-icon-color').trim();
        const renderedInverted = existingSection.dataset.inverted === 'true';
        const renderedGmOnly = existingSection.dataset.gmOnly === 'true';
        const renderedUseThemeBg = existingSection.dataset.enableCustomBackground === 'true';
        const renderedBgColor = existingSection.dataset.customBgColor || '';
        const renderedEnableCustomBorder = existingSection.dataset.enableCustomBorder === 'true';
        const renderedBorderColor = existingSection.dataset.customBorderColor || '';

        if (renderedMax === effectiveMax &&
            renderedName === settings.name &&
            renderedIcon === settings.icon &&
            renderedColor === settings.color &&
            renderedIconColor === settings.iconColor &&
            renderedInverted === settings.inverted &&
            renderedGmOnly === settings.gmOnly &&
            renderedUseThemeBg === settings.enableCustomBackground &&
            (!settings.enableCustomBackground || renderedBgColor === settings.customBackgroundColor) &&
            renderedEnableCustomBorder === settings.enableCustomBorder &&
            (!settings.enableCustomBorder || renderedBorderColor === settings.customBorderColor)) {
            _updateVisuals(existingSection, current, effectiveMax, settings.icon, settings.inverted);
            return;
        }
    }

    const newSection = _buildAttributeSection(current, actor.isOwner, 'standard', settings, effectiveMax);
    newSection.dataset.trackerIndex = String(tracker.index);
    _attachListeners(newSection, actor, effectiveMax, tracker);

    if (existingSection && existingSection.isConnected) {
        existingSection.replaceWith(newSection);
    } else {
        // Insert in ascending tracker order so tracker 1 always sits above tracker 2.
        const after = [...wrapper.children].find(el => Number(el.dataset.trackerIndex) > tracker.index);
        if (after) wrapper.insertBefore(newSection, after);
        else wrapper.appendChild(newSection);
    }
}


function _injectAdversaryAttribute(form, actor) {
    if (!form || !actor) return;

    const settings = _getAdvSettings();
    const current = actor.getFlag(MODULE_ID, ADV_FLAG_KEY) ?? 0;
    const effectiveMax = settings.max;

    const tagsEl = form.querySelector('.tags');
    if (!tagsEl) return;

    const existingSection = tagsEl.parentElement.querySelector('.dh-new-stat-tracker-section--adversary');

    if (existingSection) {
        const renderedMax = parseInt(existingSection.dataset.max || 0);
        const renderedName = existingSection.dataset.name || '';
        const renderedIcon = existingSection.dataset.icon || '';
        const renderedColor = existingSection.style.getPropertyValue('--stat-color').trim();
        const renderedIconColor = existingSection.style.getPropertyValue('--stat-icon-color').trim();
        const renderedInverted = existingSection.dataset.inverted === 'true';
        const renderedUseThemeBg = existingSection.dataset.enableCustomBackground === 'true';
        const renderedBgColor = existingSection.dataset.customBgColor || '';
        const renderedEnableCustomBorder = existingSection.dataset.enableCustomBorder === 'true';
        const renderedBorderColor = existingSection.dataset.customBorderColor || '';

        if (renderedMax === effectiveMax &&
            renderedName === settings.name &&
            renderedIcon === settings.icon &&
            renderedColor === settings.color &&
            renderedIconColor === settings.iconColor &&
            renderedInverted === settings.inverted &&
            renderedUseThemeBg === settings.enableCustomBackground &&
            (!settings.enableCustomBackground || renderedBgColor === settings.customBackgroundColor) &&
            renderedEnableCustomBorder === settings.enableCustomBorder &&
            (!settings.enableCustomBorder || renderedBorderColor === settings.customBorderColor)) {
            _updateVisuals(existingSection, current, effectiveMax, settings.icon, settings.inverted);
            return;
        }
    }

    const newSection = _buildAttributeSection(current, true, 'adversary', settings, effectiveMax);
    _attachAdversaryListeners(newSection, actor, effectiveMax);

    if (existingSection && existingSection.isConnected) {
        existingSection.replaceWith(newSection);
    } else {
        tagsEl.insertAdjacentElement('afterend', newSection);
    }
}

function _attachAdversaryListeners(section, actor, maxValue) {
    if (!game.user.isGM) return;

    section.addEventListener('click', async (event) => {
        const pip = event.target.closest('.attribute-pip');
        if (!pip) return;
        event.preventDefault();
        event.stopPropagation();

        const clicked = parseInt(pip.dataset.value);
        const current = actor.getFlag(MODULE_ID, ADV_FLAG_KEY) ?? 0;
        const newValue = Math.max(0, Math.min(maxValue, (current === clicked) ? clicked - 1 : clicked));

        _previousValues.set(`adv_${actor.id}`, current);
        await actor.setFlag(MODULE_ID, ADV_FLAG_KEY, newValue);
    });

    section.addEventListener('contextmenu', async (event) => {
        const pip = event.target.closest('.attribute-pip');
        if (!pip) return;
        event.preventDefault();
        event.stopPropagation();

        const current = actor.getFlag(MODULE_ID, ADV_FLAG_KEY) ?? 0;
        const newValue = Math.max(0, current - 1);

        _previousValues.set(`adv_${actor.id}`, current);
        await actor.setFlag(MODULE_ID, ADV_FLAG_KEY, newValue);
    });
}

function _buildAttributeSection(current, isOwner, layout, settings, effectiveMax) {
    const section = document.createElement('div');
    section.classList.add('dh-new-stat-tracker-section', `dh-new-stat-tracker-section--${layout}`);
    
    // Metadata for smart updates
    section.dataset.max = effectiveMax;
    section.dataset.name = settings.name;
    section.dataset.icon = settings.icon;
    section.dataset.inverted = settings.inverted;
    section.dataset.gmOnly = settings.gmOnly;
    section.dataset.enableCustomBackground = settings.enableCustomBackground;
    section.dataset.customBgColor = settings.customBackgroundColor;
    section.dataset.enableCustomBorder = settings.enableCustomBorder;
    section.dataset.customBorderColor = settings.customBorderColor;

    // Apply Styles based on settings
    section.style.setProperty('--stat-color', settings.color);
    section.style.setProperty('--stat-icon-color', settings.iconColor);
    section.style.setProperty('--stat-bg', settings.enableCustomBackground ? settings.customBackgroundColor : '#18162e');
    section.style.setProperty('--stat-border', settings.enableCustomBorder ? settings.customBorderColor : '#f3c267');

    const canInteract = settings.gmOnly ? game.user.isGM : isOwner;

    // 1. Create Left Line (Filler Line)
    const leftLine = document.createElement('div');
    leftLine.classList.add('dh-filler-line');
    section.appendChild(leftLine);

    // 2. Create Central Wrapper (Text + Pips)
    // This is CRITICAL to keep content together in the middle while lines stretch
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('dh-tracker-content-wrapper');

    // -- Content Logic --
    // Both the character (standard) and adversary layouts share the same label + pips markup.
    const label = document.createElement('h4');
    label.textContent = settings.name;
    contentWrapper.appendChild(label);

    const pipsContainer = document.createElement('div');
    pipsContainer.classList.add('attribute-pips');
    pipsContainer.style.display = 'flex';
    pipsContainer.style.gap = '4px';
    _renderPips(pipsContainer, effectiveMax, current, canInteract, settings.icon);
    contentWrapper.appendChild(pipsContainer);
    
    section.appendChild(contentWrapper);

    // 3. Create Right Line (Filler Line)
    const rightLine = document.createElement('div');
    rightLine.classList.add('dh-filler-line');
    section.appendChild(rightLine);

    _updateMaxClass(section, current, effectiveMax, settings.inverted);
    return section;
}

function _renderPips(container, max, current, canInteract, iconClass, startAt = 1) {
    const activeIcon = iconClass || 'fa-solid fa-skull';
    
    for (let i = startAt; i <= max; i++) {
        const pip = document.createElement('span');
        pip.classList.add('attribute-pip');
        pip.dataset.value = String(i);
        if (!canInteract) pip.classList.add('no-interact');
        
        const icon = document.createElement('i');
        icon.className = i <= current ? activeIcon : 'fa-regular fa-circle';
        
        pip.appendChild(icon);
        container.appendChild(pip);
    }
}

function _updateVisuals(section, current, max, iconClass, inverted) {
    _updateMaxClass(section, current, max, inverted);
    const activeIcon = iconClass || 'fa-solid fa-skull';

    const pips = section.querySelectorAll('.attribute-pip i');
    pips.forEach((icon, index) => {
        const pipValue = index + 1;
        const targetClass = pipValue <= current ? activeIcon : 'fa-regular fa-circle';
        if (icon.className !== targetClass) {
            icon.className = targetClass;
        }
    });
}

function _updateMaxClass(section, current, max, inverted) {
    let isAlertState = false;
    if (inverted) {
        isAlertState = (current === 0);
    } else {
        isAlertState = (current >= max);
    }
    if (isAlertState) section.classList.add('attribute-max');
    else section.classList.remove('attribute-max');
}

/**
 * Attaches pip click/right-click handlers for a single character tracker's section.
 * @param {HTMLElement} section
 * @param {Actor} actor
 * @param {number} maxValue - The tracker's effective max for this actor.
 * @param {object} tracker - A {@link CHARACTER_TRACKERS} entry.
 */
function _attachListeners(section, actor, maxValue, tracker) {
    const settings = _getSettings(tracker);
    const canInteract = settings.gmOnly ? game.user.isGM : actor.isOwner;

    if (!canInteract) return;

    section.addEventListener('click', async (event) => {
        const pip = event.target.closest('.attribute-pip');
        if (!pip) return;
        event.preventDefault();
        event.stopPropagation();

        const clicked = parseInt(pip.dataset.value);
        const current = actor.getFlag(MODULE_ID, tracker.flagKey) ?? 0;
        const newValue = Math.max(0, Math.min(maxValue, (current === clicked) ? clicked - 1 : clicked));

        const s = _getSettings(tracker);
        const isAlertState = s.inverted ? (newValue === 0) : (newValue >= maxValue);
        if (s.pipClickSound && !isAlertState) {
            foundry.audio.AudioHelper.play({src: s.pipClickSound, volume: s.pipClickVolume, autoplay: true, loop: false}, false);
        }

        _previousValues.set(_prevKey(actor.id, tracker), current);
        await actor.setFlag(MODULE_ID, tracker.flagKey, newValue);
    });

    section.addEventListener('contextmenu', async (event) => {
        const pip = event.target.closest('.attribute-pip');
        if (!pip) return;
        event.preventDefault();
        event.stopPropagation();
        const current = actor.getFlag(MODULE_ID, tracker.flagKey) ?? 0;
        const newValue = Math.max(0, current - 1);

        const s = _getSettings(tracker);
        const isAlertState = s.inverted ? (newValue === 0) : (newValue >= maxValue);
        if (s.pipClickSound && !isAlertState) {
            foundry.audio.AudioHelper.play({src: s.pipClickSound, volume: s.pipClickVolume, autoplay: true, loop: false}, false);
        }

        _previousValues.set(_prevKey(actor.id, tracker), current);
        await actor.setFlag(MODULE_ID, tracker.flagKey, newValue);
    });
}

/* -------------------------------------------- */
/* Update Handling (Chat & Audio)               */
/* -------------------------------------------- */

function _createCardContent(title, actorName, displayValue, statusText, colorShadow, bgImage) {
    const bgVar = bgImage ? `--chat-bg-image: url('${bgImage}');` : '';

    return `
    <div class="dh-new-stat-tracker-chat-card" style="--chat-shadow-color: ${colorShadow}; ${bgVar}">
        <header class="card-header flexrow">
            <h3 class="noborder">${title}</h3>
        </header>
        <div class="card-content">
            <div class="card-overlay"></div>
            <div class="card-body">
                <div class="actor-name">${actorName}</div>
                <div class="display-value">${displayValue}</div>
                <div class="status-text">${statusText}</div>
            </div>
        </div>
    </div>`;
}

Hooks.on('updateActor', async (actor, changes, _options, userId) => {
    // Only process update on the client that made the change
    if (game.user.id !== userId) return;

    // --- Adversary Tracker Rule Evaluation ---
    const advNewValue = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${ADV_FLAG_KEY}`);
    if (advNewValue !== undefined && actor.type === 'adversary') {
        const advSettings = _getAdvSettings();
        const advOldValue = _previousValues.get(`adv_${actor.id}`) ?? 0;
        _previousValues.delete(`adv_${actor.id}`);
        if (advOldValue !== advNewValue) {
            await _evaluateAdvRules(actor, advOldValue, advNewValue, advSettings.max);
        }
    }

    // --- Character Trackers ---
    if (actor.type !== 'character') return;

    for (const tracker of CHARACTER_TRACKERS) {
        const newValue = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${tracker.flagKey}`);
        if (newValue === undefined) continue;
        if (!game.settings.get(MODULE_ID, tracker.keys.enabled)) continue;

        const settings = _getSettings(tracker);
        const effectiveMax = _getActorMax(actor, settings.max, tracker.modifierKey);

        // Evaluate rules using the stored previous value
        const prevKey = _prevKey(actor.id, tracker);
        const oldValue = _previousValues.get(prevKey) ?? 0;
        _previousValues.delete(prevKey);
        if (oldValue !== newValue) {
            await _evaluateRules(actor, oldValue, newValue, effectiveMax, tracker);
        }

        const valueDisplay = String(newValue);

        // Determine Alert Logic
        let isAlertState;
        let statusText;
        if (settings.inverted) {
            isAlertState = (newValue === 0);
            statusText = settings.textDepleted;
        } else {
            isAlertState = (newValue >= effectiveMax);
            statusText = settings.textMax;
        }

        // 1. Alert State (Threshold Reached)
        if (isAlertState) {
            if (settings.sound) {
                foundry.audio.AudioHelper.play({src: settings.sound, volume: settings.volume, autoplay: true, loop: false}, false);
            }

            ChatMessage.create({
                content: _createCardContent(settings.name.toUpperCase(), actor.name, valueDisplay, statusText, "#ff0000", settings.chatImage),
                whisper: ChatMessage.getWhisperRecipients('GM')
            });

            continue; // Don't send verbose message if we sent an alert for this tracker
        }

        // 2. Verbose Mode
        if (settings.verbose) {
            ChatMessage.create({
                content: _createCardContent(settings.name.toUpperCase(), actor.name, valueDisplay, "UPDATED", "#00b0ff", settings.chatImage),
                whisper: ChatMessage.getWhisperRecipients('GM')
            });
        }
    }
});

/**
 * GM dashboard listing every linked player character and, for each, one control row
 * per enabled character tracker. Rows carry `data-tracker-index` so the handlers act
 * on the right tracker's value, per-actor modifier, and per-tracker visibility flags.
 */
class TrackerStatusApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static BASE_APPLICATION = foundry.applications.api.ApplicationV2;

    static DEFAULT_OPTIONS = {
        id: "tracker-status-app",
        classes: [MODULE_ID],
        tag: "form",
        window: {
            title: "Tracker Status",
            resizable: true
        },
        position: {
            width: 540,
            height: "auto"
        }
    };

    static PARTS = {
        content: {
            template: `modules/${MODULE_ID}/templates/tracker-manager.hbs`
        }
    };

    async _prepareContext(_options) {
        const enabledTrackers = CHARACTER_TRACKERS.filter(t => game.settings.get(MODULE_ID, t.keys.enabled));
        const users = game.users.filter(u => !u.isGM && u.character);

        const actors = users.map(u => {
            const actor = u.character;
            const entries = enabledTrackers.map(tracker => {
                const settings = _getSettings(tracker);
                return {
                    index: tracker.index,
                    name: settings.name,
                    value: actor.getFlag(MODULE_ID, tracker.flagKey) ?? 0,
                    max: _getActorMax(actor, settings.max, tracker.modifierKey),
                    visibilityMode: actor.getFlag(MODULE_ID, tracker.visibilityKey) ?? 'inherit',
                    gmHidden: actor.getFlag(MODULE_ID, tracker.gmHiddenKey) ?? false
                };
            });
            return {
                actorId: actor.id,
                actorName: actor.name,
                userName: u.name,
                entries
            };
        });

        return {
            actors,
            hasEnabledTrackers: enabledTrackers.length > 0,
            multipleTrackers: enabledTrackers.length > 1
        };
    }

    _onRender(_context, _options) {
        this.element.querySelectorAll('.tracker-adjust').forEach(n => {
            n.addEventListener('click', this._onAdjust.bind(this));
        });
        this.element.querySelectorAll('.tracker-config').forEach(n => {
            n.addEventListener('click', this._onConfig.bind(this));
        });
        this.element.querySelectorAll('.tracker-visibility').forEach(n => {
            n.addEventListener('click', this._onToggleVisibility.bind(this));
        });
        this.element.querySelectorAll('.tracker-gm-toggle').forEach(n => {
            n.addEventListener('click', this._onToggleGmVisibility.bind(this));
        });
    }

    /**
     * Resolves the actor + tracker definition referenced by a control's dataset.
     * @param {HTMLElement} btn - The clicked control carrying data-actor-id / data-tracker-index.
     * @returns {{ actor: Actor, tracker: object }|null}
     */
    _resolve(btn) {
        const actor = game.actors.get(btn.dataset.actorId);
        const tracker = _getTrackerByIndex(btn.dataset.trackerIndex);
        if (!actor || !tracker) return null;
        return { actor, tracker };
    }

    async _onAdjust(event) {
        event.preventDefault();
        const resolved = this._resolve(event.currentTarget);
        if (!resolved) return;
        const { actor, tracker } = resolved;
        const action = event.currentTarget.dataset.action;

        const settings = _getSettings(tracker);
        const current = actor.getFlag(MODULE_ID, tracker.flagKey) ?? 0;
        const effectiveMax = _getActorMax(actor, settings.max, tracker.modifierKey);
        let newValue = current;

        if (action === 'increase') newValue++;
        else if (action === 'decrease') newValue--;

        // Clamp value
        newValue = Math.max(0, Math.min(effectiveMax, newValue));

        _previousValues.set(_prevKey(actor.id, tracker), current);
        await actor.setFlag(MODULE_ID, tracker.flagKey, newValue);
        this.render();
    }

    _onConfig(event) {
        event.preventDefault();
        const resolved = this._resolve(event.currentTarget);
        if (!resolved) return;
        new TrackerConfigApp(resolved.actor.id, resolved.tracker.index).render(true);
    }

    async _onToggleVisibility(event) {
        event.preventDefault();
        const resolved = this._resolve(event.currentTarget);
        if (!resolved) return;
        const { actor, tracker } = resolved;

        const current = actor.getFlag(MODULE_ID, tracker.visibilityKey) ?? 'inherit';
        // Cycle player visibility: inherit → visible → hidden → inherit
        const next = current === 'inherit' ? 'visible' : current === 'visible' ? 'hidden' : 'inherit';
        await actor.setFlag(MODULE_ID, tracker.visibilityKey, next);
        this.render();
    }

    /**
     * Toggles the GM-specific hidden flag for an actor's tracker.
     * This is independent of player visibility — the GM can hide a tracker from their
     * own view without affecting what players see.
     * Triggered by a click on the `.tracker-gm-toggle` button.
     * @param {PointerEvent} event
     */
    async _onToggleGmVisibility(event) {
        event.preventDefault();
        const resolved = this._resolve(event.currentTarget);
        if (!resolved) return;
        const { actor, tracker } = resolved;

        const current = actor.getFlag(MODULE_ID, tracker.gmHiddenKey) ?? false;
        await actor.setFlag(MODULE_ID, tracker.gmHiddenKey, !current);
        this.render();
    }
}

/**
 * Per-actor dialog to adjust one tracker's max modifier (effective max = global max + modifier).
 */
class TrackerConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
    /**
     * @param {string} actorId - The actor whose modifier is being edited.
     * @param {number} trackerIndex - Which character tracker (1-based) to configure.
     * @param {object} [options={}]
     */
    constructor(actorId, trackerIndex, options={}) {
        super(options);
        this.actorId = actorId;
        this.tracker = _getTrackerByIndex(trackerIndex) ?? CHARACTER_TRACKERS[0];
    }

    static BASE_APPLICATION = foundry.applications.api.ApplicationV2;

    static DEFAULT_OPTIONS = {
        id: "tracker-config-app",
        classes: [MODULE_ID],
        tag: "form",
        window: {
            title: "Tracker Configuration",
            resizable: false
        },
        position: {
            width: 300,
            height: "auto"
        }
    };

    static PARTS = {
        content: {
            template: `modules/${MODULE_ID}/templates/tracker-config.hbs`
        }
    };

    async _prepareContext(_options) {
        const actor = game.actors.get(this.actorId);
        const settings = _getSettings(this.tracker);
        const modifier = actor?.getFlag(MODULE_ID, this.tracker.modifierKey) ?? 0;

        return {
            actorName: actor?.name || "Unknown",
            trackerName: settings.name,
            globalMax: settings.max,
            modifier: modifier,
            effectiveMax: Math.max(1, settings.max + modifier)
        };
    }

    _onRender(_context, _options) {
        this.element.querySelectorAll('.config-adjust').forEach(n => {
            n.addEventListener('click', this._onAdjust.bind(this));
        });
    }

    async _onAdjust(event) {
        const actor = game.actors.get(this.actorId);
        if (!actor) return;
        const action = event.currentTarget.dataset.action;
        const settings = _getSettings(this.tracker);
        let modifier = actor.getFlag(MODULE_ID, this.tracker.modifierKey) ?? 0;

        if (action === 'increase') modifier++;
        else if (action === 'decrease') modifier--;

        const newEffectiveMax = settings.max + modifier;
        if (newEffectiveMax < 1) return;
        if (action === 'increase' && newEffectiveMax > MAX_POSSIBLE_VALUE) return;

        await actor.setFlag(MODULE_ID, this.tracker.modifierKey, modifier);

        const current = actor.getFlag(MODULE_ID, this.tracker.flagKey) ?? 0;
        if (current > newEffectiveMax) {
            await actor.setFlag(MODULE_ID, this.tracker.flagKey, newEffectiveMax);
        }

        this.render();
        if (trackerStatusApp) trackerStatusApp.render();
    }
}

let trackerStatusApp;
window.DHStatTracker = {
    openManager: () => {
        if (!trackerStatusApp) trackerStatusApp = new TrackerStatusApp();
        trackerStatusApp.render({ force: true });
    },

    /**
     * Updates a tracker value of the currently selected actor.
     * @param {object} param - Options.
     * @param {number} param.value - Integer amount to add (positive) or subtract (negative).
     * @param {number} [param.tracker=1] - Which character tracker (1 or 2) to modify.
     * @example DHStatTracker.updateActor({value: 1});             // adds 1 to tracker 1
     * @example DHStatTracker.updateActor({value: -1});            // removes 1 from tracker 1
     * @example DHStatTracker.updateActor({value: 1, tracker: 2}); // adds 1 to tracker 2
     */
    updateActor: async ({ value, tracker: trackerIndex = 1 } = {}) => {
        // Validate argument
        if (value === undefined || value === null || typeof value !== 'number' || !Number.isInteger(value)) {
            ui.notifications.error("DHStatTracker.updateActor() requires an object with an integer 'value' property. Example: {value: 1}");
            return;
        }

        const tracker = _getTrackerByIndex(trackerIndex);
        if (!tracker) {
            ui.notifications.error(`DHStatTracker.updateActor(): unknown tracker "${trackerIndex}". Use 1 or 2.`);
            return;
        }

        if (!game.settings.get(MODULE_ID, tracker.keys.enabled)) {
            ui.notifications.warn(`Tracker ${tracker.index} is disabled.`);
            return;
        }

        // Get selected token's actor
        const token = canvas.tokens.controlled[0];
        if (!token) {
            ui.notifications.warn("No token selected. Please select a token first.");
            return;
        }

        const actor = token.actor;
        if (!actor) {
            ui.notifications.error("Selected token has no linked actor.");
            return;
        }

        // Check that the actor has the tracker flag
        const current = actor.getFlag(MODULE_ID, tracker.flagKey);
        if (current === undefined || current === null) {
            ui.notifications.warn(`Actor "${actor.name}" does not have a tracker flag set.`);
            return;
        }

        // Permission check
        const settings = _getSettings(tracker);
        const canInteract = settings.gmOnly ? game.user.isGM : actor.isOwner;
        if (!canInteract) {
            ui.notifications.warn("You do not have permission to modify this tracker.");
            return;
        }

        const effectiveMax = _getActorMax(actor, settings.max, tracker.modifierKey);
        const newValue = Math.max(0, Math.min(effectiveMax, current + value));

        if (newValue === current) {
            const reason = value > 0 ? "already at maximum" : "already at minimum";
            ui.notifications.info(`Tracker for "${actor.name}" is ${reason} (${current}).`);
            return;
        }

        _previousValues.set(_prevKey(actor.id, tracker), current);
        await actor.setFlag(MODULE_ID, tracker.flagKey, newValue);
    }
};

