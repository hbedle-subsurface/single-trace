/* Verify trace.js against closed forms. Run: node verify_trace.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = { console, module: { exports: {} }, window: undefined };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/seismic.js'), 'utf8') + '\n;this.SEIS = SEIS;', ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/trace.js'), 'utf8') + '\n;this.TRACE = TRACE;', ctx);
const SEIS = ctx.SEIS, T = ctx.TRACE;

let fails = 0;
function check(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name.padEnd(52) +
    'got ' + got.toFixed(5) + '   want ' + want.toFixed(5) + '  (tol ' + tol + ')');
}

const dt = 0.002, n = 1024;
const t = i => i * dt;

/* ---- 1. Hilbert sign and accuracy: u=cos -> uH=sin ---- */
{
  const f = 25;
  const u = new Float32Array(n), ref = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = Math.exp(-0.5 * Math.pow((t(i) - 1.0) / 0.25, 2));   // fat taper
    u[i] = g * Math.cos(2 * Math.PI * f * t(i));
    ref[i] = g * Math.sin(2 * Math.PI * f * t(i));
  }
  const uh = T.hilbert(u);
  let err = 0, amp = 0;
  for (let i = 200; i < n - 200; i++) { err = Math.max(err, Math.abs(uh[i] - ref[i])); amp = Math.max(amp, Math.abs(ref[i])); }
  check('Hilbert of cos is +sin (max err / amp)', err / amp, 0, 0.01);
}

/* ---- 2. FFT derivative: d/dt sin(wt) = w cos(wt) ---- */
{
  const f = 20, w = 2 * Math.PI * f;
  const x = new Float32Array(n), ref = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = Math.exp(-0.5 * Math.pow((t(i) - 1.0) / 0.25, 2));
    x[i] = g * Math.sin(w * t(i));
    ref[i] = w * g * Math.cos(w * t(i));          // ignores the slow taper term
  }
  const d = T.deriv(x, dt);
  let err = 0, amp = 0;
  for (let i = 300; i < n - 300; i++) { err = Math.max(err, Math.abs(d[i] - ref[i])); amp = Math.max(amp, Math.abs(ref[i])); }
  check('d/dt sin = w cos (max err / amp)', err / amp, 0, 0.05);
}

/* ---- 3. Envelope of a Gaussian packet is the Gaussian ---- */
{
  const f = 30;
  const u = new Float32Array(n), g = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    g[i] = Math.exp(-0.5 * Math.pow((t(i) - 1.0) / 0.06, 2));
    u[i] = g[i] * Math.cos(2 * Math.PI * f * (t(i) - 1.0));
  }
  const env = T.envelope(u, T.hilbert(u));
  let err = 0;
  for (let i = 300; i < n - 300; i++) err = Math.max(err, Math.abs(env[i] - g[i]));
  check('envelope of Gaussian packet = Gaussian', err, 0, 0.01);
  // and the envelope peak sits at the packet centre
  let pi = 0; for (let i = 0; i < n; i++) if (env[i] > env[pi]) pi = i;
  check('envelope peak time (s)', t(pi), 1.0, 0.003);
}

/* ---- 4. Instantaneous frequency of a constant-frequency packet ---- */
{
  const f = 28;
  const u = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    u[i] = Math.exp(-0.5 * Math.pow((t(i) - 1.0) / 0.08, 2)) * Math.cos(2 * Math.PI * f * (t(i) - 1.0));
  }
  const uh = T.hilbert(u);
  const fi = T.instFreq(u, uh, dt);
  check('inst. freq at packet centre (Hz)', fi[500], f, 0.5);
}

/* ---- 5. Instantaneous frequency of a linear chirp tracks the chirp ---- */
{
  const f0 = 10, rate = 40;                    // Hz per second
  const u = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const tt = t(i);
    const g = Math.exp(-0.5 * Math.pow((tt - 1.0) / 0.30, 2));
    u[i] = g * Math.cos(2 * Math.PI * (f0 * tt + 0.5 * rate * tt * tt));
  }
  const fi = T.instFreq(u, T.hilbert(u), dt);
  check('chirp inst. freq at t=0.8 s', fi[400], f0 + rate * 0.8, 0.6);
  check('chirp inst. freq at t=1.2 s', fi[600], f0 + rate * 1.2, 0.6);
}

