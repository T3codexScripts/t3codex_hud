local ODO = {}

RegisterNetEvent('t3codex_hud:odometer:request', function(plate)
    local src = source
    if type(plate) ~= 'string' then plate = tostring(plate or '') end
    local val = ODO[plate] or 0.0
    TriggerClientEvent('t3codex_hud:odometer:value', src, plate, val)
end)

RegisterNetEvent('t3codex_hud:odometer:add', function(plate, delta)
    if type(plate) ~= 'string' then plate = tostring(plate or '') end
    local d = tonumber(delta) or 0.0
    if d <= 0 then return end
    ODO[plate] = (ODO[plate] or 0.0) + d
end)
