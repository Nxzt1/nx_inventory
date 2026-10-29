# nx_inventory
<img width="2172" height="724" alt="image" src="https://github.com/user-attachments/assets/7e82d058-978a-4927-a990-7cda422f8dce" />

An inventory for FiveM with a React NUI. Drop-in replacement for ox_inventory: it answers the same
exports and events and uses the same database tables, so your other resources keep working
untouched. On QBCore it also answers qb-inventory's exports.

| Framework | Status |
|---|---|
| [Qbox](https://github.com/Qbox-project/qbx_core) | Supported |
| [QBCore](https://github.com/qbcore-framework/qb-core) | **Beta** |
| [ESX](https://github.com/esx-framework/esx_core) (es_extended 1.6+) | **Beta** |

> **Beta:** QBCore and ESX support has only been tested against simulated frameworks, not yet on a
> live server. Please report anything that breaks in
> [Issues](https://github.com/Nxzt1/nx_inventory/issues).

## Features

- The server decides everything: amounts, weight, price, distance, permissions and metadata.
- No loops while the inventory is closed; the ones that are needed (inventory open, weapon in hand,
  use progress bar) only run while they are in use.
- Batched saves in a single database transaction.
- Shops, stashes, trunks, gloveboxes, drops, weapons with attachments and ammo.
- Personal menu inside the inventory: clothing, frisking and putting players in vehicles, with
  per-group permissions.
- 128 px WebP images.

## Requirements

- FXServer with Node 22 and OneSync.
- [oxmysql](https://github.com/overextended/oxmysql).
- Qbox, QBCore or ESX.
- Optional: ox_target.

## Installation

1. Download `nx_inventory.zip` from [Releases](https://github.com/Nxzt1/nx_inventory/releases) and
   extract it into `resources`. It comes prebuilt: nothing to install.
2. Remove ox_inventory from `resources` (both cannot run at the same time).
3. On QBCore, also remove qb-inventory. On ESX, set `Config.CustomInventory = 'ox'` in es_extended.
4. **On Qbox**, edit qbx_core (see below).
5. Start nx_inventory after oxmysql and your framework. The console should print
   `listo: … framework <qbx|qb|esx>, idioma <language>`.

The framework is detected automatically. To force it: `set nx_inventory:framework "qbx"` (or `"qb"`,
`"esx"`).

### Qbox: one change in qbx_core

qbx_core's QBCore bridge loads ox_inventory's item list with `require '@ox_inventory.data.items'`.
That `require` reads the `ox_inventory` folder itself, so it fails once ox_inventory is removed
(`provide 'ox_inventory'` covers exports, not files). In these three lines, replace
`@ox_inventory.data.` with `@nx_inventory.data.`:

| File | Line |
|---|---|
| `qbx_core/bridge/qb/server/main.lua` | `convertItems(require '@ox_inventory.data.items', …)` |
| `qbx_core/bridge/qb/shared/main.lua` | `local oxItems = require '@ox_inventory.data.items'` |
| `qbx_core/bridge/qb/shared/main.lua` | `local oxWeapons = require '@ox_inventory.data.weapons'` |

If you don't use any QBCore resources you can instead turn the bridge off with
`setr qbx:enablebridge false`. nx_inventory prints a warning on start while these lines are unchanged.

### Coming from ox_inventory

Same database tables and format: no data migration, and you can switch back.

- **Your own items:** add them to `config/items.jsonc` (fields in INFORMACION.md) and their images to
  `web/images` as `<item>.webp`. To keep PNG images, set `"imageExt": "png"` in `config.jsonc`
  (one format for all of them).
- **Other resources' images:** anything that loads `nui://ox_inventory/web/images/<item>.png` will
  show broken icons. `nui://` paths use the real folder name, so change them to
  `nui://nx_inventory/web/images/<item>.webp`.

## Language

English and Spanish are included. The language comes from `nx_inventory:locale`, or from ox_lib's
`ox:locale` if that is not set, and falls back to English:

```cfg
setr nx_inventory:locale "en"
```

Use `setr` so clients get it too. To add a language, copy `locales/en.json` to
`locales/<code>.json` and translate it; missing keys stay in English. Labels in
`config/personal.jsonc` are plain config: edit them there.

## Configuration

Everything lives in `config/*.jsonc` and is applied with `restart nx_inventory`:

| File | Contents |
|---|---|
| `config.jsonc` | general settings, keys, permissions and integrations with other resources |
| `items.jsonc`, `weapons.jsonc` | items, weapons, attachments and ammo |
| `shops.jsonc`, `stashes.jsonc`, `vehicles.jsonc` | shops, stashes, trunks and gloveboxes |
| `personal.jsonc`, `animations.jsonc` | personal menu and use animations |

It ships with ox_inventory's configuration (its items and shops). Images go in `web/images` as
`<item>.webp`.

## API

Server exports (`exports.nx_inventory:<function>`): `addItem`, `removeItem`, `setItem`,
`canCarry`, `getItemCount`, `search`, `getSlot`, `getInventory`, `setMetadata`, `setDurability`,
`clearInventory`, `registerStash`, `registerItem`, `registerShop`, `registerHook`, `openFor`,
`isAuthorized`, `about`.

Client exports: `openInventory`, `closeInventory`, `isOpen`, `useSlot`, `getCurrentWeapon`,
`getItems`, `setStashTarget`, `registerItemButton`, `personalAction`.

Signatures, ox_inventory and qb-inventory compatibility and per-framework details are in
[INFORMACION.md](INFORMACION.md) (in Spanish).

## License

Copyright (C) 2026 Nxzt1. [GPL-3.0-or-later](LICENSE): you may use, modify and redistribute it, but
if you distribute a modified version you must publish its source under the same license and keep the
credits. Item data and images come from [ox_inventory](https://github.com/overextended/ox_inventory)
(Copyright (C) Overextended, GPL-3.0); see the credits section in INFORMACION.md. The Oswald font
is bundled under the [SIL Open Font License](OFL.txt).
