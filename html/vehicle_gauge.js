(function () {
  // mount root
  const root = document.createElement('div');
  root.id = 'gaugeRoot';
  root.innerHTML = `
    <div class="gauge-wrap">
      <svg class="gauge-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
        <!-- matte bezel -->
        <path d="M70,560 A430,430 0 0 1 930,560 L930,520 A390,390 0 0 0 110,520 Z" fill="var(--bezel)"/>
        <!-- cream face -->
        <path d="M120,520 A380,380 0 0 1 880,520 L880,500 A360,360 0 0 0 140,500 Z" fill="var(--face)"/>

        <!-- ticks group -->
        <g id="ticks"></g>
        <!-- numerals -->
        <g id="nums" fill="var(--num)" font-family="Courier New" font-weight="700" font-size="42" text-anchor="middle"></g>

        <!-- mini arcs -->
        <path id="fuelArc" stroke="#8c1b1b" stroke-width="12" fill="none" opacity="0.7"/>
        <path id="rpmArc"  stroke="#8c1b1b" stroke-width="12" fill="none" opacity="0.7"/>
        <text class="g-mini-label fuel">FUEL</text>
        <text class="g-mini-label rpm">RPM</text>

        <!-- units -->
        <text id="units" x="500" y="360" fill="var(--num)" font-family="Courier New" font-weight="700" font-size="36" text-anchor="middle">MPH</text>

        <!-- needle -->
        <g id="needle" transform="rotate(0,500,520)">
          <polygon points="495,520 505,520 500,130" fill="var(--needle)" />
          <circle cx="500" cy="520" r="22" fill="var(--hub)"/>
        </g>
      </svg>

      <div class="g-odo" id="gOdo">000000</div>
      <div class="g-gear" id="gGear">P</div>
    </div>
  `;
  document.body.appendChild(root);

  // runtime state
  let cfg = {
    w: 520,
    bottom: 0.05,
    right: 0.03,
    colors: { face:'#e9d9c1', num:'#c61f1f', needle:'#c61f1f', hub:'#444' }
  };

  // helpers
  const $ = (sel) => root.querySelector(sel);
  const rad = (deg) => (deg * Math.PI) / 180;

  function setColors() {
    root.style.setProperty('--face',  cfg.colors.face  || '#e9d9c1');
    root.style.setProperty('--num',   cfg.colors.num   || '#c61f1f');
    root.style.setProperty('--needle',cfg.colors.needle|| '#c61f1f');
    root.style.setProperty('--hub',   cfg.colors.hub   || '#444');
  }

  function setPlacement() {
    // width in px; position bottom-right by % offsets
    root.style.width = `${cfg.w}px`;
    root.style.right = `${cfg.right * 100}%`;
    root.style.bottom = `${cfg.bottom * 100}%`;
  }

  // build ticks & numerals for an arc (startAngle..endAngle in degrees)
  // we map 0..max -> 140deg..40deg (counter-clock)
  function buildScale(max, minorStep, majorStep) {
    const ticksG = $('#ticks');
    const numsG  = $('#nums');
    ticksG.innerHTML = '';
    numsG.innerHTML = '';

    const start = 140, end = 40; // sweep 100 degrees
    const sweep = start - end;

    const toAngle = (val) => start - (val / max) * sweep;
    const polar = (angle, r) => {
      const x = 500 + r * Math.cos(rad(angle));
      const y = 520 - r * Math.sin(rad(angle));
      return {x,y};
    };

    for (let v = 0; v <= max; v += minorStep) {
      const a = toAngle(v);
      const p1 = polar(a, 360);
      const p2 = polar(a, 340);
      const isMajor = (v % majorStep) === 0;
      const len = isMajor ? 40 : 20;
      const p3 = polar(a, 360);
      const p4 = polar(a, 360 - len);

      const t = document.createElementNS('http://www.w3.org/2000/svg','line');
      t.setAttribute('x1', p3.x); t.setAttribute('y1', p3.y);
      t.setAttribute('x2', p4.x); t.setAttribute('y2', p4.y);
      t.setAttribute('stroke', 'var(--tick)');
      t.setAttribute('stroke-width', isMajor ? '4' : '2');
      ticksG.appendChild(t);

      if (isMajor) {
        const nPos = polar(a, 300);
        const n = document.createElementNS('http://www.w3.org/2000/svg','text');
        n.setAttribute('x', nPos.x); n.setAttribute('y', nPos.y + 14);
        n.textContent = v.toString();
        numsG.appendChild(n);
      }
    }
  }

  // mini arcs (fuel left, rpm right)
  function updateMiniArcs(fuelPct, rpmPct, rpmRed) {
    const fStart = 155, fEnd = 105; // left small arc
    const rStart = 35,  rEnd = 85;  // right small arc

    function arcPath(a1, a2, pct) {
      const a = a1 + (a2 - a1) * (pct / 100);
      const r = 250;
      const p1 = polar(a1, r); const p = polar(a, r);
      const large = (a2 - a1) > 180 ? 1 : 0;
      return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 0 ${p.x} ${p.y}`;
    }

    $('#fuelArc').setAttribute('d', arcPath(fStart, fEnd, Math.max(0, Math.min(100, fuelPct||0))));
    $('#rpmArc').setAttribute('d', arcPath(rStart, rEnd, Math.max(0, Math.min(100, rpmPct||0))));
    const rpmArc = $('#rpmArc');
    if ((rpmPct||0) >= (rpmRed||90)) rpmArc.setAttribute('stroke', '#d81f1f'); else rpmArc.setAttribute('stroke', '#8c1b1b');
  }

  // needle easing
  let currentAngle = 140;
  function setNeedleBySpeed(speed, max) {
    const start = 140, end = 40, sweep = start - end;
    const targetAngle = start - (Math.min(speed, max) / max) * sweep;
    // ease a bit
    currentAngle = currentAngle + (targetAngle - currentAngle) * 0.25;
    $('#needle').setAttribute('transform', `rotate(${currentAngle},500,520)`);
  }

  // odometer printer (simple pad to 6 digits; miles/km handled client)
  function setOdometer(totalUnits) {
    const val = Math.max(0, Number(totalUnits||0));
    const str = (val).toFixed(1); // one decimal for vibe
    const parts = str.split('.');
    const whole = parts[0].padStart(5,'0'); // 5 digits + .1
    $('#gOdo').textContent = `${whole}${parts.length>1?'.'+parts[1]:'.0'}`;
  }

  function setUnitsLabel(units) {
    $('#units').textContent = units || 'MPH';
  }

  function setGear(gear) {
    $('#gGear').textContent = String(gear ?? 'P');
  }

  function show() { root.style.display = 'block'; }
  function hide() { root.style.display = 'none'; }

  // message bus
  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (!d.action) return;

    if (d.action === 'gauge:show') {
      cfg = { ...cfg, ...d };
      setPlacement(); setColors();
      show();
      return;
    }
    if (d.action === 'gauge:hide') {
      hide();
      return;
    }
    if (d.action === 'gauge:update') {
      // (re)build scale if max changed notably
      if (!root._lastMax || Math.abs(d.max - root._lastMax) >= 10) {
        buildScale(d.max || 160, d.minor || 10, d.major || 20);
        root._lastMax = d.max;
      }
      setUnitsLabel(d.units);
      setNeedleBySpeed(d.speed || 0, d.max || 160);
      updateMiniArcs(d.fuel || 0, d.rpm || 0, d.rpmRed || 90);
      setOdometer(d.odometer || 0);
      setGear(d.gear);
    }
  });
})();
