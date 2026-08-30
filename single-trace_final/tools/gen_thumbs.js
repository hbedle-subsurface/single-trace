/* Thumbnails for the landing page, computed rather than drawn. Each one is the
   real attribute, run on the same short synthetic trace, so that the picture on
   the card cannot disagree with the module behind it. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = { console, module: { exports: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/seismic.js'), 'utf8') + '\n;this.SEIS=SEIS;', ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/trace.js'), 'utf8') + '\n;this.TRACE=TRACE;', ctx);
const SEIS = ctx.SEIS, T = ctx.TRACE;

const N = 256, DT = 0.002;
const wav = SEIS.makeWavelet({ f: 26 });
const spikes = [
  { t: 0.070, r: 0.9 }, { t: 0.130, r: -0.5 },
  { t: 0.210, r: 0.75 }, { t: 0.243, r: -0.75 },
  { t: 0.320, r: -0.55 }, { t: 0.352, r: 0.55 },
  { t: 0.410, r: 0.30 }, { t: 0.438, r: -0.28 }, { t: 0.462, r: 0.26 },
];
const u = SEIS.traceFromSpikes(spikes, 0, DT, N, wav);
// a decay, so the AGC and RMS cards have something to correct
const ud = new Float32Array(N);
for (let i = 0; i < N; i++) ud[i] = u[i] * Math.pow(10, -14 * (i * DT) / 20);

const W = 200, H = 104, PAD = 6;
const xOf = (i) => PAD + (i / (N - 1)) * (W - 2 * PAD);
const yOf = (v, lo, hi, top, bot) => bot - ((v - lo) / (hi - lo)) * (bot - top);

function span(a, from, to) {
  let lo = Infinity, hi = -Infinity;
  for (let i = from; i <= to; i++) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
  if (!isFinite(lo)) { lo = -1; hi = 1; }
  const pad = (hi - lo) * 0.08 || 1;
  return [lo - pad, hi + pad];
}

function poly(a, lo, hi, top, bot, color, width, dash) {
  let d = '';
  for (let i = 0; i < N; i += 1) {
    d += (i ? ' ' : '') + xOf(i).toFixed(1) + ',' + yOf(a[i], lo, hi, top, bot).toFixed(1);
  }
  return '<polyline points="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + width +
    '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' stroke-linejoin="round"/>';
}

function area(a, lo, hi, top, bot, fill) {
  let d = 'M' + xOf(0).toFixed(1) + ',' + bot.toFixed(1);
  for (let i = 0; i < N; i++) d += ' L' + xOf(i).toFixed(1) + ',' + yOf(a[i], lo, hi, top, bot).toFixed(1);
  d += ' L' + xOf(N - 1).toFixed(1) + ',' + bot.toFixed(1) + ' Z';
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

const INK = '#16191C', CRIM = '#841617', TEAL = '#0B7285', BG = '#F6F4EE';
const open = '<svg viewBox="0 0 200 104" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ' +
  'preserveAspectRatio="xMidYMid meet"><rect width="200" height="104" fill="' + BG + '"/>';
const close = '</svg>';

const out = {};

/* 01 instantaneous: the trace inside its envelope */
{
  const uh = T.hilbert(u), e = T.envelope(u, uh), ne = new Float32Array(N);
  for (let i = 0; i < N; i++) ne[i] = -e[i];
  const [lo, hi] = span(e, 0, N - 1);
  out['01'] = open
    + poly(u, -hi, hi, 8, 96, INK, 1.3)
    + poly(e, -hi, hi, 8, 96, CRIM, 1.5)
    + poly(ne, -hi, hi, 8, 96, CRIM, 1.5)
    + close;
}

/* 02 relative acoustic impedance: the same trace integrated */
{
  const z = new Float32Array(N);
  let acc = 0;
  for (let i = 0; i < N; i++) { acc = acc * 0.985 + u[i]; z[i] = acc; }   // leaky integral
  const [alo, ahi] = span(u, 0, N - 1), [zlo, zhi] = span(z, 0, N - 1);
  out['02'] = open
    + poly(u, alo, ahi, 6, 50, 'rgba(22,25,28,.45)', 1.1)
    + area(z, zlo, zhi, 56, 98, 'rgba(11,114,133,.16)')
    + poly(z, zlo, zhi, 56, 98, TEAL, 1.8)
    + close;
}

/* 03 RMS amplitude: two window lengths on one trace */
{
  const s = T.runningRMS(ud, 5), l = T.runningRMS(ud, 25);
  const [lo, hi] = span(ud, 0, N - 1);
  out['03'] = open
    + poly(ud, lo, hi, 8, 96, 'rgba(22,25,28,.5)', 1.1)
    + poly(s, lo, hi, 8, 96, TEAL, 1.6)
    + poly(l, lo, hi, 8, 96, CRIM, 1.8)
    + close;
}

/* 04 AGC: before, and after dividing by the running RMS */
{
  const r = T.runningRMS(ud, 25), g = new Float32Array(N);
  for (let i = 0; i < N; i++) g[i] = ud[i] / (r[i] + 1e-9);
  const [alo, ahi] = span(ud, 0, N - 1), [glo, ghi] = span(g, 0, N - 1);
  const m1 = Math.max(Math.abs(alo), Math.abs(ahi)), m2 = Math.max(Math.abs(glo), Math.abs(ghi));
  out['04'] = open
    + poly(ud, -m1, m1, 6, 50, 'rgba(22,25,28,.55)', 1.2)
    + poly(g, -m2, m2, 56, 98, CRIM, 1.4)
    + close;
}

/* 05 AVT: envelope, its running RMS, and the inverse Hilbert of that */
{
  const uh = T.hilbert(u), e = T.envelope(u, uh);
  const er = T.runningRMS(e, 8);
  const back = T.hilbert(er);
  const m = Math.max(...er), mb = Math.max(...back.map(Math.abs));
  out['05'] = open
    + area(er, 0, m * 1.1, 6, 50, 'rgba(132,22,23,.14)')
    + poly(er, 0, m * 1.1, 6, 50, CRIM, 1.5)
    + poly(back, -mb * 1.1, mb * 1.1, 56, 98, TEAL, 1.5)
    + close;
}

/* 06 Teager-Kaiser: (du/dt)^2 - u d2u/dt2 */
{
  const d1 = T.deriv(u, DT), d2 = T.deriv(d1, DT);
  const tk = new Float32Array(N);
  for (let i = 0; i < N; i++) tk[i] = d1[i] * d1[i] - u[i] * d2[i];
  const m = Math.max(...tk);
  const [alo, ahi] = span(u, 0, N - 1);
  const ma = Math.max(Math.abs(alo), Math.abs(ahi));
  out['06'] = open
    + poly(u, -ma, ma, 6, 50, 'rgba(22,25,28,.45)', 1.1)
    + area(tk, 0, m * 1.08, 56, 98, 'rgba(11,114,133,.16)')
    + poly(tk, 0, m * 1.08, 56, 98, TEAL, 1.5)
    + close;
}

fs.writeFileSync(path.join(__dirname, 'thumbs.json'), JSON.stringify(out, null, 0));
Object.keys(out).forEach((k) => console.log(k, out[k].length + ' chars'));
