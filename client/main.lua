local QBCore = exports['qb-core']:GetCoreObject()

-- =============== Helpers ===============
local function clamp(v, min, max)
    if v < min then return min elseif v > max then return v end
    return v
end

local function raw_to_pct(raw) -- native health (100..200) -> 0..100
    return clamp(math.floor(((raw - 100) / 100) * 100), 0, 100)
end

local function dir4(h)
    if h >= 315 or h < 45 then return 'N'
    elseif h >= 45 and h < 135 then return 'E'
    elseif h >= 135 and h < 225 then return 'S'
    elseif h >= 225 and h < 315 then return 'W' end
    return 'N'
end

local function getLevelAndProgress(xp)
    xp = tonumber(xp) or 0
    if Config.LevelingMode == 'linear' then
        local per = math.max(1, tonumber(Config.LinearXPPerLevel) or 500)
        local level = math.floor(xp / per) + 1
        local prog = ((xp % per) / per) * 100
        return level, math.floor(prog)
    end
    local t = Config.LevelThresholds or { [1] = 0 }
    local maxL = 1
    while t[maxL + 1] ~= nil do maxL = maxL + 1 end
    local lvl = 1
    for i = 1, maxL do if xp >= t[i] then lvl = i else break end end
    local prev, nxt = t[lvl] or 0, t[lvl + 1]
    if not nxt or nxt <= prev then return lvl, 100 end
    local span = nxt - prev
    local prog = span > 0 and ((xp - prev) / span) * 100 or 0
    return lvl, clamp(math.floor(prog), 0, 100)
end

-- =============== Player/QB state ===============
local currentJobName = 'Unknown'

local function seedData()
    local pd = QBCore.Functions.GetPlayerData()
    if pd and pd.metadata then LocalPlayer.state.metadata = pd.metadata end
    if pd and pd.job and pd.job.name then currentJobName = pd.job.name end
end

RegisterNetEvent('QBCore:Player:SetPlayerData', function(data)
    if data.metadata then LocalPlayer.state.metadata = data.metadata end
    if data.job and data.job.name then currentJobName = data.job.name end
end)

AddEventHandler('onClientResourceStart', function(res)
    if res ~= GetCurrentResourceName() then return end
    seedData()
    -- Send effect config to NUI
    SendNUIMessage({
        action = 'configEffect',
        flashIntensity = Config.DamageFlashIntensity or 1.0,
        lowIntensity   = Config.LowHealthIntensity   or 1.0
    })
    -- Load saved layout (percents + scale) and apply
    local layout = {
        hud = {
            left  = tonumber(GetResourceKvpString('t3x_hud_left'))  or nil,
            top   = tonumber(GetResourceKvpString('t3x_hud_top'))   or nil,
            scale = tonumber(GetResourceKvpString('t3x_hud_scale')) or 1.0
        },
        compass = {
            left  = tonumber(GetResourceKvpString('t3x_comp_left'))  or nil,
            top   = tonumber(GetResourceKvpString('t3x_comp_top'))   or nil,
            scale = tonumber(GetResourceKvpString('t3x_comp_scale')) or 1.0
        },
        vehbar = {
            left  = tonumber(GetResourceKvpString('t3x_vehbar_left'))  or nil,
            top   = tonumber(GetResourceKvpString('t3x_vehbar_top'))   or nil,
            scale = tonumber(GetResourceKvpString('t3x_vehbar_scale')) or 1.0
        },
        gauge = {
            left  = tonumber(GetResourceKvpString('t3x_gauge_left'))  or nil,
            top   = tonumber(GetResourceKvpString('t3x_gauge_top'))   or nil,
            scale = tonumber(GetResourceKvpString('t3x_gauge_scale')) or 1.0
        }
    }
    SendNUIMessage({ action = 'applyLayout', layout = layout })
end)

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    seedData()
    SendNUIMessage({
        action = 'configEffect',
        flashIntensity = Config.DamageFlashIntensity or 1.0,
        lowIntensity   = Config.LowHealthIntensity   or 1.0
    })
end)

-- =============== Keep radar/HUD minimal vanilla bars visible ===============
CreateThread(function()
    local minimap = RequestScaleformMovie('minimap')
    SetRadarBigmapEnabled(true, false); Wait(0); SetRadarBigmapEnabled(false, false)
    while true do
        Wait(0)
        DisplayRadar(true); DisplayHud(true)
        BeginScaleformMovieMethod(minimap, 'SETUP_HEALTH_ARMOUR')
        ScaleformMovieMethodAddParamInt(3)
        EndScaleformMovieMethod()
    end
end)

-- =============== Damage pulse (instant) ===============
local lastHealthPct = nil

local function pulse_damage(dmgPct)
    if dmgPct < 1 then dmgPct = 1 end
    SendNUIMessage({
        action = 'damagePulse',
        dmg    = dmgPct,
        flashIntensity = Config.DamageFlashIntensity or 1.0,
        lowIntensity   = Config.LowHealthIntensity   or 1.0
    })
    -- Optional camera shake:
    -- ShakeGameplayCam("SMALL_EXPLOSION_SHAKE", math.min(0.5, 0.05 + (dmgPct/100)*0.4))
end

-- Fires for ANY damage (PvP, zombies/peds melee, vehicles, explosions, etc.)
AddEventHandler('gameEventTriggered', function(name, args)
    if name ~= 'CEventNetworkEntityDamage' then return end
    local victim = args[1]
    if victim ~= PlayerPedId() then return end
    local before = lastHealthPct or raw_to_pct(GetEntityHealth(victim))
    SetTimeout(0, function()
        local after = raw_to_pct(GetEntityHealth(victim))
        local drop = before - after
        if drop > 0 then
            pulse_damage(drop)
            lastHealthPct = after
        end
    end)
end)

