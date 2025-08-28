ConfigVehicle = {}

-- === General ===
ConfigVehicle.UpdateInterval = 150
ConfigVehicle.Units = 'mph'               -- 'mph' | 'kph'
ConfigVehicle.HideWhenNotInVehicle = true
ConfigVehicle.ForceShowWhenInVeh   = true

-- keep the bar HUD available
ConfigVehicle.EnableBarHUD = true

-- === Retro Gauge (new) ===
ConfigVehicle.UseRetroGauge = true        -- master toggle
ConfigVehicle.GaugeWidth = 520            -- px, bottom-right placement
ConfigVehicle.GaugeBottom = 0.05          -- 5% from bottom
ConfigVehicle.GaugeRight  = 0.03          -- 3% from right
ConfigVehicle.GaugeCreamFace = '#e9d9c1'  -- face color
ConfigVehicle.GaugeRedText  = '#c61f1f'   -- numerals
ConfigVehicle.GaugeNeedle   = '#c61f1f'
ConfigVehicle.GaugeHub      = '#444'      -- matte hub (no chrome)
ConfigVehicle.AutoScaleTopSpeed = true
ConfigVehicle.AutoScaleMargin   = 20      -- round up by this step
ConfigVehicle.TickMinorStep     = 10
ConfigVehicle.TickMajorStep     = 20

-- mini arcs
ConfigVehicle.ShowFuelMiniArc = true      -- left
ConfigVehicle.ShowRPMMiniArc  = true      -- right
ConfigVehicle.RPMRedlinePct   = 90        -- warn/redline threshold (percent)

-- === Odometer (server-backed) ===
ConfigVehicle.EnableOdometer = true
-- miles if Units=='mph', kilometers if 'kph'

-- === Bar HUD (existing) ===
ConfigVehicle.ShowSpeed      = true
ConfigVehicle.ShowFuel       = true
ConfigVehicle.ShowEngineHP   = true
ConfigVehicle.ShowRPM        = true
ConfigVehicle.ShowGear       = true

-- bars clamp/scale (used by bar HUD)
ConfigVehicle.FuelMaxPercent    = 100
ConfigVehicle.EngineMaxHealth   = 1000
ConfigVehicle.RPMScaleToPercent = true

-- Optional fuel exports if natives return 0
ConfigVehicle.FuelExportOrder = {
    { res = 'LegacyFuel', fn = 'GetFuel' },
    { res = 'ox_fuel',    fn = 'GetFuel' },
}

-- Debugging
ConfigVehicle.Debug = false
ConfigVehicle.DebugEveryMs = 1000
