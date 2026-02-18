/**
 * Configurações, Constantes e Definições Estáticas
 * Responsável por:
 * 1. Definir constantes globais do módulo.
 * 2. Registrar settings no Foundry VTT.
 * 3. Gerenciar o Menu de Configurações (UI).
 * 4. Integrações com a UI do Sistema (Botões de Menu).
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Constantes Exportadas
export const MODULE_ID = 'dh-new-stat-tracker';
export const FLAG_KEY  = 'value';
export const MAX_POSSIBLE_VALUE = 15;

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

// Helper para gerar lista de ícones para o select
function _getIconChoices() {
    return AVAILABLE_ICONS.reduce((acc, icon) => {
        const value = icon;
        const label = !icon ? "Default (Skull)" : icon.replace('fa-solid fa-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        acc.push({ value, label });
        return acc;
    }, []);
}

/**
 * Aplicação de Menu para configurações completas
 */
class TrackerSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    // Callback estático para disparar refresh ao salvar
    static onSaveCallback = null;

    static DEFAULT_OPTIONS = {
        id: "tracker-settings-app",
        tag: "form",
        window: { title: "Tracker Configuration", resizable: true },
        position: { width: 520, height: 600 }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/settings-menu.hbs` }
    };

    async _prepareContext(_options) {
        return {
            // Core Settings
            attributeName: game.settings.get(MODULE_ID, 'attributeName'),
            attributeMax: game.settings.get(MODULE_ID, 'attributeMax'),
            attributeInverted: game.settings.get(MODULE_ID, 'attributeInverted'),
            attributeColor: game.settings.get(MODULE_ID, 'attributeColor'),
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
            
            // Helpers
            iconChoices: _getIconChoices(),
            maxPossible: MAX_POSSIBLE_VALUE
        };
    }

    _onRender(context, options) {
        // --- TAB SWITCHING LOGIC ---
        const navItems = this.element.querySelectorAll('.tracker-nav .item');
        const tabItems = this.element.querySelectorAll('.tab-content .tab');

        navItems.forEach(nav => {
            nav.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = nav.dataset.tab;

                // Update Nav State
                navItems.forEach(n => n.classList.toggle('active', n.dataset.tab === targetTab));
                
                // Update Content State
                tabItems.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
            });
        });

        // --- CUSTOM BACKGROUND TOGGLE LOGIC ---
        const bgToggle = this.element.querySelector('input[name="enableCustomBackground"]');
        const bgPickerContainer = this.element.querySelector('.custom-bg-picker-container');

        if (bgToggle && bgPickerContainer) {
            const updateVisibility = () => {
                bgPickerContainer.classList.toggle('visible', bgToggle.checked);
            };
            updateVisibility();
            bgToggle.addEventListener('change', updateVisibility);
        }

        // --- CUSTOM BORDER TOGGLE LOGIC ---
        const borderToggle = this.element.querySelector('input[name="enableCustomBorder"]');
        const borderPickerContainer = this.element.querySelector('.custom-border-picker-container');

        if (borderToggle && borderPickerContainer) {
            const updateBorderVisibility = () => {
                borderPickerContainer.classList.toggle('visible', borderToggle.checked);
            };
            updateBorderVisibility();
            borderToggle.addEventListener('change', updateBorderVisibility);
        }

        // File Pickers
        this.element.querySelectorAll('button.file-picker').forEach(btn => {
            btn.addEventListener('click', event => {
                event.preventDefault();
                const target = event.currentTarget.dataset.target;
                const type = event.currentTarget.dataset.type || "image";
                const input = this.element.querySelector(`input[name="${target}"]`);
                new foundry.applications.apps.FilePicker.implementation({
                    type: type,
                    current: input.value,
                    callback: path => { input.value = path; }
                }).render(true);
            });
        });

        // Range Display
        const rangeInput = this.element.querySelector('input[name="attributeVolume"]');
        const rangeDisplay = this.element.querySelector('.volume-display');
        if (rangeInput && rangeDisplay) {
            rangeInput.addEventListener('input', (e) => {
                rangeDisplay.textContent = e.target.value;
            });
        }

        const pipRangeInput = this.element.querySelector('input[name="pipClickVolume"]');
        const pipRangeDisplay = this.element.querySelector('.pip-volume-display');
        if (pipRangeInput && pipRangeDisplay) {
            pipRangeInput.addEventListener('input', (e) => {
                pipRangeDisplay.textContent = e.target.value;
            });
        }

        // Form Submission
        this.element.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            // Core
            await game.settings.set(MODULE_ID, 'attributeName', formData.get('attributeName'));
            await game.settings.set(MODULE_ID, 'attributeMax', parseInt(formData.get('attributeMax')));
            await game.settings.set(MODULE_ID, 'attributeInverted', formData.get('attributeInverted') === 'on');
            await game.settings.set(MODULE_ID, 'attributeColor', formData.get('attributeColor'));
            await game.settings.set(MODULE_ID, 'attributeIcon', formData.get('attributeIcon'));
            
            // Background
            await game.settings.set(MODULE_ID, 'enableCustomBackground', formData.get('enableCustomBackground') === 'on');
            await game.settings.set(MODULE_ID, 'customBackgroundColor', formData.get('customBackgroundColor'));
            // Border
            await game.settings.set(MODULE_ID, 'enableCustomBorder', formData.get('enableCustomBorder') === 'on');
            await game.settings.set(MODULE_ID, 'customBorderColor', formData.get('customBorderColor'));

            await game.settings.set(MODULE_ID, 'attributeSound', formData.get('attributeSound'));
            await game.settings.set(MODULE_ID, 'attributeVolume', parseFloat(formData.get('attributeVolume')));
            await game.settings.set(MODULE_ID, 'pipClickSound', formData.get('pipClickSound'));
            await game.settings.set(MODULE_ID, 'pipClickVolume', parseFloat(formData.get('pipClickVolume')));

            // Chat
            await game.settings.set(MODULE_ID, 'attributeVerbose', formData.get('verbose') === 'on');
            await game.settings.set(MODULE_ID, 'chatImage', formData.get('chatImage'));
            await game.settings.set(MODULE_ID, 'textMax', formData.get('textMax'));
            await game.settings.set(MODULE_ID, 'textDepleted', formData.get('textDepleted'));

            this.close();
            
            if (TrackerSettingsApp.onSaveCallback) {
                TrackerSettingsApp.onSaveCallback();
            }
        });
    }
}

/**
 * Registra o botão no menu lateral do sistema Daggerheart.
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
 * Registra todas as configurações do módulo.
 * @param {Function} refreshCallback - Função a ser chamada quando configurações visuais mudam.
 */
export function registerModuleSettings(refreshCallback) {
    TrackerSettingsApp.onSaveCallback = refreshCallback;

    // --- CORE SETTINGS (Hidden from standard menu) ---
    const hiddenSettings = [
        ['attributeName', String, 'Despair'],
        ['attributeMax', Number, 6],
        ['attributeInverted', Boolean, false],
        ['attributeIcon', String, 'fa-solid fa-skull'],
        ['attributeColor', String, '#e54e4e'],
        // Background Settings
        ['enableCustomBackground', Boolean, false],
        ['customBackgroundColor', String, '#18162e'],
        // Border Settings
        ['enableCustomBorder', Boolean, false],
        ['customBorderColor', String, '#f3c267'],
        
        ['attributeSound', String, 'modules/dh-new-stat-tracker/assets/sfx/fear.mp3'],
        ['attributeVolume', Number, 0.9],
        ['pipClickSound', String, 'modules/dh-new-stat-tracker/assets/sfx/pipchange.mp3'],
        ['pipClickVolume', Number, 0.8],
        ['attributeVerbose', Boolean, false],
        ['chatImage', String, `modules/${MODULE_ID}/assets/chat-messages/skull.webp`],
        ['textMax', String, 'MAXIMUM REACHED'],
        ['textDepleted', String, 'DEPLETED']
    ];

    hiddenSettings.forEach(([key, type, defaultValue]) => {
        game.settings.register(MODULE_ID, key, {
            scope: 'world',
            config: false,
            type: type,
            default: defaultValue,
            onChange: refreshCallback
        });
    });

    // --- VISIBLE SETTINGS (Standard menu) ---
    game.settings.register(MODULE_ID, 'gmOnly', {
        name: 'GM Only Mode',
        hint: 'If checked, only the GM can modify tracker values directly on the sheet.',
        scope: 'world',
        config: true, 
        type: Boolean,
        default: false,
        onChange: refreshCallback
    });

    // --- MENU BUTTON ---
    game.settings.registerMenu(MODULE_ID, 'trackerSettingsMenu', {
        name: 'Configuration',
        label: 'Open Tracker Settings',
        hint: 'Configure attributes, visuals, sounds, and chat notifications.',
        icon: 'fas fa-cogs',
        type: TrackerSettingsApp,
        restricted: true
    });
}