const { win, errors } = require('./harness.js');
setTimeout(() => {
  const M = win.__MOD, S = M.state();
  const $ = (id) => win.document.getElementById(id).textContent;
  const set = (o) => { Object.keys(o).forEach((k) => { S[k] = o[k]; }); M.set('freq', S.freq); M.drawAll(); };

  console.log('=== EX1  envelope vs trace peak under rotation (trace 66) ===');
  [0, 45, 90, 135, 180].forEach((ph) => {
    set({ phase: ph, tr: 66, ts: 0.158, freq: 25, decay: 6, noise: 0, win: 16 });
    console.log('  phase ' + String(ph).padStart(4) + '   trace peak ' + $('s2pt').padEnd(18) +
      ' envelope peak ' + $('s2pe').padEnd(9) + ' envelope ' + $('s2m'));
  });

  console.log('\n=== EX2  the dim reflector, envelope vs cos phase ===');
  [[6, 0], [24, 0], [6, 30]].forEach((q) => {
    set({ phase: 0, tr: 66, ts: 0.158, freq: 25, decay: q[0], noise: q[1], win: 16 });
    console.log('  decay ' + String(q[0]).padStart(2) + ' dB/s, noise ' + String(q[1]).padStart(2) +
      '%   envelope ' + $('s3a').padEnd(34) + ' cos phi ' + $('s3b'));
  });

  console.log('\n=== EX3  instantaneous frequency range ===');
  [[25, 66], [40, 66], [12, 66], [25, 20], [25, 80], [25, 44]].forEach((q) => {
    set({ phase: 0, freq: q[0], tr: q[1], ts: 0.158, decay: 6, noise: 0, win: 16 });
    console.log('  f0=' + String(q[0]).padStart(2) + ' Hz, trace ' + String(q[1]).padStart(2) +
      '   range ' + $('s4r').padEnd(20) + ' negative ' + $('s4n'));
  });

  console.log('\n=== EX4  the three frequencies at one unstable sample ===');
  [[20, 0.158], [20, 0.360], [66, 0.158], [66, 0.300]].forEach((q) => {
    [4, 16, 60].forEach((wn) => {
      set({ phase: 0, freq: 25, tr: q[0], ts: q[1], decay: 6, noise: 0, win: wn });
      M.set('win', wn); M.drawAll();
      console.log('  trace ' + q[0] + ' at ' + (q[1] * 1000).toFixed(0) + ' ms, window +-' +
        String(wn).padStart(2) + ' ms   inst ' + $('s4i').padEnd(9) +
        ' avg ' + $('s4a').padEnd(9) + ' wavelet ' + $('s4w'));
    });
  });

  console.log('\n=== EX5  gas vs brine ===');
  [[25, 6], [25, 0], [40, 6], [12, 6]].forEach((q) => {
    set({ phase: 0, freq: q[0], tr: 66, ts: 0.5, decay: q[1], noise: 0, win: 16 });
    console.log('  f0=' + String(q[0]).padStart(2) + ' decay=' + String(q[1]).padStart(2) +
      '  gas ' + $('s5g').padEnd(30) + ' brine ' + $('s5b').padEnd(30) +
      ' sweet ' + $('s5r') + '  env ' + $('s5e'));
  });

  console.log('\n=== the wedge: envelope with no change in reflection coefficient ===');
  set({ phase: 0, freq: 25, tr: 66, ts: 0.35, decay: 0, noise: 0, win: 16 });
  const A = M.attrs();
  [8, 20, 32, 44, 56, 68, 80, 88].forEach((ix) => {
    const sh = M.tShift(ix);
    const i0 = M.iOf(0.30 + sh), i1 = M.iOf(0.40 + sh);
    let mx = 0, at = 0;
    for (let i = i0; i <= i1; i++) {
      const v = A.env[ix * M.NT + i];
      if (v > mx) { mx = v; at = i; }
    }
    const gap = (0.040 - 0.038 * Math.max(0, Math.min(1, (ix - 8) / 80))) * 1000;
    console.log('  trace ' + String(ix).padStart(2) + '  bed thickness ' + gap.toFixed(0).padStart(2) +
      ' ms   peak envelope ' + mx.toFixed(3) + ' at ' + (M.tOf(at) * 1000).toFixed(0) + ' ms');
  });

  console.log('\n=== instantaneous frequency at a Ricker peak vs 2/sqrt(pi) * f ===');
  [12, 20, 25, 32, 40, 45].forEach((f) => {
    set({ phase: 0, freq: f, tr: 66, ts: 0.158, decay: 6, noise: 0, win: 16 });
    const pred = 2 * f / Math.sqrt(Math.PI);
    console.log('  f0=' + String(f).padStart(2) + '   measured ' + $('s4k').split(' ')[0].padStart(6) +
      ' Hz   2f/sqrt(pi) = ' + pred.toFixed(1) + ' Hz');
  });

  console.log('\nerrors: ' + (errors.length ? errors.join('\n') : 'none'));
}, 400);
