const path = require('path');
const { win } = require('./harness-impedance.js');

setTimeout(() => {
  const M = win.__MOD, S = M.state();
  const $ = (id) => win.document.getElementById(id).textContent;
  const reset = (o) => {
    Object.assign(S, { flow: 8, phase: 0, contrast: 1, noise: 0, cut: 5, tr: 66, ts: 0.168 }, o || {});
    M.set('flow', S.flow);
    M.drawAll();
  };

  console.log('=== EX1  the limestone: boundaries and events ===');
  reset();
  const C = M.cur();
  const s = M.tShift(66);
  C.bounds.filter((b) => b.t > 0.10 && b.t < 0.24).forEach((b) => {
    console.log('  boundary at ' + (b.t * 1000).toFixed(0) + ' ms   r = ' +
      (b.r >= 0 ? '+' : '') + b.r.toFixed(3) + '   Z ' + b.z1.toFixed(2) + ' -> ' + b.z2.toFixed(2));
  });
  {
    // the impedance inside the limestone, and how flat the trace is there
    const i0 = M.iOf(0.165 + s - 0.14 + 0.14), i1 = M.iOf(0.190);
    let mx = 0;
    for (let i = M.iOf(0.168); i <= M.iOf(0.186); i++) mx = Math.max(mx, Math.abs(C.u[i]));
    console.log('  impedance inside it: ' + C.z[M.iOf(0.175)].toFixed(2) +
      ',  largest trace value between the two boundaries: ' + mx.toFixed(3));
  }

  console.log('\n=== EX2  the compaction trend ===');
  reset();
  console.log('  true impedance top vs bottom : ' + $('s4t'));
  console.log('  attribute at the same places : ' + $('s4r'));
  console.log('  match with the full log      : ' + $('s4a'));
  console.log('  match with the trend removed : ' + $('s4b'));

  console.log('\n=== EX3  buying the low frequencies back ===');
  [20, 16, 12, 8, 6, 4].forEach((f) => {
    reset({ flow: f });
    console.log('  lowest recorded ' + String(f).padStart(2) + ' Hz   full-log match ' +
      $('s4a').padStart(6) + '   trend-removed match ' + $('s4b'));
  });

  console.log('\n=== EX4  the small-contrast assumption, in this model ===');
  {
    const rows = [];
    [0.3, 0.6, 1.0, 1.5, 2.0, 2.5, 3.0].forEach((c) => {
      reset({ contrast: c });
      const C2 = M.cur();
      let mr = 0;
      C2.bounds.forEach((b) => { mr = Math.max(mr, Math.abs(b.r)); });
      const i0 = M.iOf(0.09), i1 = M.iOf(0.93);
      let sa = 0, sb = 0;
      for (let i = i0; i <= i1; i++) { sa += C2.rai[i] * C2.rai[i]; sb += C2.halfBand[i] * C2.halfBand[i]; }
      rows.push({ c: c, r: mr, ratio: Math.sqrt(sa / sb), corr: +$('s2c') });
    });
    const base = rows[0].ratio;
    rows.forEach((r) => {
      console.log('  contrast x' + r.c.toFixed(1) + '   largest |r| ' + r.r.toFixed(3) +
        '   recovers ' + (100 * r.ratio / base).toFixed(1) + '% of the log impedance' +
        '   correlation ' + r.corr.toFixed(3));
    });
  }

  console.log('\n=== EX5  the filter ===');
  [[20, 5], [20, 0], [40, 5], [40, 0], [20, 12], [20, 2]].forEach((q) => {
    reset({ noise: q[0], cut: q[1] });
    console.log('  noise ' + String(q[0]).padStart(2) + '%, corner ' +
      (q[1] ? q[1] + ' Hz' : 'off').padStart(5) +
      '   filtered ' + $('s5f').padStart(6) + '   unfiltered ' + $('s5u').padStart(6) +
      '   ratio ' + $('s5x').padStart(5) + '   match ' + $('s5m'));
  });

  console.log('\n=== the quarter-cycle shift against frequency ===');
  [4, 8, 12, 16, 20].forEach((f) => {
    reset({ flow: f });
    console.log('  lowest recorded ' + String(f).padStart(2) + ' Hz   shift ' +
      $('s3g').padStart(6) + '   quarter cycle ' + $('s3q'));
  });

  console.log('\n=== the wavelet assumption ===');
  [0, 30, 60, 90, 180].forEach((ph) => {
    reset({ phase: ph });
    console.log('  phase ' + String(ph).padStart(4) + '   match ' + $('s2a').padStart(7) +
      '   shift ' + $('s3g'));
  });
}, 400);
