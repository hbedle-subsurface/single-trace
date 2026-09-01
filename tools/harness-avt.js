/* Headless harness for module 02. Same idea as harness.js: open the page in
   jsdom with a stubbed canvas, drive every control, print every readout. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM, VirtualConsole } = require('jsdom');

const MOD = process.argv[2] || 'modules/avt.html';

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
    const IDS = ['s1u', 's1e', 's1r', 's1a', 's1w', 's2a', 's2b', 's2c', 's2d', 's2e', 's2f',
      's3a', 's3b', 's3c', 's3d', 's3e', 's3f', 's3g',
      's4w', 's4a', 's4b', 's4c', 's4d', 's4e', 's5a', 's5b', 's5c', 's5d', 's5e',
      's6a', 's6b', 's6c', 's6d', 's6e', 's6f', 's6g'];

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
      [['avt', (L) => L.avt(u, M.DT, 12).avt],
       ['envelope RMS', (L) => L.avt(u, M.DT, 12).envRms],
       ['integrate', (L) => L.integrate(u, M.DT, { f1: 5, f2: 10, f3: 70, f4: 90 })],
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

    console.log('\n--- every tab renders, and shows its own pane ---');
    // Not just "did not throw". A tab whose id is missing from the module's
    // PANES list still highlights and still redraws; it simply leaves every
    // pane hidden, so the step looks blank. That is invisible to a check that
    // only watches for exceptions, and it has happened once.
    panes.forEach((p) => {
      M.showTab(p);
      const shown = panes.filter((q) => {
        const el = win.document.getElementById(q);
        return el && !el.hidden;
      });
      const ok = shown.length === 1 && shown[0] === p;
      console.log('   ' + p + (ok ? ' ok' : '   FAIL visible: [' + shown.join(', ') + ']'));
    });
    M.showTab('p1');

    dump('defaults');
    const S = M.state();
    S.win = 4; M.set('win', 4); dump('window 4 ms');
    S.win = 80; M.set('win', 80); dump('window 80 ms');
    S.win = 24; M.set('win', 24);
    S.noise = 20; M.set('noise', 20); dump('noise 20%');
    S.noise = 40; M.set('noise', 40); dump('noise 40%');
    S.noise = 0; M.set('noise', 0);
    S.decay = 0; M.set('decay', 0); dump('no decay');
    S.decay = 8; M.set('decay', 8);
    S.freq = 40; M.set('freq', 40); dump('40 Hz');
    S.freq = 12; M.set('freq', 12); dump('12 Hz');
    S.freq = 25; M.set('freq', 25);
    S.tr = 20; M.set('tr', 20); dump('trace 20 (brine sand)');
    S.tr = 66; M.set('tr', 66);

    console.log('\n--- the volume reduces to the line at the reference crossline ---');
    {
      const sec = M.crosslineSection(M.IY0);
      const ref = M.field();
      let worst = 0;
      for (let i = 0; i < ref.length; i++) worst = Math.max(worst, Math.abs(sec[i] - ref[i]));
      console.log('   max difference: ' + worst.toExponential(2) +
        (worst < 1e-6 ? '  (identical to Float32 precision)' : '  DIVERGENT'));
    }

    console.log('\n--- map view: the channel on each slice ---');
    {
      M.showTab('p6');
      [60, 78, 84, 93, 105, 120].forEach((t) => {
        M.state().mtop = t; M.drawAll();
        console.log('   ' + String(t).padStart(4) + ' ms   amplitude ' + $('s6d') +
          '   AVT ' + $('s6e'));
      });
      M.state().mtop = 93; M.showTab('p1');
    }

    console.log('\n--- errors ---');
    console.log(errors.length ? errors.join('\n') : '  none');
  }, 400);
}
