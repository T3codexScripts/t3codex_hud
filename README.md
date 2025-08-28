 _____ _____  ____          _           
|_   _|___ / / ___|___   __| | _____  __
  | |   |_ \| |   / _ \ / _` |/ _ \ \/ /
  | |  ___) | |__| (_) | (_| |  __/>  < 
  |_| |____/ \____\___/ \__,_|\___/_/\_\

# t3codex\_hud

A **custom zombie-apocalypse themed HUD** for QBCore servers.
This script provides a gritty, survival-style interface with custom images for **health, hunger, thirst, and oxygen**. It also features a compass bar with street names and direction display, all positioned neatly next to the minimap.

---

## ✨ Features

* 🧟 **Zombie-apocalypse styled HUD**

  * Old, worn-out visuals with custom icons.

* ❤️ **Vital Stats Display**

  * **Health** (0–100)
  * **Hunger** (from `core_inventory` metadata)
  * **Thirst** (from `core_inventory` metadata)
  * **Oxygen/Lungs** (underwater breath meter)

* 🧭 **Compass System**

  * Shows current **direction (N, E, S, W)**
  * Displays current **street name**

* 📍 **HUD Placement**

  * Moved to sit neatly **beside the minimap**.

* ⚙️ **Configurable**

  * Toggle options via `config.lua`
  * Easy to adjust position, scale, and debug.

---

## 📂 File Structure

```
t3codex_hud/
│── fxmanifest.lua        # Resource manifest  
│── config.lua            # Configurations (toggle, scaling, etc.)  
│── client/  
│   └── main.lua          # Main HUD client logic  
│── nui/  
│   │── index.html        # NUI HTML  
│   │── style.css         # Custom apocalypse-themed CSS  
│   └── script.js         # NUI frontend logic  
```

---

## ⚡ Installation

1. Drag the `t3codex_hud` folder into your `resources/` folder.
2. Add the following line to your `server.cfg`:

   ```
   ensure t3codex_hud
   ```
3. Start/restart your server.

---

## 🔧 Configuration

Open `config.lua` to adjust:

* HUD toggle (enable/disable parts of the HUD)
* Icon images (replace with your own if desired)
* Position and scaling values
* Debug overlay

---

## 🛠 Dependencies

* [QBCore Framework](https://github.com/qbcore-framework)
* `core_inventory` (for hunger/thirst metadata)
* `ox_lib` (for notifications / utilities)

---

## 📸 Preview

🧟 HUD includes:

* **Health icon** (damaged heart)
* **Hunger icon** (rotten food)
* **Thirst icon** (dirty water bottle)
* **Oxygen icon** (lungs)
* Compass and street name bar

*(Replace this with actual screenshots once HUD is in-game.)*

---

## 🧾 Credits

Developed by **t3codex** for the TwilightZombies project.
Zombie theme design and icons created to match the apocalyptic survival aesthetic.

---
