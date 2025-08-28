local QBCore = exports['qb-core']:GetCoreObject()
print('^2[Vehicle HUD] client/vehicle.lua loaded^0')

CreateThread(function() Wait(500) SetNuiFocus(false, false) end)

local function clamp(x, a, b) if x < a then return a end if x > b then return b end return x end
local function ms_to_units(ms)
    if (ConfigVehicle.Units or 'mph') == 'kph' then return ms * 3.6, 'KPH' else return ms * 2.23694, 'MPH' end
end

-- fuel fallback
local function get_fuel(veh)
    local native = GetVehicleFuelLevel(veh) or 0.0
    if native and native > 0.001 then return native end
    for _, ent in ipairs(ConfigVehicle.FuelExportOrder or {}) do
        local ok, val = pcall(function() local ex = exports[ent.res]; return ex and ex[ent.fn] and ex[ent.fn](veh) end)
        if ok and type(val) == 'number' then return val end
    end
    return native or 0.0
end

-- show/hide helpers
local vehShown = false
local function showBarHUD(show)
    if not ConfigVehicle.EnableBarHUD then return end
    if show and not vehShown then SendNUIMessage({action='veh:show'}) vehShown=true
    elseif not show and vehShown then SendNUIMessage({action='veh:hide'}) vehShown=false end
end

local gaugeShown = false
local function showGauge(show)
    if not ConfigVehicle.UseRetroGauge then return end
    if show and not gaugeShown then
        SendNUIMessage({ action='gauge:show', w=ConfigVehicle.GaugeWidth,
            bottom=ConfigVehicle.GaugeBottom, right=ConfigVehicle.GaugeRight,
            colors={ face=ConfigVehicle.GaugeCreamFace, num=ConfigVehicle.GaugeRedText,
                     needle=ConfigVehicle.GaugeNeedle, hub=ConfigVehicle.GaugeHub } })
        gaugeShown = true
    elseif not show and gaugeShown then
        SendNUIMessage({ action='gauge:hide' })
        gaugeShown = false
    end
end

-- odometer (server-backed)
local lastVeh, lastCoords, lastOdo = 0, nil, 0.0
local lastOdoPush = 0

local function meters_to_units(m)
    if (ConfigVehicle.Units or 'mph') == 'kph' then return m / 1000.0 else return m * 0.000621371 end
end

-- receive current stored odometer from server
RegisterNetEvent('t3codex_hud:odometer:value', function(plate, value)
    lastOdo = tonumber(value) or 0.0
end)

local function requestOdo(veh)
    if not ConfigVehicle.EnableOdometer then return end
    local plate = GetVehicleNumberPlateText(veh)
    TriggerServerEvent('t3codex_hud:odometer:request', plate)
end

local function pushOdoDelta(veh, deltaUnits)
    if not ConfigVehicle.EnableOdometer or not veh or veh==0 then return end
    local plate = GetVehicleNumberPlateText(veh)
    TriggerServerEvent('t3codex_hud:odometer:add', plate, deltaUnits)
end

-- scaling memory per vehicle this session
local scaleMaxForVeh = {}
local function pickScaleMax(unitsSpeed, veh)
    if not ConfigVehicle.AutoScaleTopSpeed then return 160 end
    local key = veh ~= 0 and tostring(veh) or 'default'
    local prev = scaleMaxForVeh[key] or 0
    local margin = ConfigVehicle.AutoScaleMargin or 20
    local target = math.ceil(math.max(prev, unitsSpeed + margin) / margin) * margin
    target = math.max(80, math.min(240, target)) -- clamp a sensible range
    scaleMaxForVeh[key] = target
    return target
end

-- state change debug
local prevInVeh = false

CreateThread(function()
    local tick = (ConfigVehicle.UpdateInterval or 150)
    local minor = ConfigVehicle.TickMinorStep or 10
    local major = ConfigVehicle.TickMajorStep or 20

    while true do
        Wait(tick)

        local ped = PlayerPedId()
        local inVeh = IsPedInAnyVehicle(ped, false)

        if inVeh ~= prevInVeh then
            prevInVeh = inVeh
            if inVeh then
                local veh = GetVehiclePedIsIn(ped, false)
                lastVeh = veh
                lastCoords = GetEntityCoords(ped)
                requestOdo(veh)
                showBarHUD(true)
                showGauge(true)
            else
                showBarHUD(false)
                showGauge(false)
                lastVeh = 0
                lastCoords = nil
            end
        end

        if not inVeh then goto continue end

        local veh = GetVehiclePedIsIn(ped, false)
        if veh == 0 then showBarHUD(false) showGauge(false) goto continue end

        -- readings
        local speedMS = GetEntitySpeed(veh) or 0.0
        local speedUnits, unitLabel = ms_to_units(speedMS)
        speedUnits = math.max(0, speedUnits)

        local fuel = get_fuel(veh); fuel = clamp(fuel, 0.0, 100.0)
        local engineHealth = GetVehicleEngineHealth(veh) or 0.0
        local enginePct = clamp((engineHealth / (ConfigVehicle.EngineMaxHealth or 1000)) * 100.0, 0.0, 100.0)
        local rpm = GetVehicleCurrentRpm(veh) or 0.0
        local rpmPct = clamp(rpm * 100.0, 0.0, 100.0)
        local gear = GetVehicleCurrentGear(veh) or 0
        if gear == 0 and speedUnits > 0.1 then gear = 'R' end
        if gear == 0 and speedUnits <= 0.1 then gear = 'P' end

        -- odometer accumulation (distance traveled since last tick)
        if ConfigVehicle.EnableOdometer then
            local nowCoords = GetEntityCoords(ped)
            if lastCoords then
                local dx = #(nowCoords - lastCoords)      -- meters moved this tick
                local du = meters_to_units(dx)            -- miles or km
                lastOdo = lastOdo + du
                local now = GetGameTimer()
                if now - lastOdoPush >= 1000 then
                    pushOdoDelta(veh, du)
                    lastOdoPush = now
                end
            end
            lastCoords = nowCoords
        end

        -- BAR HUD (optional)
        if ConfigVehicle.EnableBarHUD then
            SendNUIMessage({
                action    = 'veh:update',
                units     = unitLabel,
                showSpeed = ConfigVehicle.ShowSpeed,
                showFuel  = ConfigVehicle.ShowFuel,
                showEngine= ConfigVehicle.ShowEngineHP,
                showRPM   = ConfigVehicle.ShowRPM,
                showGear  = ConfigVehicle.ShowGear,
                speed  = math.floor(speedUnits + 0.5),
                fuel   = math.floor(fuel + 0.5),
                engine = math.floor(enginePct + 0.5),
                rpm    = math.floor(rpmPct + 0.5),
                gear   = gear
            })
        end

        -- RETRO GAUGE (preferred)
        if ConfigVehicle.UseRetroGauge then
            local scaleMax = pickScaleMax(speedUnits, veh)
            SendNUIMessage({
                action='gauge:update',
                speed = speedUnits, units = unitLabel, max = scaleMax,
                rpm = rpmPct, rpmRed = ConfigVehicle.RPMRedlinePct or 90,
                fuel = fuel,
                gear = gear,
                odometer = lastOdo,                 -- floating total miles/km
                minor = minor, major = major
            })
        end

        ::continue::
    end
end)
