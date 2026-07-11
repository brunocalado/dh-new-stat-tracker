# Daggerheart: Custom Stat Tracker

A configurable custom attribute tracker for character/adversary sheets.

<p align="center">
  <img width="700" src="docs/preview.webp">
</p>

[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-Donate-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/mestredigital) [![More Modules](https://img.shields.io/badge/Foundry%20VTT-More%20Modules-red?style=for-the-badge&logo=gamepad)](https://mestredigital.online/pages/projetos-en)

# Features

*   **Up to Two Custom Stat Trackers:** Add one or two fully configurable resources (like Despair, Sanity, or Corruption) to character sheets. Each tracker is independent and can be enabled or disabled on its own. Tracker 1 is enabled by default; Tracker 2 is disabled by default. When both are enabled, they are stacked one below the other on the sheet.
*   **Visual Customization:** Choose from over 60 icons, custom colors, and backgrounds — per tracker.
*   **Immersive Feedback:** Plays sounds and sends chat alerts when values change or reach limits.
*   **GM Dashboard:** A central menu for GMs to monitor and manage all players' stats, with separate controls for each enabled tracker.
*   **Adversary Support:** Dedicated tracker for Adversaries with independent settings.
*   **Automation Rules:** Trigger changes to HP, Stress, or other stats based on tracker events.
*   **Macro Support:** Update tracker values via macro.

> **Note:** Only the official Daggerheart character and adversary sheets are supported.

# How To 

You can open the Manager with the Menu Button.

<p align="center">
  <img width="700" src="docs/dhmenu.webp">
</p>

You can use a macro.

```js
DHStatTracker.openManager();
```

## Macro to Modify Actors

```js
DHStatTracker.updateActor({value: 1}); // Increments the tracker of the selected token by 1.
```

```js
DHStatTracker.updateActor({value: -1});  // Decrements the tracker of the selected token by 1.
```

By default the macro targets Tracker 1. Use the optional `tracker` property (`1` or `2`) to target the second tracker.

```js
DHStatTracker.updateActor({value: 1, tracker: 2}); // Increments Tracker 2 of the selected token by 1.
```

# Configuration

Navigate to **Settings** → **Configure Settings** → **Module Settings** → **Daggerheart: Custom Stat Tracker**

<p align="center">
  <img width="700" src="docs/settings.webp">
</p>

There you will find three configuration menus:

| Menu | Purpose |
| :--- | :--- |
| **Open Tracker 1 Settings** | Configures the first character tracker. Enabled by default. |
| **Open Tracker 2 Settings** | Configures the optional second character tracker. **Disabled by default** — turn on *Enable this Tracker* in the **Identity** tab to use it. |
| **Open Adversary Tracker Settings** | Configures the adversary tracker. |

Each character tracker has its own name, icon, colors, maximum value, sounds, chat alerts, visibility, and automation rules. To turn a tracker off completely, open its settings menu and disable the **Enable this Tracker** toggle in the **Identity** tab.

# Manual Installation

1. Copy this link:

```
 https://raw.githubusercontent.com/brunocalado/dh-new-stat-tracker/main/module.json

```
 
2. Open Foundry VTT.
3. Go to the **"Add-on Modules"** tab and click **"Install Module"**.
4. Paste the link into the **"Manifest URL"** box and click Install.

# License

* **Code License:** GNU GPLv3.

* **SFX:** This module uses the sound effects from Pixabay. The audio is provided under the Pixabay Content License, which grants a non-exclusive, worldwide, and royalty-free right to use, modify, and distribute the content for digital and commercial purposes. No attribution is legally required under these terms, but it is provided here for transparency and compliance. [fear](https://pixabay.com/pt/sound-effects/horror-quot-panic-fear-quot-sound-effect-479998/) and [pipchange](https://pixabay.com/pt/sound-effects/tecnologia-new-notification-032-480570/])

**Disclaimer:** This module is an independent creation and is not affiliated with Darrington Press.

**Disclaimer:** This is a fork from this [Link](https://github.com/Tristyn159/daggerheart-foundry-tools/tree/Main/modules/new-stat-tracker).

# 🧰 My Daggerheart Modules

| Module | Description |
| :--- | :--- |
| 💀 [**Adversary Manager**](https://github.com/brunocalado/daggerheart-advmanager) | Scale adversaries instantly and build balanced encounters in Foundry VTT. |
| 🌟 [**Best Modules**](https://github.com/brunocalado/dh-best-modules) | A curated collection of essential modules to enhance the Daggerheart experience. |
| 🐉 [**Colossus**](https://github.com/brunocalado/dh-colossus) | Manage massive multi-part boss encounters with independent HP per part and a single shared stress pool. |
| 💥 [**Critical**](https://github.com/brunocalado/daggerheart-critical) | Animated Critical. |
| 💠 [**Custom Stat Tracker**](https://github.com/brunocalado/dh-new-stat-tracker) | Add custom trackers to actors. |
| ☠️ [**Death Moves**](https://github.com/brunocalado/daggerheart-death-moves) | Enhances the Death Move moment with a dramatic interface and full automation. |
| 📏 [**Distances**](https://github.com/brunocalado/daggerheart-distances) | Visualizes combat ranges with customizable rings and hover calculations. |
| 📦 [**Extra Content**](https://github.com/brunocalado/daggerheart-extra-content) | Homebrew for Daggerheart. |
| 🤖 [**Resource Macros**](https://github.com/brunocalado/daggerheart-fear-macros) | Automatically executes macros when the Fear or Hope resources are changed. |
| 😱 [**Fear Tracker**](https://github.com/brunocalado/daggerheart-fear-tracker) | Adds an animated slider bar with configurable fear tokens to the UI. |
| 🧟 [**Horde**](https://github.com/brunocalado/dh-horde) | Explode single horde tokens into dozens of individual tokens and manage their movement and stats automatically. |
| 🎁 [**Mystery Box**](https://github.com/brunocalado/dh-mystery-box) | Introduces mystery box mechanics for random loot and surprises. |
| ⚡ [**Quick Actions**](https://github.com/brunocalado/daggerheart-quickactions) | Quick access to common mechanics like Falling Damage, Downtime, etc. |
| 📜 [**Quick Rules**](https://github.com/brunocalado/daggerheart-quickrules) | Fast and accessible reference guide for the core rules. |
| 🎲 [**Stats**](https://github.com/brunocalado/daggerheart-stats) | Tracks dice rolls from GM and Players. |
| 🧠 [**Stats Toolbox**](https://github.com/brunocalado/dh-statblock-importer) | Import using a statblock. |
| 🛒 [**Store**](https://github.com/brunocalado/daggerheart-store) | A dynamic, interactive, and fully configurable store for Foundry VTT. |
| 🔍 [**Unidentified**](https://github.com/brunocalado/dh-unidentified) | Obfuscates item names and descriptions until they are identified by the players. |

# 🗺️ Adventures

| Adventure | Description |
| :--- | :--- |
| ✨ [**I Wish**](https://github.com/brunocalado/i-wish-daggerheart-adventure) | A wealthy merchant is cursed; one final expedition may be the only hope. |
| 💣 [**Suicide Squad**](https://github.com/brunocalado/suicide-squad-daggerheart-adventure) | Criminals forced to serve a ruthless master in a land on the brink of war. |