/* ---- 6. Running RMS of a sinusoid is A/sqrt(2) ---- */
{
  const A = 0.4, f = 25;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = A * Math.sin(2 * Math.PI * f * t(i));
  const r = T.runningRMS(x, 40);               // 0.16 s window, several cycles
  check('running RMS of sinusoid', r[500], A / Math.SQRT2, 0.01);
}

/* ---- 7. Weighted-average frequency of a Ricker packet ---- */
{
  const fdom = 25;
  const wav = SEIS.makeWavelet({ f: fdom });
  const u = new Float32Array(n);
  for (let i = 0; i < n; i++) u[i] = wav.fn(t(i) - 1.0);
  const uh = T.hilbert(u);
  const env = T.envelope(u, uh);
  const fi = T.instFreq(u, uh, dt);
  const avg = T.averageFrequency(env, fi, 12);
  // a Ricker's peak-frequency and its energy-weighted mean frequency are not
  // the same number; the mean of a Ricker amplitude spectrum is 2/sqrt(pi)*fdom
  // for the amplitude-weighted case, so just check it lands in a sane band
  console.log('  info   favg at the Ricker peak = ' + avg.favg[500].toFixed(2) + ' Hz  (fdom = ' + fdom + ')');
  console.log('  info   bandwidth at the peak   = ' + avg.band[500].toFixed(2) + ' Hz');
  check('favg within 40% of dominant frequency', avg.favg[500] / fdom, 1, 0.4);
  check('bandwidth is positive and sane (Hz)', avg.band[500], 20, 20);
}

/* ---- 8. Unwrapped phase of a constant-frequency signal is a straight line ---- */
{
  const f = 30;
  const fi = new Float32Array(n).fill(f);
  const up = T.unwrapPhase(fi, dt, 0);
  check('unwrapped phase slope (rad/s)', (up[600] - up[400]) / (200 * dt), 2 * Math.PI * f, 0.01);
}

/* ---- 9. Wavelet attributes: one packet gives one block ---- */
{
  const wav = SEIS.makeWavelet({ f: 25 });
  const u = new Float32Array(n);
  for (let i = 0; i < n; i++) u[i] = wav.fn(t(i) - 1.0);
  const uh = T.hilbert(u);
  const env = T.envelope(u, uh);
  const ph = T.instPhase(u, uh);
  const fi = T.instFreq(u, uh, dt);
  const w = T.waveletAttributes(env, ph, fi);
  check('wavelet phase at the packet is zero-phase', w.phase[500] * 180 / Math.PI, 0, 3);
  console.log('  info   wavelet freq at the packet = ' + w.freq[500].toFixed(2) + ' Hz');
}

/* ---- 10. Instantaneous frequency at the peak of a zero-phase Ricker ----
   The Ricker amplitude spectrum is proportional to f^2 exp(-f^2/fp^2), whose
   mean frequency is 2*fp/sqrt(pi). The instantaneous frequency at the envelope
   peak of a zero-phase Ricker should return exactly that, and does. This is
   the check behind the claim in step 4 that instantaneous frequency and
   dominant frequency are different quantities by a factor of 1.128. */
{
  [12, 20, 25, 32, 40, 45].forEach((fp) => {
    const wav = SEIS.makeWavelet({ f: fp });
    const u = new Float32Array(n);
    for (let i = 0; i < n; i++) u[i] = wav.fn(t(i) - 1.0);
    const fi = T.instFreq(u, T.hilbert(u), dt);
    check('Ricker ' + fp + ' Hz: f_inst at peak = 2f/sqrt(pi)', fi[500], 2 * fp / Math.sqrt(Math.PI), 0.05);
  });
}

/* ---- 11. Sweetness is exactly its two ingredients ---- */
{
  const env = new Float32Array([4, 4, 4]), frq = new Float32Array([16, 25, 100]);
  const sw = T.sweetness(env, frq);
  check('sweetness = e/sqrt(f), f=16', sw[0], 1.0, 1e-6);
  check('sweetness = e/sqrt(f), f=100', sw[2], 0.4, 1e-6);
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nall checks passed');
process.exit(fails ? 1 : 0);
