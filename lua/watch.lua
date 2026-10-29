-- nx_inventory | Copyright (C) 2026 Nxzt1 | GPL-3.0-or-later | https://github.com/Nxzt1/nx_inventory | nxinv-605060a26b47f756
-- Trabajo de nx_inventory que llama a nativas cada fotograma o cada pocos ms. Va en Lua a
-- propósito: desde JS cada nativa cuesta bastante más, y cualquier temporizador activo hace que
-- FiveM entre en JS en cada fotograma (citizen/scripting/v8/timer.js). La lógica sigue en
-- dist/client.js (TypeScript): este archivo solo ejecuta lo que le dicen por eventos locales y
-- avisa cuando pasa algo. Bucles:
--   · cada 500 ms, siempre: canSteal, vigilante sin arma y props de los drops;
--   · cada fotograma, solo con el inventario abierto, un arma en la mano o una barra de uso.

local UNARMED = joaat('WEAPON_UNARMED')
local PROP_DISTANCE = 30.0
local CANCEL_CONTROL = 73 -- X

local playerId = PlayerId()
local watchUnarmed = false
local published = nil
-- drops: id -> { coords = vector3, model = hash, object = entidad o nil }
local drops = {}

-- Estados que pone dist/client.js (nil = apagado)
local open = nil     -- { enable = {controles}, move = bool, anchor = {...} o nil }
local armed = nil    -- { hash, ammo = bool, throwable = bool, melee = bool, aimOnly = bool, broken = bool }
local progress = nil -- { controls = {controles}, combat = bool, cancel = bool, finish = ms }
local using = false
local frameRunning = false
-- HUD y radar se esconden una vez al abrir (no cada fotograma) y se dejan como estaban al cerrar
local hudWasHidden, radarWasHidden = false, false

local function setOpen(data)
    if data and not open then
        hudWasHidden, radarWasHidden = IsHudHidden(), IsRadarHidden()
        DisplayHud(false)
        DisplayRadar(false)
    elseif not data and open then
        if not hudWasHidden then DisplayHud(true) end
        if not radarWasHidden then DisplayRadar(true) end
    end
    open = data
end

-- --- Cada fotograma (solo mientras hace falta) ----------------------------------------------

local function anchorLost(ped, anchor)
    if anchor.inside then return GetVehiclePedIsIn(ped, false) ~= anchor.inside end
    local here = GetEntityCoords(ped)
    if anchor.target then
        local id = GetPlayerFromServerId(anchor.target)
        return id == -1 or #(here - GetEntityCoords(GetPlayerPed(id))) > anchor.max
    end
    if anchor.entity then
        return not DoesEntityExist(anchor.entity) or #(here - GetEntityCoords(anchor.entity)) > anchor.max
    end
    if anchor.coords then
        return #(here - vector3(anchor.coords[1] + 0.0, anchor.coords[2] + 0.0, anchor.coords[3] + 0.0)) > anchor.max
    end
    return false
end

local function openBlocked(ped)
    local state = LocalPlayer.state
    return state.invBusy == true or state.dead == true or IsPauseMenuActive() or IsPedCuffed(ped) or IsPedFatallyInjured(ped)
end

local function startFrame()
    if frameRunning then return end
    frameRunning = true

    CreateThread(function()
        local nextCheck = 0

        while open or armed or progress do
            local ped = PlayerPedId()
            local now = GetGameTimer()
            local check = now >= nextCheck
            if check then nextCheck = now + 250 end

            if open then
                -- DisableAllControlActions ya bloquea disparar: no hace falta DisablePlayerFiring
                DisableAllControlActions(0)
                local enable = open.enable
                for i = 1, #enable do EnableControlAction(0, enable[i], true) end
                if open.move then
                    EnableControlAction(0, 30, true)
                    EnableControlAction(0, 31, true)
                end

                if check then
                    if openBlocked(ped) then
                        setOpen(nil)
                        TriggerEvent('nx_inventory:openLost', 'blocked')
                    elseif open.anchor and anchorLost(ped, open.anchor) then
                        setOpen(nil)
                        TriggerEvent('nx_inventory:openLost', 'far')
                    end
                end
            end

            if progress then
                local controls = progress.controls
                for i = 1, #controls do DisableControlAction(0, controls[i], true) end
                if progress.combat then DisablePlayerFiring(playerId, true) end

                local cancelled = (progress.cancel and IsControlJustPressed(0, CANCEL_CONTROL))
                    or IsPedDeadOrDying(ped, true) or IsPedRagdoll(ped) or IsPedFalling(ped)
                if cancelled or now >= progress.finish then
                    progress = nil
                    TriggerEvent('nx_inventory:progressDone', cancelled == true)
                end
            end

            if armed then
                DisablePlayerVehicleRewards(playerId)
                HudWeaponWheelIgnoreSelection()
                DisableControlAction(0, 37, true) -- rueda de armas
                DisableControlAction(0, 80, true)
                DisableControlAction(0, 140, true)

                if open or using or armed.broken or (armed.aimOnly and not IsPlayerFreeAiming(playerId)) then
                    DisablePlayerFiring(playerId, true)
                end

                if armed.ammo then
                    if IsPedShooting(ped) then TriggerEvent('nx_inventory:weaponShot') end
                elseif armed.throwable then
                    if not armed.thrown and IsControlPressed(0, 24) then
                        armed.thrown = true
                        TriggerEvent('nx_inventory:weaponThrow')
                    end
                elseif armed.melee then
                    if IsControlJustReleased(0, 24) and IsPedPerformingMeleeAction(ped) then TriggerEvent('nx_inventory:weaponMelee') end
                end

                if check then
                    if GetSelectedPedWeapon(ped) ~= armed.hash then TriggerEvent('nx_inventory:weaponMismatch') end
                    if IsPedUsingActionMode(ped) then SetPedUsingActionMode(ped, false, -1, 'DEFAULT_ACTION') end
                end
            end

            Wait(0)
        end

        frameRunning = false
    end)
