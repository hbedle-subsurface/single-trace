/* Headless harness: opens the module in jsdom with a stubbed canvas, drives
   every control, and prints the readouts. Both a regression test and the
   measuring instrument every number in the prose comes from. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM, VirtualConsole } = require('jsdom');

const MOD = process.argv[2] || 'modules/instantaneous.html';

/* ---- a canvas context that records nothing and throws nothing ---- */
function stubCtx() {
  const noop = () => {};
  const ctx = {
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
  return ctx;
}

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (m) => errors.push('console.error: ' + m));

const html = fs.readFileSync(path.join(ROOT, MOD), 'utf8')
  // jsdom will not fetch ../assets, so inline the two libraries
  .replace('<script src="../assets/seismic.js"></script>',
    '<script>' + fs.readFileSync(path.join(ROOT, 'assets/seismic.js'), 'utf8') + '</script>')
  .replace('<script src="../assets/trace.js"></script>',
    '<script>' + fs.readFileSync(path.join(ROOT, 'assets/trace.js'), 'utf8') + '</script>');

const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  url: 'https://example.org/modules/instantaneous.html',
  beforeParse(window) {
    // the stubs have to be in place before the inline script runs
    window.HTMLCanvasElement.prototype.getContext = function () { return stubCtx(); };
    window.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
    // jsdom reports zero widths; the module skips drawing when the parent has
    // none, so give every element a plausible content box
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
  // give the inline script a tick to run
  setTimeout(() => {
    const M = win.__MOD;
    if (!M) { console.log('MODULE DID NOT INITIALISE'); errors.forEach(e => console.log(e)); process.exit(1); }
    const $ = (id) => { const el = win.document.getElementById(id); return el ? el.textContent : '(missing)'; };
    const IDS = ['s1t', 's1u', 's1h', 's1e', 's1p', 's2e', 's2u', 's2m', 's2pt', 's2pe',
      's3p', 's3c', 's3e', 's3a', 's3b', 's4i', 's4a', 's4w', 's4r', 's4n', 's4k',
      's5s', 's5g', 's5b', 's5r', 's5e'];

    function dump(label) {
      M.drawAll();
      console.log('\n== ' + label + '  ' + JSON.stringify({
        freq: M.state().freq, phase: M.state().phase, decay: M.state().decay,
        noise: M.state().noise, win: M.state().win, tr: M.state().tr,
        ts: +M.state().ts.toFixed(3),
      }));
      IDS.forEach((id) => console.log('   ' + id.padEnd(5) + ' ' + $(id)));
    }

    console.log('--- structural checks ---');
    const ids = [...html.matchAll(/\$\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]);
    const missing = [...new Set(ids)].filter((id) => !win.document.getElementById(id));
    console.log('  $(id) references with no element: ' + (missing.length ? missing.join(', ') : 'none'));
    const panes = ['p1', 'p2', 'p3', 'p4', 'p5', 'pw', 'pe', 'pk', 'pm'];
    console.log('  panes present: ' + panes.every(p => win.document.getElementById(p)));
    const labels = [...win.document.querySelectorAll('#tabs button')].map(b => b.textContent);
    console.log('  tab label characters: ' + labels.join('').length + ' (keep under 115)');
    const unresolved = (html.match(/\{\{[A-Z0-9]+\}\}/g) || []);
    console.log('  unresolved placeholders: ' + (unresolved.length ? unresolved.join(' ') : 'none'));

    console.log('\n--- shared library vs local fallback ---');
    {
      const u = M.traceAt(40);
      const a = M.T.complexTrace(u, M.DT, { K: 8 });
      const b = M.LOCALT.complexTrace(u, M.DT, { K: 8 });
      let worst = 0;
      ['env', 'phase', 'cosPhase', 'freq', 'favg', 'wfreq', 'sweet'].forEach((k) => {
        let d = 0;
        for (let i = 0; i < a[k].length; i++) d = Math.max(d, Math.abs(a[k][i] - b[k][i]));
        worst = Math.max(worst, d);
        console.log('   ' + k.padEnd(9) + ' max difference ' + d.toExponential(2));
      });
      console.log('   ' + (worst < 1e-9 ? 'identical' : 'DIVERGENT'));
    }

    // every tab renders
    console.log('\n--- every tab renders without throwing ---');
    panes.forEach((p) => { M.showTab(p); console.log('   ' + p + ' ok'); });
    M.showTab('p1');

    dump('defaults');
    M.set('phase', 90); dump('phase 90');
    M.set('phase', 0);
    M.set('decay', 24); dump('decay 24 dB/s');
    M.set('decay', 6);
    M.set('noise', 30); dump('noise 30%');
    M.set('noise', 0);
    M.set('win', 4); dump('window 4 ms');
    M.set('win', 60); dump('window 60 ms');
    M.set('win', 16);
    M.set('freq', 40); dump('freq 40 Hz');
    M.set('freq', 12); dump('freq 12 Hz');
    M.set('freq', 25);
    M.state().tr = 80; M.set('win', 16); dump('trace 80 (thin wedge)');
    M.state().tr = 20; M.set('win', 16); dump('trace 20 (brine, thick wedge)');
    M.state().tr = 66; M.set('win', 16);

    console.log('\n--- errors ---');
    console.log(errors.length ? errors.join('\n') : '  none');
  }, 300);
}
