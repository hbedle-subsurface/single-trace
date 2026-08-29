/* Modules 01, 03 and 04 run on the same synthetic line on purpose. The model
   code is copied into each file rather than shared at runtime, because a module
   has to keep working when assets/ is stale or missing. Copies drift. This
   opens all three, asks each for the same raw section, and compares them sample
   by sample, so the drift gets caught here instead of by a student noticing the
   wedge moved between modules.

   Run: node check-shared.js */
const path = require('path');

function load(harness) {
  delete require.cache[require.resolve(harness)];
  return require(harness);
}

const mods = [
  ['01 instantaneous', './harness.js'],
  ['03 rms', './harness-rms.js'],
  ['04 agc', './harness-agc.js'],
  ['05 avt', './harness-avt.js'],
  ['06 teager', './harness-teager.js'],
];

const loaded = mods.map(([name, h]) => ({ name, win: load(h).win }));

setTimeout(() => {
  const ready = loaded.filter((m) => m.win.__MOD);
  const missing = loaded.filter((m) => !m.win.__MOD);
  missing.forEach((m) => console.log('  ' + m.name + ': DID NOT INITIALISE'));
  if (ready.length < 2) { console.log('nothing to compare'); process.exit(1); }

  console.log('the synthetic line, compared across modules');
  console.log('  modules loaded: ' + ready.map((m) => m.name).join(', '));

  // every module exposes rawSection(freq, phase): the model before any gain,
  // noise or normalisation, which is the part that has to be identical
  const ref = ready[0];
  let fails = 0;

  [[25, 0], [40, 0], [15, 0]].forEach((cfg) => {
    const base = ref.win.__MOD.rawSection(cfg[0], cfg[1]);
    ready.slice(1).forEach((m) => {
      const other = m.win.__MOD.rawSection(cfg[0], cfg[1]);
      if (other.length !== base.length) {
        console.log('  FAIL ' + m.name + ' at ' + cfg[0] + ' Hz: different size');
        fails++;
        return;
      }
      let worst = 0, at = -1;
      for (let i = 0; i < base.length; i++) {
        const d = Math.abs(base[i] - other[i]);
        if (d > worst) { worst = d; at = i; }
      }
      const ok = worst === 0;
      if (!ok) fails++;
      console.log('  ' + (ok ? 'ok   ' : 'FAIL ') + m.name.padEnd(18) +
        cfg[0] + ' Hz: max difference ' + worst.toExponential(2) +
        (ok ? '' : ' at sample ' + at));
    });
  });

  // and the geometry constants that the prose quotes
  ready.forEach((m) => {
    const M = m.win.__MOD;
    console.log('  ' + m.name.padEnd(18) + 'NX=' + M.NX + ' NT=' + M.NT + ' DT=' + M.DT +
      '  shift(66)=' + (M.tShift(66) * 1000).toFixed(1) + ' ms');
  });

  console.log(fails ? '\n' + fails + ' DIFFERENCE(S) FOUND — the model has drifted'
                    : '\nevery module is running the same line');
  process.exit(fails ? 1 : 0);
}, 1200);
