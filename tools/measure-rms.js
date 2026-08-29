const { win } = require('./harness-rms.js');
setTimeout(() => {
  const M = win.__MOD, S = M.state();
  const $ = (id) => win.document.getElementById(id).textContent;
  const reset = (o) => {
    Object.assign(S, { win: 20, decay: 8, freq: 25, noise: 0, tr: 66, ts: 0.5 }, o || {});
    M.set('win', S.win); M.drawAll();
  };

  console.log('=== EX1  short-window RMS against the envelope ===');
  [[25, 66], [40, 66], [15, 66], [25, 20]].forEach((q) => {
    reset({ freq: q[0], tr: q[1] });
    console.log('  ' + String(q[0]).padStart(2) + ' Hz, trace ' + String(q[1]).padStart(2) +
      '   ratio ' + $('s2d').padEnd(14) + ' correlation ' + $('s2e'));
  });
  console.log('  1/sqrt(2) = ' + (1 / Math.SQRT2).toFixed(3));

  console.log('\n=== EX2  RMS 60 ms above the sand, where nothing is ===');
  [4, 8, 12, 20, 40, 60, 80].forEach((w) => {
    reset({ win: w });
    console.log('  window +-' + String(w).padStart(2) + ' ms   RMS ' + $('s4a'));
  });

  console.log('\n=== EX3  how tall the anomaly gets ===');
  [4, 8, 20, 40, 60, 80].forEach((w) => {
    reset({ win: w });
    console.log('  window +-' + String(w).padStart(2) + ' ms   envelope ' + $('s3a').split(' ')[0].padStart(4) +
      ' ms    RMS ' + $('s3b'));
  });

  console.log('\n=== EX4  the noise floor, and the triangle ===');
  [0, 10, 20, 30, 40].forEach((nz) => {
    reset({ noise: nz });
    console.log('  noise ' + String(nz).padStart(2) + '%   at ' + $('s5t').padStart(7) +
      '   signal ' + $('s5s') + '   noise ' + $('s5n') +
      '   measured ' + $('s5m') + '   predicted ' + $('s5p'));
  });

  console.log('\n=== EX5  gas against brine, on RMS and on amplitude ===');
  [4, 20, 40, 80].forEach((w) => {
    reset({ win: w });
    console.log('  window +-' + String(w).padStart(2) + ' ms   gas ' + $('s3c') + '   brine ' + $('s3d') +
      '   RMS ratio ' + $('s3e').padStart(5) + '   amplitude ratio ' + $('s3f'));
  });

  console.log('\n=== the window in samples ===');
  [4, 20, 80].forEach((w) => {
    reset({ win: w });
    console.log('  +-' + String(w).padStart(2) + ' ms = ' + $('s1n') + ' samples');
  });
}, 400);