-- =============== HUD main loop (fallback) ===============
CreateThread(function()
    local interval = (Config and Config.UpdateInterval) or 1000
    while true do
        Wait(interval)
        local ped = PlayerPedId()

        local health = raw_to_pct(GetEntityHealth(ped))
        local armor  = clamp(GetPedArmour(ped), 0, 100)

        -- Fallback: catch missed damage
        if lastHealthPct ~= nil and health < lastHealthPct then
            pulse_damage(lastHealthPct - health)
        end
        lastHealthPct = health

        local oxygen = clamp(math.floor((GetPlayerUnderwaterTimeRemaining(PlayerId()) or 0) * 10), 0, 100)

        local md = LocalPlayer.state.metadata or {}
        local hunger = math.floor(md.hunger or 100)
        local thirst = math.floor(md.thirst or 100)

        local coords = GetEntityCoords(ped)
        local heading = GetEntityHeading(ped)
        local direction = dir4(heading)
        local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
        local streetName   = GetStreetNameFromHashKey(streetHash)
        local crossingName = crossingHash and GetStreetNameFromHashKey(crossingHash) or nil
        local streetLabel = (crossingName and crossingName ~= '' and (streetName .. ' / ' .. crossingName)) or streetName or 'Unknown Road'

        local job = currentJobName or 'Unknown'
        local xpField = job .. 'xp'
        local xp = tonumber(md[xpField]) or 0
        local level, progress = getLevelAndProgress(xp)

        SendNUIMessage({ action='updateHud', health=health, armor=armor, hunger=hunger, thirst=thirst, oxygen=oxygen })
        SendNUIMessage({ action='updateCompass', direction=direction, street=streetLabel })
        SendNUIMessage({ action='updateXP', xpPercent=progress, job=job, level=level })
    end
end)

-- =============== /hidehud ===============
local hudHidden = false
RegisterCommand("hidehud", function()
    hudHidden = not hudHidden
    SendNUIMessage({ action = "toggleHUD", hidden = hudHidden })
    local msg = hudHidden and "HUD hidden" or "HUD shown"
    if QBCore and QBCore.Functions and QBCore.Functions.Notify then
        QBCore.Functions.Notify(msg, hudHidden and "error" or "success")
    else
        print(("[HUD] %s"):format(msg))
    end
end, false)

-- =============== /hudedit & /hudreset ===============
local editMode = false

RegisterCommand("hudedit", function()
    editMode = not editMode
    SetNuiFocus(editMode, editMode)
    SendNUIMessage({ action = "hudEdit", enable = editMode })
    local msg = editMode and "HUD edit: ON (drag + resize). Use /hudedit again or press ESC/Enter to save & exit." or "HUD edit: OFF (saved)"
    if QBCore and QBCore.Functions and QBCore.Functions.Notify then
        QBCore.Functions.Notify(msg, "primary")
    else
        print(("[HUD] %s"):format(msg))
    end
end, false)

RegisterCommand("hudreset", function()
    -- Clear KVPs
    DeleteResourceKvp('t3x_hud_left');  DeleteResourceKvp('t3x_hud_top');  DeleteResourceKvp('t3x_hud_scale')
    DeleteResourceKvp('t3x_comp_left'); DeleteResourceKvp('t3x_comp_top'); DeleteResourceKvp('t3x_comp_scale')
    DeleteResourceKvp('t3x_vehbar_left'); DeleteResourceKvp('t3x_vehbar_top'); DeleteResourceKvp('t3x_vehbar_scale')
    DeleteResourceKvp('t3x_gauge_left');  DeleteResourceKvp('t3x_gauge_top');  DeleteResourceKvp('t3x_gauge_scale')
    SendNUIMessage({ action = "hudReset" })
    if QBCore and QBCore.Functions and QBCore.Functions.Notify then
        QBCore.Functions.Notify("HUD positions reset", "error")
    else
        print("[HUD] HUD positions reset")
    end
end, false)

-- =============== NUI Callbacks ===============
RegisterNUICallback('hud_saveLayout', function(data, cb)
    -- data = { hud={left,top,scale}, compass={...}, vehbar={...}, gauge={...} }
    local function save(prefix, obj)
        if not obj then return end
        if obj.left  then SetResourceKvp('t3x_'..prefix..'_left',  string.format('%.3f', obj.left))  end
        if obj.top   then SetResourceKvp('t3x_'..prefix..'_top',   string.format('%.3f', obj.top))   end
        if obj.scale then SetResourceKvp('t3x_'..prefix..'_scale', string.format('%.3f', obj.scale)) end
    end
    save('hud',    data.hud)
    save('comp',   data.compass)
    save('vehbar', data.vehbar)
    save('gauge',  data.gauge)

    -- turn off edit mode focus automatically (JS also calls focusOff on ESC/Enter)
    if editMode then
        editMode = false
        SetNuiFocus(false, false)
    end
    if QBCore and QBCore.Functions and QBCore.Functions.Notify then
        QBCore.Functions.Notify("HUD layout saved", "success")
    end
    cb({ ok = true })
end)

-- From JS when ESC/Enter pressed to ensure focus is released
RegisterNUICallback('focusOff', function(_, cb)
    if editMode then editMode = false end
    SetNuiFocus(false, false)
    cb({})
end)
