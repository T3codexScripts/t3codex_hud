fx_version 'cerulean'
lua54 'yes'
game 'gta5'

author 't3codex'
description 'Zombie HUD with XP, compass, vehicle HUD + retro gauge'
version '3.6.0'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
    'config_vehicle.lua'          -- vehicle HUD & gauge config
}

client_scripts {
    'client/main.lua',
    'client/vehicle.lua'          -- vehicle polling + NUI
}

server_scripts {
    'server/odometer.lua'         -- lightweight persistence per plate
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/vehicle.css',
    'html/vehicle.js',
--    'html/vehicle_gauge.css',     -- NEW
--    'html/vehicle_gauge.js',      -- NEW
    'html/images/*.png'
}

print('^2[t3codex_hud] fxmanifest loaded (3.6.0)^0')