end

AddEventHandler('nx_inventory:open', function(data)
    setOpen(data)
    if open then startFrame() end
end)

AddEventHandler('nx_inventory:armed', function(data)
    armed = data
    if armed then startFrame() end
end)

AddEventHandler('nx_inventory:using', function(on)
    using = on == true
end)

AddEventHandler('nx_inventory:progress', function(data)
    if data then data.finish = GetGameTimer() + data.duration end
    progress = data
    if progress then startFrame() end
end)

-- --- Cada 500 ms --------------------------------------------------------------------------------

-- dist/client.js lo enciende sin arma del inventario en la mano y lo apaga al equipar una
AddEventHandler('nx_inventory:unarmedWatch', function(on)
    watchUnarmed = on == true
end)

local function removeProp(drop)
    if drop.object and DoesEntityExist(drop.object) then DeleteEntity(drop.object) end
    drop.object = nil
end

-- dist/client.js manda los drops que aparecen y desaparecen (nil, nil = quitar todos)
AddEventHandler('nx_inventory:dropProps', function(add, remove)
    if add == nil and remove == nil then
        for _, drop in pairs(drops) do removeProp(drop) end
        drops = {}
        return
    end
    for _, info in ipairs(add or {}) do
        drops[info.id] = { coords = vector3(info.coords[1] + 0.0, info.coords[2] + 0.0, info.coords[3] + 0.0), model = joaat(info.model) }
    end
    for _, id in ipairs(remove or {}) do
        local drop = drops[id]
        if drop then
            removeProp(drop)
            drops[id] = nil
        end
    end
end)

local function updateProps(here)
    for _, drop in pairs(drops) do
        if #(here - drop.coords) <= PROP_DISTANCE then
            if not drop.object then
                -- sin esperar: si el modelo no está cargado se pide y se crea en la siguiente vuelta
                if HasModelLoaded(drop.model) then
                    local object = CreateObject(drop.model, drop.coords.x, drop.coords.y, drop.coords.z, false, true, true)
                    PlaceObjectOnGroundProperly(object)
                    FreezeEntityPosition(object, true)
                    SetEntityCollision(object, false, true)
                    SetModelAsNoLongerNeeded(drop.model)
                    drop.object = object
                elseif IsModelValid(drop.model) then
                    RequestModel(drop.model)
                end
            end
        elseif drop.object then
            removeProp(drop)
        end
    end
end

CreateThread(function()
    while true do
        Wait(500)
        local ped = PlayerPedId()

        -- sin arma del inventario en la mano no puede haber ninguna otra (weaponmismatch de ox)
        if watchUnarmed then
            local selected = GetSelectedPedWeapon(ped)
            if selected ~= UNARMED and GetWeapontypeGroup(selected) ~= 0 then RemoveAllPedWeapons(ped, true) end
        end

        -- "canSteal": se puede registrar a este jugador (manos arriba, esposado, muerto)
        local value = IsPedFatallyInjured(ped)
            or IsPedCuffed(ped)
            or IsEntityPlayingAnim(ped, 'missminuteman_1ig_2', 'handsup_base', 3)
            or IsEntityPlayingAnim(ped, 'random@mugging3', 'handsup_standing_base', 3)
            or IsEntityPlayingAnim(ped, 'missminuteman_1ig_2', 'handsup_enter', 3)
            or IsEntityPlayingAnim(ped, 'mp_arresting', 'idle', 3)
            or IsEntityPlayingAnim(ped, 'dead', 'dead_a', 3)
        if value ~= published then
            published = value
            LocalPlayer.state:set('canSteal', value, true)
        end

        if next(drops) then updateProps(GetEntityCoords(ped)) end
    end
end)

AddEventHandler('onResourceStop', function(name)
    if name ~= GetCurrentResourceName() then return end
    setOpen(nil)
    for _, drop in pairs(drops) do removeProp(drop) end
end)
