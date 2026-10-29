# nx_inventory: información

## Frameworks

El framework se detecta al arrancar (qbx_core, es_extended o qb-core, en ese orden) o se fija con
`set nx_inventory:framework "qbx" | "qb" | "esx"`.

| | Qbox | QBCore (beta) | ESX (beta) |
|---|---|---|---|
| Inventario del jugador | `players.inventory` | `players.inventory` | `users.inventory` |
| Maleteros y guanteras | `player_vehicles` (id) | `player_vehicles` (id por matrícula) | `owned_vehicles` (matrícula) |
| Alijos | `ox_inventory` | `ox_inventory` | `ox_inventory` |
| Dinero como objeto | `money` | `money` (= cash) | `money`, `black_money` |
| Grupos | trabajos y bandas | trabajo y banda | trabajo |
| Licencias de tienda | `metadata.licences` | `metadata.licences` | `user_licenses` (esx_license) |

- **QBCore:** nx_inventory atiende los exports de qb-inventory. Los objetos de `QBCore.Shared.Items`
  que no estén en `config/items.jsonc` se añaden al arrancar (las armas no: van en `weapons.jsonc`).
  El inventario de cada jugador se lee tal como lo dejó qb-inventory y se guarda en los dos
  formatos, así que se puede volver atrás. Los alijos y maleteros de la tabla `inventories` de
  qb-inventory no se migran.
- **ESX:** con `Config.CustomInventory = 'ox'`, ESX trata a nx_inventory como si fuera ox. Los
  inventarios antiguos de ESX (`{ nombre = cantidad }`) se convierten al cargarlos.
- Si faltan las columnas `trunk` y `glovebox` en la tabla de vehículos (QBCore, ESX), se crean al
  arrancar, como hacía ox.
- **Beta:** con QBCore y ESX está probado con los frameworks simulados, no todavía en un servidor real.

## Cambiar desde ox_inventory

Mismas tablas y mismo formato: no hay migración y se puede volver atrás.

1. Con el servidor parado, haz una copia de seguridad de la base de datos.
2. Saca ox_inventory de `resources` (moverlo, no borrarlo) y pon nx_inventory en su lugar.
3. Los recursos que pidan `nui://ox_inventory/web/images/<objeto>.png` deben pedir
   `nui://nx_inventory/web/images/<objeto>.webp`.
4. Objetos propios de ox: se añaden a `config/items.jsonc` (campos abajo) y su imagen a
   `web/images` como `<objeto>.webp` (o todas en PNG con `"imageExt": "png"` en `config.jsonc`).
5. Qbox: en qbx_core, cambiar `@ox_inventory.data.` por `@nx_inventory.data.` en
   `bridge/qb/server/main.lua` y `bridge/qb/shared/main.lua` (items y weapons). Ese `require` lee
   la carpeta real de ox_inventory y `provide` no lo cubre. Sin recursos de QBCore vale también
   `setr qbx:enablebridge false`. Mientras no se cambie, nx_inventory lo avisa al arrancar.

Para volver: quitar nx_inventory, devolver ox_inventory y deshacer los pasos 3 y 5.

## Idioma

Inglés y español. Se elige con `setr nx_inventory:locale "es"`; sin ella se usa `ox:locale` de
ox_lib y, si tampoco está, inglés. Otro idioma: copiar `locales/en.json` a `locales/<código>.json`
y traducirlo; lo que falte se queda en inglés. Los textos de `config/personal.jsonc` se cambian en
ese mismo archivo.

El manifiesto declara `version '2.47.9'` (la API de ox que imita) para que pasen las comprobaciones
de versión de otros recursos. `/nxinv` en F8 dice qué impide abrir el inventario.

## Campos de un objeto (config/items.jsonc)

