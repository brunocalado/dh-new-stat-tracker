/**
 * Main Logic (Runtime)
 * Responsible for:
 * 1. Hooks (Init, Render, Update, Create).
 * 2. DOM Manipulation (Sheet injection).
 * 3. Business Logic (Updates, Chat Cards).
 * 4. Operational Applications (Status and Config per Actor).
 */

import { MODULE_ID, FLAG_KEY, ADV_FLAG_KEY, MAX_POSSIBLE_VALUE, ADV_MAX_POSSIBLE_VALUE } from './constants.js';
import { registerModuleSettings, registerDaggerheartMenuButton } from './config.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Tracks the previous pip value per actor for rule evaluation
const _previousValues = new Map();

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

function _getSettings() {
    const rawName = game.settings.get(MODULE_ID, 'attributeName') || 'Despair';
    
    return {
        name: rawName.substring(0, 14), 
        max: Math.max(1, Math.min(MAX_POSSIBLE_VALUE, game.settings.get(MODULE_ID, 'attributeMax') || 6)),
        inverted: game.settings.get(MODULE_ID, 'attributeInverted') || false,
        gmOnly: game.settings.get(MODULE_ID, 'gmOnly') || false,
        icon: game.settings.get(MODULE_ID, 'attributeIcon') || 'fa-solid fa-skull',
        color: game.settings.get(MODULE_ID, 'attributeColor') || '#e54e4e',
        iconColor: game.settings.get(MODULE_ID, 'iconColor') || '#e54e4e',
        // Background Logic
        enableCustomBackground: game.settings.get(MODULE_ID, 'enableCustomBackground') || false,
        customBackgroundColor: game.settings.get(MODULE_ID, 'customBackgroundColor') || '#18162e',
        // Border Logic
        enableCustomBorder: game.settings.get(MODULE_ID, 'enableCustomBorder') || false,
        customBorderColor: game.settings.get(MODULE_ID, 'customBorderColor') || '#f3c267',
        
        verbose: game.settings.get(MODULE_ID, 'attributeVerbose') || false,
        sound: game.settings.get(MODULE_ID, 'attributeSound') || '',
        volume: game.settings.get(MODULE_ID, 'attributeVolume') ?? 0.9,
        pipClickSound: game.settings.get(MODULE_ID, 'pipClickSound') || '',
        pipClickVolume: game.settings.get(MODULE_ID, 'pipClickVolume') ?? 0.8,
        chatImage: game.settings.get(MODULE_ID, 'chatImage'),
        textMax: game.settings.get(MODULE_ID, 'textMax') || 'MAXIMUM REACHED',
        textDepleted: game.settings.get(MODULE_ID, 'textDepleted') || 'DEPLETED',
        hideFromPlayers: game.settings.get(MODULE_ID, 'hideFromPlayers') || false
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

function _getRules() {
    try {
        return JSON.parse(game.settings.get(MODULE_ID, 'trackerRules') || '[]');
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

async function _evaluateRules(actor, oldValue, newValue, effectiveMax) {
    return _evaluateRulesInternal(actor, oldValue, newValue, effectiveMax, _getRules(), RULE_TARGET_MAP);
}

async function _evaluateAdvRules(actor, oldValue, newValue, effectiveMax) {
    return _evaluateRulesInternal(actor, oldValue, newValue, effectiveMax, _getAdvRules(), ADV_RULE_TARGET_MAP);
}

async function _refreshAllSheets() {
    const settings = _getSettings();

    // Data Consistency: Clamp values if Max was reduced (GM Only)
    if (game.user.isGM) {
        const linkedActors = new Set(game.users.map(u => u.character).filter(a => a));

        for (const actor of linkedActors) {
            if (actor.type !== 'character') continue;

            const current = actor.getFlag(MODULE_ID, FLAG_KEY) ?? 0;
            const effectiveMax = _getActorMax(actor, settings.max);

            if (current > effectiveMax) {
                await actor.setFlag(MODULE_ID, FLAG_KEY, effectiveMax);
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

function _getActorMax(actor, globalMax) {
    const modifier = actor.getFlag(MODULE_ID, 'maxModifier') ?? 0;
    return Math.max(1, globalMax + modifier);
}

function _isTrackerVisibleForUser(actor) {
    const mode = actor.getFlag(MODULE_ID, 'visibilityMode') ?? 'inherit';
    // GM visibility is controlled independently via the gmHidden flag so the GM can
    // hide individual trackers from their own view without affecting player visibility.
    if (game.user.isGM) return !actor.getFlag(MODULE_ID, 'gmHidden');
    if (mode === 'visible') return true;
    if (mode === 'hidden') return false;
    return !game.settings.get(MODULE_ID, 'hideFromPlayers');
}

/* -------------------------------------------- */
/* Hooks: Creation and Rendering                */
/* -------------------------------------------- */

Hooks.on('preCreateActor', (actor, _data, _options, _userId) => {
    if (actor.type === 'character') {
        const settings = _getSettings();
        const initialValue = settings.inverted ? settings.max : 0;
        actor.updateSource({
            [`flags.${MODULE_ID}.${FLAG_KEY}`]: initialValue
        });
    } else if (actor.type === 'adversary') {
        const advSettings = _getAdvSettings();
        const initialValue = advSettings.inverted ? advSettings.max : 0;
        actor.updateSource({
            [`flags.${MODULE_ID}.${ADV_FLAG_KEY}`]: initialValue
        });
    }
});

const renderHook = (app, _html) => {
    const actor = app.document;
    if (!actor || actor.type !== 'character') return;
    if (!_isTrackerVisibleForUser(actor)) return;
    requestAnimationFrame(() => _injectAttribute(app.element, actor));
};

Hooks.on('renderCharacterSheet', renderHook);
// DaggerheartPlus Module Support: Hook to render the tracker on the DH+ character sheet
Hooks.on('renderDaggerheartPlusCharacterSheet', renderHook);
Hooks.on('renderActorSheet', (app, _html) => {
    const actor = app.document;
    if (!actor || actor.type !== 'character') return;
    // Normalize: v1 Application passes a jQuery wrapper, ApplicationV2 passes HTMLElement.
    const el = (app.element instanceof HTMLElement) ? app.element : app.element?.[0];
    if (!el) return;
    if (!el.querySelector('.character-row') && !el.querySelector('.core-stats')) return;
    if (!_isTrackerVisibleForUser(actor)) return;
    requestAnimationFrame(() => _injectAttribute(el, actor));
});

// Adversary Sheet Support (ApplicationV2 — fires renderAdversarySheet, not renderActorSheet)
Hooks.on('renderAdversarySheet', (app, _html) => {
    const actor = app.document;
    if (!actor || actor.type !== 'adversary') return;
    if (!game.user.isGM) return;
    if (game.settings.get(MODULE_ID, 'hideAdversaryTracker')) return;
    requestAnimationFrame(() => _injectAdversaryAttribute(app.element, actor));
});

// Sleek UI Module Support
Hooks.on('renderSleekCharacterSheet', (app, _html) => {
    const actor = app.document;
    if (!actor || actor.type !== 'character') return;
    if (!_isTrackerVisibleForUser(actor)) return;
    requestAnimationFrame(() => _injectAttributeSleekUI(app.element, actor));
});

/* -------------------------------------------- */
/* DOM Injection Logic                          */
/* -------------------------------------------- */

function _injectAttribute(form, actor) {
    if (!form || !actor) return;

    const settings = _getSettings();
    const current = actor.getFlag(MODULE_ID, FLAG_KEY) ?? 0;
    const effectiveMax = _getActorMax(actor, settings.max);

    let targetContainer = null;
    let insertionPoint = null;
    let layoutType = 'standard';
    let insertMethod = 'append';

    // 1. Try Standard Sheet
    const characterRow = form.querySelector('.character-row');
    if (characterRow) {
        targetContainer = characterRow.parentElement; 
        layoutType = 'standard';
        insertionPoint = characterRow;
        insertMethod = 'after'; 
    } 
    // 2. Try DH+ Sheet
    // DaggerheartPlus Module Support: Detects the specific header structure of the DH+ sheet to inject the tracker
    else {
        const headerMain = form.querySelector('.header-main-section');
        if (headerMain) {
            targetContainer = headerMain.parentElement;
            layoutType = 'dhplus';
            insertionPoint = headerMain;
            insertMethod = 'after';
        }
    }

    if (!targetContainer) return;

    const existingSection = targetContainer.querySelector(`.dh-new-stat-tracker-section`);

    // Force Rebuild check (render optimization)
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

        // If nothing changed, only visually update the pips
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

    // Full Rebuild
    const newSection = _buildAttributeSection(current, actor.isOwner, layoutType, settings, effectiveMax);
    _attachListeners(newSection, actor, effectiveMax);

    if (existingSection && existingSection.isConnected) {
        existingSection.replaceWith(newSection);
    } else {
        if (insertMethod === 'after' && insertionPoint) {
            insertionPoint.insertAdjacentElement('afterend', newSection);
        } else if (insertMethod === 'prepend') {
            targetContainer.prepend(newSection);
        } else {
            targetContainer.appendChild(newSection);
        }
    }
}

//Sleek UI Injector
function _injectAttributeSleekUI(form, actor) {
    if (!form || !actor) return;

    const settings = _getSettings();
    const current = actor.getFlag(MODULE_ID, FLAG_KEY) ?? 0;
    const effectiveMax = _getActorMax(actor, settings.max);

    // Target the .favorites div inside .sidebar-content
    const favoritesEl = form.querySelector('.sidebar-content .favorites');
    if (!favoritesEl) return;

    const existingSection = form.querySelector('.dh-new-stat-tracker-section--sleek');

    // Force Rebuild check
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
        existingSection.remove();
    }

    const newSection = _buildAttributeSection(current, actor.isOwner, 'sleek', settings, effectiveMax);
    _attachListeners(newSection, actor, effectiveMax);

    // Insert before .favorites so it sits between portrait and the equipment list
    favoritesEl.insertAdjacentElement('beforebegin', newSection);
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
    // DaggerheartPlus Module Support: Generates a specific layout (Label + Pips) for the DH+ sheet
    if (layout === 'dhplus') {
        const labelDiv = document.createElement('div');
        labelDiv.classList.add('stat-label');
        labelDiv.textContent = settings.name;
        contentWrapper.appendChild(labelDiv);

        const pipsDiv = document.createElement('div');
        pipsDiv.classList.add('attribute-pips');
        _renderPips(pipsDiv, effectiveMax, current, canInteract, settings.icon);
        contentWrapper.appendChild(pipsDiv);
    } else if (layout === 'sleek') {
        const labelDiv = document.createElement('div');
        labelDiv.classList.add('stat-label');
        labelDiv.textContent = settings.name;
        contentWrapper.appendChild(labelDiv);

        const pipsWrapper = document.createElement('div');
        pipsWrapper.classList.add('attribute-pips-wrapper');

        const PIPS_PER_ROW = 8;
        for (let rowStart = 1; rowStart <= effectiveMax; rowStart += PIPS_PER_ROW) {
            const rowEnd = Math.min(rowStart + PIPS_PER_ROW - 1, effectiveMax);
            const rowDiv = document.createElement('div');
            rowDiv.classList.add('attribute-pips');
            _renderPips(rowDiv, rowEnd, current, canInteract, settings.icon, rowStart);
            pipsWrapper.appendChild(rowDiv);
        }
        contentWrapper.appendChild(pipsWrapper);

    } else {
        const label = document.createElement('h4');
        label.textContent = settings.name;
        contentWrapper.appendChild(label);
        
        // Wrapper for pips in standard layout for consistency
        const pipsContainer = document.createElement('div');
        pipsContainer.classList.add('attribute-pips');
        pipsContainer.style.display = 'flex';
        pipsContainer.style.gap = '4px';
        _renderPips(pipsContainer, effectiveMax, current, canInteract, settings.icon);
        contentWrapper.appendChild(pipsContainer);
    }
    
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

function _attachListeners(section, actor, maxValue) {
    const settings = _getSettings();
    const canInteract = settings.gmOnly ? game.user.isGM : actor.isOwner;

    if (!canInteract) return;

    section.addEventListener('click', async (event) => {
        const pip = event.target.closest('.attribute-pip');
        if (!pip) return;
        event.preventDefault();
        event.stopPropagation();

        const clicked = parseInt(pip.dataset.value);
        const current = actor.getFlag(MODULE_ID, FLAG_KEY) ?? 0;
        const newValue = Math.max(0, Math.min(maxValue, (current === clicked) ? clicked - 1 : clicked));

        const s = _getSettings();
        const isAlertState = s.inverted ? (newValue === 0) : (newValue >= maxValue);
        if (s.pipClickSound && !isAlertState) {
            foundry.audio.AudioHelper.play({src: s.pipClickSound, volume: s.pipClickVolume, autoplay: true, loop: false}, false);
        }

        _previousValues.set(actor.id, current);
        await actor.setFlag(MODULE_ID, FLAG_KEY, newValue);
    });

    section.addEventListener('contextmenu', async (event) => {
        const pip = event.target.closest('.attribute-pip');
        if (!pip) return;
        event.preventDefault();
        event.stopPropagation();
        const current = actor.getFlag(MODULE_ID, FLAG_KEY) ?? 0;
        const newValue = Math.max(0, current - 1);

        const s = _getSettings();
        const isAlertState = s.inverted ? (newValue === 0) : (newValue >= maxValue);
        if (s.pipClickSound && !isAlertState) {
            foundry.audio.AudioHelper.play({src: s.pipClickSound, volume: s.pipClickVolume, autoplay: true, loop: false}, false);
        }

        _previousValues.set(actor.id, current);
        await actor.setFlag(MODULE_ID, FLAG_KEY, newValue);
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

    // --- Character Tracker ---
    const newValue = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${FLAG_KEY}`);
    if (newValue === undefined) return;

    const settings = _getSettings();
    const effectiveMax = _getActorMax(actor, settings.max);

    // Evaluate rules using the stored previous value
    const oldValue = _previousValues.get(actor.id) ?? 0;
    _previousValues.delete(actor.id);
    if (oldValue !== newValue) {
        await _evaluateRules(actor, oldValue, newValue, effectiveMax);
    }
    let isAlertState = false;
    let statusText = "";
    let valueDisplay = String(newValue);

    // Determine Alert Logic
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

        const content = _createCardContent(
            settings.name.toUpperCase(), 
            actor.name, 
            valueDisplay, 
            statusText, 
            "#ff0000",
            settings.chatImage
        );

        ChatMessage.create({
            content: content,
            whisper: ChatMessage.getWhisperRecipients('GM')
        });

        return; // Don't send verbose message if we sent alert
    }

    // 2. Verbose Mode
    if (settings.verbose) {
        const content = _createCardContent(
            settings.name.toUpperCase(), 
            actor.name, 
            valueDisplay, 
            "UPDATED", 
            "#00b0ff", 
            settings.chatImage
        );

        ChatMessage.create({
            content: content,
            whisper: ChatMessage.getWhisperRecipients('GM')
        });
    }
});

// ... TrackerStatusApp and TrackerConfigApp application classes remain unchanged ...
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
        const settings = _getSettings();
        const users = game.users.filter(u => !u.isGM && u.character);
        
        const trackers = users.map(u => {
            const actor = u.character;
            const current = actor.getFlag(MODULE_ID, FLAG_KEY) ?? 0;
            const effectiveMax = _getActorMax(actor, settings.max);
            const visibilityMode = actor.getFlag(MODULE_ID, 'visibilityMode') ?? 'inherit';
            const gmHidden = actor.getFlag(MODULE_ID, 'gmHidden') ?? false;
            return {
                actorId: actor.id,
                actorName: actor.name,
                userName: u.name,
                value: current,
                max: effectiveMax,
                visibilityMode,
                gmHidden
            };
        });

        return {
            trackers,
            settings
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

    async _onAdjust(event) {
        event.preventDefault();
        const btn = event.currentTarget;
        const actorId = btn.dataset.actorId;
        const action = btn.dataset.action;
        
        const actor = game.actors.get(actorId);
        if (!actor) return;

        const settings = _getSettings();
        const current = actor.getFlag(MODULE_ID, FLAG_KEY) ?? 0;
        const effectiveMax = _getActorMax(actor, settings.max);
        let newValue = current;

        if (action === 'increase') newValue++;
        else if (action === 'decrease') newValue--;

        // Clamp value
        newValue = Math.max(0, Math.min(effectiveMax, newValue));

        _previousValues.set(actor.id, current);
        await actor.setFlag(MODULE_ID, FLAG_KEY, newValue);
        this.render();
    }

    _onConfig(event) {
        event.preventDefault();
        const btn = event.currentTarget;
        const actorId = btn.dataset.actorId;
        new TrackerConfigApp(actorId).render(true);
    }

    async _onToggleVisibility(event) {
        event.preventDefault();
        const btn = event.currentTarget;
        const actorId = btn.dataset.actorId;
        const actor = game.actors.get(actorId);
        if (!actor) return;

        const current = actor.getFlag(MODULE_ID, 'visibilityMode') ?? 'inherit';
        // Cycle player visibility: inherit → visible → hidden → inherit
        const next = current === 'inherit' ? 'visible' : current === 'visible' ? 'hidden' : 'inherit';
        await actor.setFlag(MODULE_ID, 'visibilityMode', next);
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
        const btn = event.currentTarget;
        const actorId = btn.dataset.actorId;
        const actor = game.actors.get(actorId);
        if (!actor) return;

        const current = actor.getFlag(MODULE_ID, 'gmHidden') ?? false;
        await actor.setFlag(MODULE_ID, 'gmHidden', !current);
        this.render();
    }
}

class TrackerConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actorId, options={}) {
        super(options);
        this.actorId = actorId;
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
        const settings = _getSettings();
        const modifier = actor?.getFlag(MODULE_ID, 'maxModifier') ?? 0;
        
        return {
            actorName: actor?.name || "Unknown",
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
        const settings = _getSettings();
        let modifier = actor.getFlag(MODULE_ID, 'maxModifier') ?? 0;

        if (action === 'increase') modifier++;
        else if (action === 'decrease') modifier--;

        const newEffectiveMax = settings.max + modifier;
        if (newEffectiveMax < 1) return;
        if (action === 'increase' && newEffectiveMax > MAX_POSSIBLE_VALUE) return;

        await actor.setFlag(MODULE_ID, 'maxModifier', modifier);

        const current = actor.getFlag(MODULE_ID, FLAG_KEY) ?? 0;
        if (current > newEffectiveMax) {
            await actor.setFlag(MODULE_ID, FLAG_KEY, newEffectiveMax);
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
     * Updates the tracker value of the currently selected actor.
     * @param {object} param - Object with a `value` property (number to add/subtract).
     * @example DHStatTracker.updateActor({value: 1});   // adds 1
     * @example DHStatTracker.updateActor({value: -1});  // removes 1
     */
    updateActor: async ({ value } = {}) => {
        // Validate argument
        if (value === undefined || value === null || typeof value !== 'number' || !Number.isInteger(value)) {
            ui.notifications.error("DHStatTracker.updateActor() requires an object with an integer 'value' property. Example: {value: 1}");
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
        const current = actor.getFlag(MODULE_ID, FLAG_KEY);
        if (current === undefined || current === null) {
            ui.notifications.warn(`Actor "${actor.name}" does not have a tracker flag set.`);
            return;
        }

        // Permission check
        const settings = _getSettings();
        const canInteract = settings.gmOnly ? game.user.isGM : actor.isOwner;
        if (!canInteract) {
            ui.notifications.warn("You do not have permission to modify this tracker.");
            return;
        }

        const effectiveMax = _getActorMax(actor, settings.max);
        const newValue = Math.max(0, Math.min(effectiveMax, current + value));

        if (newValue === current) {
            const reason = value > 0 ? "already at maximum" : "already at minimum";
            ui.notifications.info(`Tracker for "${actor.name}" is ${reason} (${current}).`);
            return;
        }

        _previousValues.set(actor.id, current);
        await actor.setFlag(MODULE_ID, FLAG_KEY, newValue);
    }
};

