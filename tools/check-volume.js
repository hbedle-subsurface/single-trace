/* The three modules with a map tab each carry their own copy of the volume
   block — the same reason every module carries its own copy of the earth model,
   and with the same risk. This compares the volumes the three of them actually
   produce, at several crosslines and several frequencies.

   Run: node check-volume.js */
const path = require('path');

const mods = [
  ['01 instantaneous', './harness.js'],
  ['03 rms', './harness-rms.js'],
  ['05 avt', './harness-avt.js'],
  ['06 teager', './harness-teager.js'],
];

const loaded = mods.map(([name, h]) => ({ name, win: require(h).win }));

setTimeout(() => {
  const ready = loaded.filter((m) => m.win.__MOD);
  loaded.filter((m) => !m.win.__MOD)
    .forEach((m) => console.log('  ' + m.name + ': DID NOT INITIALISE'));
  if (ready.length < 2) { console.log('nothing to compare'); process.exit(1); }

  console.log('the volume, compared across the modules that have a map tab');
  console.log('  modules loaded: ' + ready.map((m) => m.name).join(', '));

  let fails = 0;
  const ref = ready[0];

  // the geometry constants first
  ready.forEach((m) => {
    const M = m.win.__MOD;
    console.log('  ' + m.name.padEnd(18) + 'NY=' + M.NY + ' IY0=' + M.IY0 +
      '  channel closest approach ' + M.channelReach().toFixed(1));
  });

  [[25, 12], [25, 30], [40, 24], [15, 5]].forEach((cfg) => {
    const freq = cfg[0], iy = cfg[1];
    /* Put every module in the same state first. The volume carries the decay
       and the noise, and the modules have different defaults for both — an
       earlier version of this check compared module 01 at 6 dB/s against the
       others at 8 and reported the block had drifted when nothing had. */
    ready.forEach((m) => {
      const M = m.win.__MOD, S = M.state();
      S.freq = freq; S.decay = 8; S.noise = 0;
      M.set('freq', freq);
    });
    const base = ref.win.__MOD.crosslineSection(iy);
    ready.slice(1).forEach((m) => {
      const other = m.win.__MOD.crosslineSection(iy);
      let worst = 0;
      for (let i = 0; i < base.length; i++) {
        worst = Math.max(worst, Math.abs(base[i] - other[i]));
      }
      const ok = worst < 1e-6;
      if (!ok) fails++;
      console.log('  ' + (ok ? 'ok   ' : 'FAIL ') + m.name.padEnd(18) +
        freq + ' Hz, crossline ' + String(iy).padEnd(3) +
        ' max difference ' + worst.toExponential(2));
    });
  });

  /* Striping check. A map stored with the wrong stride still draws — it comes
     out covered in stripes running along the inline direction, which looks
     enough like acquisition footprint to be believed. The signature is a step
     between neighboring inlines several times larger than the step between
     neighboring crosslines. */
  console.log('\nmaps: how much each one steps between neighbors');
  ready.forEach((m) => {
    const M = m.win.__MOD;
    let maps = [];
    // Take whatever the module returns rather than naming its maps here, so a
    // module that adds a map tab does not have to be added to a list in this
    // file as well. Anything array-like of the right length is a map.
    const collect = (obj) => Object.keys(obj)
      .filter((k) => obj[k] && obj[k].length === M.NX * M.NY)
      .map((k) => [k, obj[k]]);
    if (M.extractMaps) maps = collect(M.extractMaps());
    else if (M.extractMap) maps = [['rms', M.extractMap()]];
    else if (M.extractSlices) maps = collect(M.extractSlices());
    maps.forEach((pair) => {
      const map = pair[1], NX = M.NX, NY = M.NY;
      let mean = 0, dx = 0, dy = 0, nx = 0, ny = 0;
      for (let i = 0; i < map.length; i++) mean += Math.abs(map[i]);
      mean = mean / map.length || 1;
      for (let ix = 1; ix < NX; ix++) {
        for (let iy = 0; iy < NY; iy++) { dx += Math.abs(map[ix * NY + iy] - map[(ix - 1) * NY + iy]); nx++; }
      }
      for (let ix = 0; ix < NX; ix++) {
        for (let iy = 1; iy < NY; iy++) { dy += Math.abs(map[ix * NY + iy] - map[ix * NY + iy - 1]); ny++; }
      }
      const a = dx / nx / mean, b = dy / ny / mean;
      const striped = a > 4 * b;
      if (striped) fails++;
      console.log('  ' + (striped ? 'FAIL ' : 'ok   ') + (m.name + ' ' + pair[0]).padEnd(24) +
        'inline ' + a.toFixed(3) + '   crossline ' + b.toFixed(3));
    });
  });

  console.log(fails ? '\n' + fails + ' PROBLEM(S) FOUND'
                    : '\nthe volume is the same in every module that draws a map, and no map is striped');
  process.exit(fails ? 1 : 0);
}, 1200);
