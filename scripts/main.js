/**
 * Lógica Principal (Runtime)
 * Responsável por:
 * 1. Hooks (Init, Render, Update, Create).
 * 2. Manipulação do DOM (Injeção na ficha).
 * 3. Lógica de Negócio (Updates, Cards de Chat).
 * 4. Aplicações Operacionais (Status e Config por Ator).
 */

import { MODULE_ID, FLAG_KEY, MAX_POSSIBLE_VALUE, registerModuleSettings, registerDaggerheartMenuButton } from './config.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* -------------------------------------------- */
/* Initialization                               */
/* -------------------------------------------- */

Hooks.once('init', () => {
    registerModuleSettings(_refreshAllSheets);
    registerDaggerheartMenuButton();
});

/* -------------------------------------------- */
/* Helpers de Runtime                          */
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
        textDepleted: game.settings.get(MODULE_ID, 'textDepleted') || 'DEPLETED'
    };
}

function _refreshAllSheets() {
    Object.values(ui.windows).forEach(app => {
        if (app.document?.documentName === 'Actor' && app.document?.type === 'character') {
            app.render(false);
        }
    });
}

function _getActorMax(actor, globalMax) {
    const modifier = actor.getFlag(MODULE_ID, 'maxModifier') ?? 0;
    return Math.max(1, globalMax + modifier);
}

/* -------------------------------------------- */
/* Hooks: Criação e Renderização                */
/* -------------------------------------------- */

Hooks.on('preCreateActor', (actor, _data, _options, _userId) => {
    if (actor.type !== 'character') return;

    const settings = _getSettings();
    const initialValue = settings.inverted ? settings.max : 0; 

    actor.updateSource({
        [`flags.${MODULE_ID}.${FLAG_KEY}`]: initialValue
    });
});

const renderHook = (app, _html) => {
    const actor = app.document;
    if (!actor || actor.type !== 'character') return;
    requestAnimationFrame(() => _injectAttribute(app.element, actor));
};

Hooks.on('renderCharacterSheet', renderHook);
Hooks.on('renderDaggerheartPlusCharacterSheet', renderHook);
Hooks.on('renderActorSheet', (app, html) => {
    if (app.document?.type === 'character' && 
       (app.element.find('.character-row').length || app.element.find('.core-stats').length)) {
       renderHook(app, html);
    }
});

/* -------------------------------------------- */
/* Lógica de Injeção no DOM                     */
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

    // Force Rebuild check (otimização de render)
    if (existingSection) {
        const renderedMax = parseInt(existingSection.dataset.max || 0);
        const renderedName = existingSection.dataset.name || '';
        const renderedIcon = existingSection.dataset.icon || '';
        const renderedColor = existingSection.style.getPropertyValue('--stat-color').trim();
        const renderedInverted = existingSection.dataset.inverted === 'true';
        const renderedGmOnly = existingSection.dataset.gmOnly === 'true';
        const renderedUseThemeBg = existingSection.dataset.enableCustomBackground === 'true';
        const renderedBgColor = existingSection.dataset.customBgColor || '';
        const renderedEnableCustomBorder = existingSection.dataset.enableCustomBorder === 'true';
        const renderedBorderColor = existingSection.dataset.customBorderColor || '';

        // Se nada mudou, apenas atualiza visualmente os pips
        if (renderedMax === effectiveMax &&
            renderedName === settings.name &&
            renderedIcon === settings.icon &&
            renderedColor === settings.color &&
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
    section.style.setProperty('--stat-bg', settings.enableCustomBackground ? settings.customBackgroundColor : '#18162e');
    section.style.setProperty('--stat-border', settings.enableCustomBorder ? settings.customBorderColor : '#f3c267');

    const canInteract = settings.gmOnly ? game.user.isGM : isOwner;

    // 1. Criar a Linha da Esquerda (Filler Line)
    const leftLine = document.createElement('div');
    leftLine.classList.add('dh-filler-line');
    section.appendChild(leftLine);

    // 2. Criar o Wrapper Central (Texto + Pips)
    // Isso é CRUCIAL para manter o conteúdo junto no meio enquanto as linhas esticam
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('dh-tracker-content-wrapper');

    // -- Lógica de Conteúdo --
    if (layout === 'dhplus') {
        const labelDiv = document.createElement('div');
        labelDiv.classList.add('stat-label');
        labelDiv.textContent = settings.name;
        contentWrapper.appendChild(labelDiv);

        const pipsDiv = document.createElement('div');
        pipsDiv.classList.add('attribute-pips');
        _renderPips(pipsDiv, effectiveMax, current, canInteract, settings.icon);
        contentWrapper.appendChild(pipsDiv);
    } else {
        const label = document.createElement('h4');
        label.textContent = settings.name;
        contentWrapper.appendChild(label);
        
        // Wrapper para pips no layout standard para consistência
        const pipsContainer = document.createElement('div');
        pipsContainer.classList.add('attribute-pips');
        pipsContainer.style.display = 'flex';
        pipsContainer.style.gap = '4px';
        _renderPips(pipsContainer, effectiveMax, current, canInteract, settings.icon);
        contentWrapper.appendChild(pipsContainer);
    }
    
    section.appendChild(contentWrapper);

    // 3. Criar a Linha da Direita (Filler Line)
    const rightLine = document.createElement('div');
    rightLine.classList.add('dh-filler-line');
    section.appendChild(rightLine);

    _updateMaxClass(section, current, effectiveMax, settings.inverted);
    return section;
}

function _renderPips(container, max, current, canInteract, iconClass) {
    const activeIcon = iconClass || 'fa-solid fa-skull'; 
    
    for (let i = 1; i <= max; i++) {
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

Hooks.on('updateActor', (actor, changes, _options, userId) => {
    // Only process update on the client that made the change
    if (game.user.id !== userId) return;

    const newValue = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${FLAG_KEY}`);
    if (newValue === undefined) return;

    const settings = _getSettings();
    const effectiveMax = _getActorMax(actor, settings.max);
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

// ... classes de aplicação TrackerStatusApp e TrackerConfigApp permanecem inalteradas ...
class TrackerStatusApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "tracker-status-app",
        tag: "form",
        window: {
            title: "Tracker Status",
            resizable: true
        },
        position: {
            width: 400,
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
            return {
                actorId: actor.id,
                actorName: actor.name,
                userName: u.name,
                value: current,
                max: effectiveMax
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
        
        await actor.setFlag(MODULE_ID, FLAG_KEY, newValue);
        this.render();
    }

    _onConfig(event) {
        event.preventDefault();
        const btn = event.currentTarget;
        const actorId = btn.dataset.actorId;
        new TrackerConfigApp(actorId).render(true);
    }
}

class TrackerConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actorId, options={}) {
        super(options);
        this.actorId = actorId;
    }

    static DEFAULT_OPTIONS = {
        id: "tracker-config-app",
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
        if (newEffectiveMax > MAX_POSSIBLE_VALUE) return;

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
    }
};