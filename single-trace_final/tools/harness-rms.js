/* Headless harness for module 02. Same idea as harness.js: open the page in
   jsdom with a stubbed canvas, drive every control, print every readout. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM, VirtualConsole } = require('jsdom');

const MOD = process.argv[2] || 'modules/rms.html';

function stubCtx() {
  const noop = () => {};
  return {
    canvas: { width: 900, height: 400 },
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop,
    lineTo: noop, arc: noop, rect: noop, clip: noop, fill: noop, stroke: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, setLineDash: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop,
    drawImage: noop, putImageData: noop,
    measureText: (t) => ({ width: String(t).length * 6 }),
    fillText: noop, strokeText: noop,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
  };
}

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (m) => errors.push('console.error: ' + m));

const html = fs.readFileSync(path.join(ROOT, MOD), 'utf8')
  .replace('<script src="../assets/seismic.js"></script>',
    '<script>' + fs.readFileSync(path.join(ROOT, 'assets/seismic.js'), 'utf8') + '</script>')
  .replace('<script src="../assets/trace.js"></script>',
    '<script>' + fs.readFileSync(path.join(ROOT, 'assets/trace.js'), 'utf8') + '</script>')
  .replace('<script src="../assets/count.js"></script>', '');

const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  url: 'https://example.org' + '/' + MOD,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function () { return stubCtx(); };
    window.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
    Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 900; } });
    Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 400; } });
    const origCS = window.getComputedStyle;
    window.getComputedStyle = function (el) {
      const cs = origCS.call(window, el);
      return new Proxy(cs, {
        get(t, k) {
          if (k === 'paddingLeft' || k === 'paddingRight') return '26px';
          const v = t[k];
          return typeof v === 'function' ? v.bind(t) : v;
        },
      });
    };
    window.Element.prototype.getBoundingClientRect = function () {
      return { x: 0, y: 0, left: 0, top: 0, right: 900, bottom: 400, width: 900, height: 400 };
    };
  },
});
const win = dom.window;

module.exports = { win, errors };

if (require.main === module) {
  setTimeout(() => {
    const M = win.__MOD;
    if (!M) { console.log('MODULE DID NOT INITIALISE'); errors.forEach((e) => console.log(e)); process.exit(1); }
    const $ = (id) => { const el = win.document.getElementById(id); return el ? el.textContent : '(missing)'; };
    const IDS = ['s1w', 's1n', 's1r', 's1m', 's1u', 's2a', 's2b', 's2c', 's2d', 's2e', 's2k',
      's3a', 's3b', 's3c', 's3d', 's3e', 's3f', 's3g',
      's4t', 's4w', 's4a', 's4b', 's4c', 's4d', 's5t', 's5s', 's5n', 's5m', 's5p',
      's6a', 's6b', 's6c', 's6d', 's6e', 's6f'];

    function dump(label) {
      M.drawAll();
      const S = M.state();
      console.log('\n== ' + label + '  ' + JSON.stringify({
        win: S.win, decay: S.decay, freq: S.freq, noise: S.noise,
        tr: S.tr, ts: +S.ts.toFixed(3),
      }));
      IDS.forEach((id) => console.log('   ' + id.padEnd(5) + ' ' + $(id)));
    }

    console.log('--- structural checks ---');
    const ids = [...html.matchAll(/\$\('([A-Za-z0-9_]+)'\)/g)].map((m) => m[1]);
    const missing = [...new Set(ids)].filter((id) => !win.document.getElementById(id));
    console.log('  $(id) references with no element: ' + (missing.length ? missing.join(', ') : 'none'));
    const panes = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'pw', 'pe', 'pk', 'pm'];
    console.log('  panes present: ' + panes.every((p) => win.document.getElementById(p)));
    const labels = [...win.document.querySelectorAll('#tabs button')].map((b) => b.textContent);
    console.log('  tab label characters: ' + labels.join('').length + ' (keep under 115)');
    const unresolved = (html.match(/\{\{[A-Z0-9]+\}\}/g) || []);
    console.log('  unresolved placeholders: ' + (unresolved.length ? unresolved.join(' ') : 'none'));

    console.log('\n--- shared library vs local fallback ---');
    {
      const u = M.traceAt(40, M.field());
      let worst = 0;
      [['runningRMS', (L) => L.runningRMS(u, 20)],
       ['runningStd', (L) => L.runningStd(u, 20)],
       ['agc', (L) => L.agc(u, 40).out],
       ['envelope', (L) => L.envelope(u, L.hilbert(u))]].forEach((q) => {
        const a = q[1](M.T), b = q[1](M.LOCALT);
        let d = 0;
        for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
        worst = Math.max(worst, d);
        console.log('   ' + q[0].padEnd(14) + ' max difference ' + d.toExponential(2));
      });
      const c1 = M.T.correlation(u, u, 0, M.NT - 1), c2 = M.LOCALT.correlation(u, u, 0, M.NT - 1);
      console.log('   correlation    ' + (Math.abs(c1 - c2) < 1e-12 ? 'identical' : 'DIVERGENT'));
      console.log('   ' + (worst < 1e-9 ? 'identical' : 'DIVERGENT'));
    }

    console.log('\n--- every tab renders without throwing ---');
    panes.forEach((p) => { M.showTab(p); console.log('   ' + p + ' ok'); });
    M.showTab('p1');

    dump('defaults');
    const S = M.state();
    S.win = 4; M.set('win', 4); dump('window 4 ms');
    S.win = 80; M.set('win', 80); dump('window 80 ms');
    S.win = 20; M.set('win', 20);
    S.noise = 20; M.set('noise', 20); dump('noise 20%');
    S.noise = 40; M.set('noise', 40); dump('noise 40%');
    S.noise = 0; M.set('noise', 0);
    S.decay = 0; M.set('decay', 0); dump('no decay');
    S.decay = 8; M.set('decay', 8);
    S.freq = 40; M.set('freq', 40); dump('40 Hz');
    S.freq = 25; M.set('freq', 25);
    S.tr = 20; M.set('tr', 20); dump('trace 20 (brine sand)');
    S.tr = 66; M.set('tr', 66);
    S.mtop = 80; S.mlen = 40; M.set('mtop', 80); dump('map window 80-120 ms (the channel)');
    S.mtop = 0; S.mlen = 60; M.set('mtop', 0);

    console.log('\n--- the volume reduces to the line at the reference crossline ---');
    {
      const sec = M.crosslineSection(M.IY0);
      const ref = M.field();
      let worst = 0;
      for (let i = 0; i < ref.length; i++) worst = Math.max(worst, Math.abs(sec[i] - ref[i]));
      /* Float32 rounding, not a model difference: the two paths add the same
         terms in a different order. Anything above about 1e-6 would mean the
         volume and the line had genuinely parted company. */
      console.log('   max difference: ' + worst.toExponential(2) +
        (worst < 1e-6 ? '  (identical to Float32 precision)' : '  DIVERGENT'));
      console.log('   channel never reaches it: closest approach ' +
        M.channelReach().toFixed(1) + ' crosslines');
    }

    console.log('\n--- errors ---');
    console.log(errors.length ? errors.join('\n') : '  none');
  }, 400);
}