| Campo | Qué |
|---|---|
| `label`, `description` | nombre y descripción |
| `weight` | peso en gramos |
| `stack`, `close` | si se apila (sí por defecto) y si usarlo cierra el inventario (sí por defecto) |
| `image` | imagen si no se llama como el objeto (sin extensión) |
| `consume` | cuánto gasta usarlo: 1 = uno entero, 0.3 = un 30 % de durabilidad, 0 = nada |
| `degrade` | minutos hasta estropearse; `decay` lo borra al llegar a 0 |
| `useTime`, `useLabel`, `cancel` | duración de la barra de uso, su texto y si se puede cancelar |
| `disable` | `{ move, car, combat, mouse, sprint }` bloqueados mientras se usa |
| `anim`, `prop` | animación y objeto en la mano (nombre de `animations.jsonc` o la definición) |
| `status` | cambios de estado al usarlo (`hunger`, `thirst`, `stress`…) |
| `notification` | aviso al usarlo |
| `allowArmed` | se puede usar con un arma en la mano |
| `clientExport`, `clientEvent`, `serverExport` | `recurso.función` o evento al que se llama al usarlo (como `client.export`, `client.event` y `server.export` de ox) |

## Integraciones

En `config.jsonc` → `integrations`, todas opcionales (vacío = no se usa):

| Campo | Qué |
|---|---|
| `notify` | recurso con export `show({ description, type })` para los avisos; sin él, avisos de GTA |
| `progress` | recurso con exports `show({ label, duration, resource })` y `hide(cancelado)` para la barra de uso |
| `textUiShow`, `textUiHide` | eventos locales del cliente para el [E] cuando no hay ox_target |
| `escortResource`, `escortWarpEvent`, `escortRemoveEvent` | recurso de policía cuyos eventos meten y sacan del coche |
| `restrainedStates` | statebags que cuentan como esposado o inconsciente |
| `personalActionEvent` | evento local para lanzar acciones del menú personal (`'clothes:<id>'` o `'action:<id>'`) |

## API de servidor

`exports.nx_inventory:<función>`. Un inventario se indica con el server id del jugador, el id del
inventario (texto) o `{ id, owner }` para alijos con dueño. Si el alijo está registrado pero no
cargado, la función devuelve una promesa (desde Lua, dentro de un hilo o evento, se espera sola).

| Función | Devuelve |
|---|---|
| `addItem(inv, nombre, cantidad, metadatos?, casilla?)` | `{ ok, slots }` o `{ ok: false, error }` |
| `removeItem(inv, nombre, cantidad, metadatos?, casilla?, estricto?)` | `{ ok, slots }` o error |
| `setItem(inv, nombre, cantidad)` | deja exactamente esa cantidad |
| `canCarry(inv, nombre, cantidad, metadatos?)` | `true`/`false` |
| `getItemCount(inv, nombre, metadatos?, estricto?)` | número |
| `search(inv, 'count' \| 'slots', nombre o lista, metadatos?)` | como `Search` de ox |
| `getSlot(inv, casilla)`, `getInventory(inv)` | casilla o inventario, o `null` |
| `setMetadata(inv, casilla, metadatos)`, `setDurability(inv, casilla, valor)` | `{ ok }` o error |
| `clearInventory(inv, conservar?)` | `true`/`false` |
| `registerStash({ name, label, slots, maxWeight, owner?, groups?, coords?, distance? })` | `{ ok }` |
| `registerItem(nombre, definición)`, `getItemDef(nombre)`, `getItemDefs()` | definiciones |
| `registerShop(tipo, tienda)` | tienda nueva |
| `registerHook(evento, función, opciones?)`, `removeHooks(id?)` | mismos eventos y filtros que ox |
| `openFor(jugador, inv)` | abre un inventario a un jugador sin comprobaciones |
| `isAuthorized(jugador)` | `true` si puede registrar, cargar, coger de rehén o esposar |
| `about()` | autor, licencia y repositorio |


## API de cliente

| Función | Qué hace |
|---|---|
| `openInventory(tipo?, id?)`, `closeInventory()`, `isOpen()` | abrir y cerrar |
| `useSlot(casilla)` | usar como con la barra rápida |
| `getCurrentWeapon()`, `getItems()` | arma en la mano, objetos del jugador |
| `setStashTarget(nombre?)` | la tecla secundaria abre ese alijo mientras esté puesto |
| `registerItemButton(objeto, texto, fn(casilla))` | botón propio en el panel de acciones del objeto |
| `personalAction('clothes:<id>' \| 'action:<id>')` | acción del menú personal |

Eventos de cliente: `nx_inventory:currentWeapon`, `nx_inventory:usedItem`, `nx_inventory:updateInventory`.

