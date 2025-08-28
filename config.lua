Config = {}

-- How often the HUD updates (ms)
Config.UpdateInterval = 1000

-- === Screen Effect ===
-- Multiplier for the red tint brightness when taking damage
Config.DamageFlashIntensity = 1.0
Config.LowHealthIntensity   = 1.0

---------------------------------------------------------------------

---------------------------------------------------------------------
-- LEVELING MODEL (shared with your Skills system)
-- Choose ONE: 'linear' or 'thresholds'
---------------------------------------------------------------------
-- Option A) Linear (matches your original HUD math if set to 500/level)
Config.LevelingMode = 'thresholds'   -- 'linear' | 'thresholds'
Config.LinearXPPerLevel = 500        -- used only when LevelingMode = 'linear'

-- Option B) Thresholds (total XP required to be at/above each level)
-- NOTE: These must be ascending and 1-indexed.
Config.LevelThresholds = {
    [1] = 0,
    [2] = 500,
    [3] = 1500,
    [4] = 3000,
    [5] = 6000,
    -- [6] = 10000,
    -- [7] = 15000,
    -- add more if desired
}
