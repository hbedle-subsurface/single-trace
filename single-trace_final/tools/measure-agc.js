const { win } = require('./harness-agc.js');
setTimeout(() => {
  const M = win.__MOD, S = M.state();
  const $ = (id) => win.document.getElementById(id).textContent;
  const reset = (o) => {
    Object.assign(S, { win: 120, cmp: 30, decay: 14, freq: 25, noise: 0, tr: 66, ts: 0.5 }, o || {});
    M.set('win', S.win); M.drawAll();
  };

  console.log('=== EX1  shallow against deep, before and after ===');
  [0, 6, 14, 20, 24].forEach((d) => {
    reset({ decay: d });
    console.log('  decay ' + String(d).padStart(2) + ' dB/s   before ' + $('s2c').padStart(5) +
      '   after ' + $('s2e').padStart(5) + '   (' + $('s2a') + ' and ' + $('s2b') + ')');
  });

  console.log('\n=== EX2  gas against brine, by AGC window ===');
  [10, 30, 60, 120, 200, 300].forEach((w) => {
    reset({ win: w });
    console.log('  window +-' + String(w).padStart(3) + ' ms   before ' + $('s3e').padStart(5) +
      '   after ' + $('s3g').padStart(5));
  });

  console.log('\n=== EX3  waveform preservation, by window ===');
  [10, 20, 30, 60, 120, 300].forEach((w) => {
    reset({ cmp: w });
    console.log('  comparison window +-' + String(w).padStart(3) + ' ms   correlation ' + $('s4d'));
  });

  console.log('\n=== EX4  the envelope, computed before and after AGC ===');
  [10, 30, 120, 300].forEach((w) => {
    reset({ win: w });
    console.log('  window +-' + String(w).padStart(3) + ' ms   envelope contrast before ' +
      $('s5c').padStart(5) + '   after ' + $('s5d'));
  });

  console.log('\n=== EX5  what survives ===');
  [10, 30, 120, 300].forEach((w) => {
    reset({ win: w });
    console.log('  window +-' + String(w).padStart(3) + ' ms   phase ' + $('s5e') +
      '   frequency ' + $('s5f'));
  });

  console.log('\n=== the gain applied at the cursor ===');
  [0.15, 0.35, 0.5, 0.75, 0.9].forEach((t) => {
    reset({ ts: t }); M.drawAll();
    console.log('  ' + (t * 1000).toFixed(0).padStart(4) + ' ms   sigma ' + $('s1r') +
      '   gain ' + $('s1x'));
  });
}, 400);