## Compatibilidad con ox_inventory

FiveM resuelve cada export como el evento `__cfx_export_<recurso>_<nombre>`; nx_inventory responde
a los de `ox_inventory`.

**Servidor:** `AddItem`, `RemoveItem`, `SetItem`, `GetItemCount`, `CanCarryItem`, `CanCarryWeight`,
`Search`, `GetSlot`, `GetSlotWithItem`, `GetSlotsWithItem`, `GetInventory`, `GetInventoryItems`,
`Items`, `SetMetadata`, `SetDurability`, `ClearInventory`, `RegisterStash`, `RegisterShop`,
`forceOpenInventory`, `registerHook`, `removeHooks`, `CustomDrop`, `GetCurrentWeapon`,
`ConfiscateInventory`, `ReturnInventory` y, con ESX, `setPlayerInventory`.

**Cliente:** `Search`, `GetItemCount`, `GetPlayerItems`, `Items`, `getCurrentWeapon`,
`openInventory`, `closeInventory`, `useItem`, `displayMetadata`, `setStashTarget`.

**Eventos:** emite `ox_inventory:updateInventory`, `itemCount`, `currentWeapon`, `usedItem` y
`updateWeaponComponent`; escucha `ox_inventory:disarm`, `openInventory`, `closeInventory` e
`itemNotify`. Statebags con los nombres de ox: `invBusy`, `invHotkeys`, `canUseWeapons`, `invOpen`,
`canSteal`, `dead`, y además `nxGroups`.

**Diferencias:**

- `AddItem`/`RemoveItem` devuelven solo `true`/`false`: un export de JS no puede devolver el motivo
  como segundo valor (el callback de `AddItem` sí lo recibe).
- Si se reinicia nx_inventory con el servidor en marcha, los recursos en Lua que ya habían llamado a
  un export de ox_inventory conservan la referencia vieja hasta reiniciarlos.
- No están: licencias que se compran en un punto, taquillas de evidencias, contenedores dentro de
  objetos, basureros y crafting de ox, precios aleatorios de tienda, `UpdateVehicle` y los
  metadatos automáticos de `identification` y `garbage`.

## Compatibilidad con qb-inventory (QBCore)

**Servidor:** `AddItem`, `RemoveItem`, `HasItem`, `GetItemCount`, `GetItemByName`, `GetItemsByName`,
`GetItemBySlot`, `GetSlotsByItem`, `GetFirstSlotByItem`, `CanAddItem`, `GetFreeWeight`,
`GetTotalWeight`, `ClearInventory`, `SetItemData`, `OpenInventory`, `OpenInventoryById`,
`CreateShop`, `OpenShop`. `LoadInventory` y `SaveInventory` no hacen nada: carga y guarda
nx_inventory. Las casillas salen con `amount` e `info` además de `count` y `metadata`.

**Cliente:** `HasItem` y el evento `qb-inventory:client:ItemBox`.

## Créditos y código de terceros

- `data/items.lua`, `data/weapons.lua` y las tablas de `config/*.jsonc` generadas a partir de ellos
  vienen de [ox_inventory](https://github.com/overextended/ox_inventory) v2.47.9 (Copyright (C)
  Overextended, GPL-3.0). El resto del código no contiene código de ox_inventory: imita su API para
  ser compatible.
- Las imágenes de `web/images` representan objetos de Grand Theft Auto V; sus derechos son de
  Rockstar Games / Take-Two Interactive.
- La fuente Oswald (dentro de `dist/web/assets`) es de The Oswald Project Authors, con la
  [SIL Open Font License 1.1](OFL.txt).
- FiveM y Cfx.re son marcas de sus dueños. Este proyecto no está afiliado a ellos.

## Si lo usas o lo modificas

- Mantén el `author` del `fxmanifest.lua`, los avisos de copyright del código y esta hoja.
- Si repartes una versión modificada (también dentro de un pack o de un servidor que vendes),
  publica su código con la misma licencia y di qué cambiaste.
- Cada copia lleva una huella (`nxinv-605060a26b47f756`) para encontrar copias que no citen el
  original. Al arrancar, el recurso escribe sus créditos en la consola y anuncia `nx_inventory` en
  la información pública del servidor.
