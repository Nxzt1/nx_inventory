fx_version 'cerulean'
game 'gta5'

name 'nx_inventory'
author 'Nxzt1'
description 'nx_inventory: inventario para FiveM (Qbox, QBCore y ESX) en TypeScript + React, compatible con la API de ox_inventory'
repository 'https://github.com/Nxzt1/nx_inventory'
license 'GPL-3.0-or-later'
nx_version '0.1.1'
-- Versión de la API de ox_inventory que imita, no la de nx_inventory:
-- con provide, GetResourceMetadata('ox_inventory', 'version') devuelve esta, y qbx_core y ox_fuel
-- comprueban con lib.checkDependency que sea >= 2.42.1 / 2.30.0. La propia es nx_version.
version '2.47.9'

-- Los recursos que declaran `dependency 'ox_inventory'` arrancan con este en su
-- lugar. Los exports de ox los atiende el propio nx_inventory (provide no los crea).
-- No arrancar a la vez que ox_inventory: los dos responderían a los mismos exports.
provide 'ox_inventory'
-- Con QBCore también atiende los exports de qb-inventory, pero sin
-- provide 'qb-inventory': con él GetResourceState('qb-inventory') da 'started' y qbx_core
-- lanza un error en cada guardado del jugador.

dependencies {
    '/onesync',
    'oxmysql',
}

node_version '22'

client_scripts {
    'lua/watch.lua', -- comprobaciones cada 500 ms (ver el archivo)
    'dist/client.js',
}
server_script 'dist/server.js'

ui_page 'dist/web/index.html'

files {
    'config/*.jsonc',
    'locales/*.json',
    -- copia de data/items.lua y weapons.lua de ox: qbx_core y otros recursos los leen
    'data/items.lua',
    'data/weapons.lua',
    'dist/web/index.html',
    'dist/web/assets/*',
    'web/images/*.webp',
    'web/images/*.png',
}
