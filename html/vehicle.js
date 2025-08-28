(function () {
    // Create container once; no manual HTML edits needed
    const mount = document.createElement('div');
    mount.id = 'vehHud';
    mount.innerHTML = `
        <div class="veh-row" id="vehSpeedRow">
            <div class="veh-label">SPEED</div>
            <div class="veh-val" id="vehSpeedVal">0 MPH</div>
        </div>

        <div class="veh-row" id="vehFuelRow">
            <div class="veh-label">FUEL</div>
            <div class="veh-bar"><div class="veh-fill" id="vehFuelFill"></div></div>
        </div>

        <div class="veh-row" id="vehEngineRow">
            <div class="veh-label">ENGINE</div>
            <div class="veh-bar"><div class="veh-fill" id="vehEngineFill"></div></div>
        </div>

        <div class="veh-row" id="vehRPMRow">
            <div class="veh-label">RPM</div>
            <div class="veh-bar"><div class="veh-fill" id="vehRPMFill"></div></div>
        </div>

        <div class="veh-row" id="vehGearRow">
            <div class="veh-label">GEAR</div>
            <div class="veh-val" id="vehGear">P</div>
        </div>
    `;
    document.body.appendChild(mount);
    console.log('[t3codex_hud] vehicle.js mounted');

    const qs = (id) => document.getElementById(id);

    function setVisible(el, visible) {
        el.style.display = visible ? 'block' : 'none'; // override CSS display:none
    }

    function setFillState(fillEl, value, warnAt, critAt, invert = false) {
        // invert=false: low is bad (fuel/engine). invert=true: high is bad (RPM).
        // value in 0..100
        const v = Math.max(0, Math.min(100, Number(value || 0)));

        fillEl.style.width = `${v}%`;
        fillEl.classList.remove('ok', 'warn', 'crit');

        let state = 'ok';
        if (!invert) {
            // low is bad
            if (v <= critAt) state = 'crit';
            else if (v <= warnAt) state = 'warn';
        } else {
            // high is bad
            if (v >= critAt) state = 'crit';
            else if (v >= warnAt) state = 'warn';
        }
        fillEl.classList.add(state);
        return state;
    }

    function shakeIfCritical(anyCrit) {
        if (!anyCrit) return;
        mount.classList.remove('crit-shake');
        // retrigger animation
        // eslint-disable-next-line no-unused-expressions
        mount.offsetHeight; 
        mount.classList.add('crit-shake');
    }

    window.addEventListener('message', function (event) {
        const data = event.data;
        if (!data || !data.action) return;

        if (data.action === 'veh:show') {
            setVisible(mount, true);
            return;
        }
        if (data.action === 'veh:hide') {
            setVisible(mount, false);
            return;
        }
        if (data.action === 'veh:update') {
            setVisible(qs('vehSpeedRow'), !!data.showSpeed);
            setVisible(qs('vehFuelRow'),  !!data.showFuel);
            setVisible(qs('vehEngineRow'),!!data.showEngine);
            setVisible(qs('vehRPMRow'),   !!data.showRPM);
            setVisible(qs('vehGearRow'),  !!data.showGear);

            // SPEED / GEAR / UNITS
            if (data.showSpeed) {
                qs('vehSpeedVal').innerText = `${data.speed || 0} ${data.units || 'MPH'}`;
            }
            if (data.showGear) {
                qs('vehGear').innerText = String(data.gear ?? 'P');
            }

            // Bars with apocalypse color states
            let anyCrit = false;

            if (data.showFuel) {
                // Fuel: low is bad. warn <=35, crit <=15
                const fuelState = setFillState(qs('vehFuelFill'), data.fuel, 35, 15, false);
                if (fuelState === 'crit') anyCrit = true;
            }
            if (data.showEngine) {
                // Engine health: low is bad. warn <=40, crit <=20
                const engState = setFillState(qs('vehEngineFill'), data.engine, 40, 20, false);
                if (engState === 'crit') anyCrit = true;
            }
            if (data.showRPM) {
                // RPM: high is bad. warn >=85, crit >=95
                const rpmState = setFillState(qs('vehRPMFill'), data.rpm, 85, 95, true);
                if (rpmState === 'crit') anyCrit = true;
            }

            shakeIfCritical(anyCrit);
        }
    });
})();
