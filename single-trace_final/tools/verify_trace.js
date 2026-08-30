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

/* ---- 12. Trace integration: integral of cos(wt) is sin(wt)/w ---- */
{
  const f = 20, w = 2 * Math.PI * f;
  const x = new Float32Array(n), ref = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = Math.exp(-0.5 * Math.pow((t(i) - 1.0) / 0.25, 2));
    x[i] = g * Math.cos(w * t(i));
    ref[i] = g * Math.sin(w * t(i)) / w;
  }
  const y = T.integrate(x, dt);
  let err = 0, amp = 0;
  for (let i = 300; i < n - 300; i++) { err = Math.max(err, Math.abs(y[i] - ref[i])); amp = Math.max(amp, Math.abs(ref[i])); }
  check('integral of cos = sin/w (max err / amp)', err / amp, 0, 0.05);
}

/* ---- 13. Ormsby amplitude response at its four corners ---- */
{
  check('Ormsby at f1 (5 Hz)', T.ormsbyAmp(5, 5, 10, 40, 50), 0, 1e-9);
  check('Ormsby midway up the low ramp', T.ormsbyAmp(7.5, 5, 10, 40, 50), 0.5, 1e-9);
  check('Ormsby in the passband', T.ormsbyAmp(25, 5, 10, 40, 50), 1, 1e-9);
  check('Ormsby midway down the high ramp', T.ormsbyAmp(45, 5, 10, 40, 50), 0.5, 1e-9);
  check('Ormsby above f4', T.ormsbyAmp(60, 5, 10, 40, 50), 0, 1e-9);
}

/* ---- 14. The claim module 02 rests on: integrating a reflectivity trace
     returns 0.5*ln(Z), carrying whatever wavelet the trace carried. Build an
     impedance log, derive its reflection coefficients honestly, convolve,
     integrate, and compare against the log-impedance steps put through the
     same wavelet. No fitted scale factor anywhere.

     Run it twice, at two contrast levels. The gap between them IS the
     small-reflection-coefficient assumption AASPI's overview states, and the
     numbers it produces are the ones module 02 quotes. ---- */
function raiExperiment(scale, report) {
  const F = { f1: 6, f2: 12, f3: 45, f4: 55 };
  const bounds = [0.62, 0.69, 0.78, 0.84, 0.97, 1.05, 1.18, 1.29];
  const base = [6.0, 8.4, 6.1, 7.2, 6.6, 5.4, 7.9, 6.3, 7.1];
  const zs = base.map((z) => 6.0 * Math.exp(scale * Math.log(z / 6.0)));
  const wav = SEIS.makeWavelet({ type: 'ormsby', f1: F.f1, f2: F.f2, f3: F.f3, f4: F.f4 });

  const spikes = bounds.map((bt, k) => ({ t: bt, r: T.rcFromZ(zs[k], zs[k + 1]) }));
  const u = SEIS.traceFromSpikes(spikes, 0, dt, n, wav);
  // no Ormsby here: the wavelet has already band-limited the trace, and
  // filtering again would band-limit it twice. Worth knowing — in AASPI's
  // flow that filter is there for noise below the data band, not to reshape
  // signal already inside it.
  const rai = T.integrate(u, dt);

  /* The reference: the same boundaries carrying 0.5*dlnZ instead of the
     reflection coefficient, put through the same wavelet and the same
     integration. Because both go down an identical code path, whatever is
     left between them is the small-contrast assumption and nothing else. */
  const steps = bounds.map((bt, k) => ({ t: bt, r: 0.5 * Math.log(zs[k + 1] / zs[k]) }));
  const ref = T.integrate(SEIS.traceFromSpikes(steps, 0, dt, n, wav), dt);

  const i0 = Math.round(0.45 / dt), i1 = Math.round(1.50 / dt);
  let biggest = 0;
  for (let k = 0; k < zs.length - 1; k++) {
    biggest = Math.max(biggest, Math.abs(T.rcFromZ(zs[k], zs[k + 1])));
  }
  let sa = 0, sb = 0;
  for (let i = i0; i <= i1; i++) { sa += rai[i] * rai[i]; sb += ref[i] * ref[i]; }
  const corr = T.correlation(rai, ref, i0, i1);
  if (report) {
    console.log('  info   largest |r| = ' + biggest.toFixed(3) +
      ':  correlation ' + corr.toFixed(4) +
      ',  amplitude ' + (100 * Math.sqrt(sa / sb)).toFixed(1) + '% of the true log impedance');
  }
  return { corr: corr, amp: Math.sqrt(sa / sb), r: biggest };
}
{
  const gentle = raiExperiment(0.22, true);
  const strong = raiExperiment(1.00, true);
  const huge = raiExperiment(2.20, true);
  check('gentle contrasts: RAI is the log impedance', gentle.corr, 1, 0.002);
  check('gentle contrasts: and the right size', gentle.amp, 1, 0.01);
  check('strong contrasts: shape survives', strong.corr, 1, 0.02);
  check('strong contrasts: amplitude under-reads', strong.amp, 0.988, 0.01);
  check('huge contrasts: under-reads further', huge.amp, 0.95, 0.05);
}

/* ---- 15. The small-contrast assumption, stated as a number ---- */
{
  // r = tanh(0.5 dlnZ), so integration under-reads once the contrast is large
  [[6.0, 6.6], [6.0, 9.0], [6.0, 18.0]].forEach((q) => {
    const r = T.rcFromZ(q[0], q[1]);
    const exact = 0.5 * Math.log(q[1] / q[0]);
    console.log('  info   Z ' + q[0] + '->' + q[1] + ':  r = ' + r.toFixed(4) +
      ',  0.5 dlnZ = ' + exact.toFixed(4) +
      ',  integration recovers ' + (100 * r / exact).toFixed(1) + '%');
  });
  check('small contrast: r within 1% of 0.5 dlnZ', T.rcFromZ(6, 6.6) / (0.5 * Math.log(6.6 / 6)), 1, 0.01);
}

/* ---- 16. RMS over a narrowband packet is the envelope over root two.
     Modules 03 and 04 lean on this: a short RMS window is a clumsy envelope,
     and the constant relating them is not 1. ---- */
{
  const f = 25;
  const u = new Float32Array(n), env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    env[i] = Math.exp(-0.5 * Math.pow((t(i) - 1.0) / 0.30, 2));
    u[i] = env[i] * Math.cos(2 * Math.PI * f * t(i));
  }
  const K = Math.round((1 / f) / dt / 2);          // half a period either side
  const r = T.runningRMS(u, K);
  check('RMS of a narrowband packet = envelope / sqrt(2)',
    r[500] / env[500], 1 / Math.SQRT2, 0.02);
}

/* ---- 17. Noise adds in quadrature, which is why an RMS map of a quiet zone
     is a map of the noise. RMS(signal + noise)^2 = RMS(signal)^2 + RMS(noise)^2
     for uncorrelated noise. ---- */
{
  const rnd = SEIS.mulberry32(5);
  const sig = new Float32Array(n), noi = new Float32Array(n), both = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sig[i] = 0.5 * Math.sin(2 * Math.PI * 22 * t(i));
    noi[i] = 0.2 * SEIS.gaussRand(rnd);
    both[i] = sig[i] + noi[i];
  }
  /* The relation is exact only in expectation: over a finite window the cross
     term between signal and noise does not vanish, it just gets small. With
     801 samples the residual is a couple of percent, so that is the tolerance. */
  const K = 400;
  const rs = T.runningRMS(sig, K)[500];
  const rn = T.runningRMS(noi, K)[500];
  const rb = T.runningRMS(both, K)[500];
  check('RMS adds in quadrature (ratio)', rb / Math.sqrt(rs * rs + rn * rn), 1, 0.03);
  console.log('  info   signal ' + rs.toFixed(4) + ', noise ' + rn.toFixed(4) +
    ', together ' + rb.toFixed(4) + ' — the quiet-zone floor is the noise');
}

/* ---- 18. RMS and standard deviation are not the same thing, whatever the
     documentation sentence says. On a zero-mean trace they agree; add a bias
     and they do not. ---- */
{
  const x = new Float32Array(n), y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = 0.4 * Math.sin(2 * Math.PI * 20 * t(i));
    y[i] = x[i] + 0.3;                                // the same trace, biased
  }
  const K = 130;
  check('zero mean: RMS equals standard deviation',
    T.runningRMS(x, K)[500] / T.runningStd(x, K)[500], 1, 0.01);
  check('biased: standard deviation is unchanged',
    T.runningStd(y, K)[500] / T.runningStd(x, K)[500], 1, 0.01);
  check('biased: RMS is not', T.runningRMS(y, K)[500],
    Math.sqrt(T.runningRMS(x, K)[500] * T.runningRMS(x, K)[500] + 0.09), 0.01);
}

/* ---- 19. AGC of a sinusoid returns a sinusoid of amplitude sqrt(2),
     because the divisor is A/sqrt(2) whatever A was. ---- */
{
  [0.2, 1.0, 5.0].forEach((A) => {
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = A * Math.sin(2 * Math.PI * 24 * t(i));
    const g = T.agc(x, 150).out;
    let mx = 0;
    for (let i = 300; i < n - 300; i++) mx = Math.max(mx, Math.abs(g[i]));
    check('AGC of a sinusoid, A = ' + A, mx, Math.SQRT2, 0.03);
  });
}

/* ---- 20. The Holoborodko filters the Teager-Kaiser documentation names.
     A first-derivative filter must sum to zero and be exact on a straight
     line; a second-derivative filter must sum to zero and return exactly 2
     for t^2. The documentation's second-derivative row fails both as printed,
     which is how the sign error was found. ---- */
{
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const mom = (a, p) => a.reduce((acc, c, i) => acc + c * Math.pow(i - (a.length - 1) / 2, p), 0);
  check('first-derivative coefficients sum to zero', sum(T.HOLO1), 0, 1e-12);
  check('first-derivative first moment = 512', mom(T.HOLO1, 1), 512, 1e-9);
  check('second-derivative coefficients sum to zero', sum(T.HOLO2), 0, 1e-12);
  check('second-derivative second moment = 384', mom(T.HOLO2, 2), 384, 1e-9);
  // as printed in the documentation, with +12 either side of the centre
  const asPrinted = [-7, 12, 52, 12, -90, 12, 52, 12, -7];
  console.log('  info   the row as printed sums to ' + sum(asPrinted) +
    ', so it would report a second derivative of ' +
    (sum(asPrinted) / 192).toFixed(3) + ' for a constant');

  const x = new Float32Array(n), q = new Float32Array(n);
  for (let i = 0; i < n; i++) { x[i] = 3 * t(i) + 1; q[i] = t(i) * t(i); }
  check('holoDeriv1 exact on a straight line', T.holoDeriv1(x, dt)[500], 3, 1e-4);
  /* A second derivative divides by dt squared, which at a 2 ms sample interval
     multiplies whatever rounding is in the input by about a quarter of a
     million. These arrays are Float32, so the residual below is the storage
     format showing through, not the coefficients -- the moment tests above
     prove those exactly. */
  check('holoDeriv2 on t squared', T.holoDeriv2(q, dt)[500], 2, 0.01);
  check('holoDeriv2 of a straight line is zero', T.holoDeriv2(x, dt)[500], 0, 0.01);
}

/* ---- 21. Teager-Kaiser of a pure tone.

     Three things to separate here. The operator identity itself: for
     x = A cos(wt), (dx/dt)^2 - x d^2x/dt^2 = A^2 w^2 exactly, at any
     frequency. The three-sample form: A^2 sin^2(w dt), which is a small-angle
     approximation to it. And the filters AASPI uses to get the derivatives,
     which are smoothed on purpose and therefore roll off with frequency.
     Module 06 shows all three, so all three get checked. ---- */
{
  // the identity, with derivatives done by hand rather than by any filter
  [[0.5, 12], [1.0, 60], [1.0, 110]].forEach((q) => {
    const A = q[0], w = 2 * Math.PI * q[1], ph = 0.7, tt = 1.0;
    const x = A * Math.cos(w * tt + ph);
    const d1 = -A * w * Math.sin(w * tt + ph);
    const d2 = -A * w * w * Math.cos(w * tt + ph);
    check('the TK identity at ' + q[1] + ' Hz', (d1 * d1 - x * d2) / (A * A * w * w), 1, 1e-9);
  });

  const rolloff = [];
  [[0.5, 12], [0.5, 30], [1.0, 60], [1.0, 110]].forEach((q) => {
    const A = q[0], f = q[1], w = 2 * Math.PI * f;
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = A * Math.cos(w * t(i) + 0.7);
    const holo = T.tkEnergy(x, dt, 'holo')[500];
    const disc = T.tkDiscrete(x)[500];
    check('TK discrete = A^2 sin^2(w dt), ' + f + ' Hz',
      disc, A * A * Math.pow(Math.sin(w * dt), 2), 1e-4);
    rolloff.push(holo / (A * A * w * w));
    console.log('  info   ' + String(f).padStart(3) + ' Hz: the three-sample form reads ' +
      (100 * disc / (A * A * w * w * dt * dt)).toFixed(1) +
      '% of the true energy, the Holoborodko filters read ' +
      (100 * holo / (A * A * w * w)).toFixed(1) + '%');
  });
  /* Both approximations under-read, and both get worse with frequency. That is
     not a bug to fix; it is the cost of the noise rejection the smooth filters
     were chosen for, and module 06 says so rather than hiding it. */
  check('Holoborodko is good in the seismic band', rolloff[0], 1, 0.05);
  let falling = 1;
  for (let i = 1; i < rolloff.length; i++) if (rolloff[i] >= rolloff[i - 1]) falling = 0;
  check('and rolls off monotonically above it', falling, 1, 0.001);
}

/* ---- 22. The cross-term problem the AASPI documentation describes: on a
     two-tone signal the Teager-Kaiser energy is not the sum of the two. ---- */
{
  const f1 = 18, f2 = 44, A = 0.6;
  const mk = (fs) => {
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) fs.forEach((f) => { x[i] += A * Math.cos(2 * Math.PI * f * t(i)); });
    return x;
  };
  const both = T.tkEnergy(mk([f1, f2]), dt, 'holo');
  const one = T.tkEnergy(mk([f1]), dt, 'holo');
  const two = T.tkEnergy(mk([f2]), dt, 'holo');
  let sBoth = 0, sSum = 0, worst = 0;
  for (let i = 300; i < n - 300; i++) {
    sBoth += both[i]; sSum += one[i] + two[i];
    worst = Math.max(worst, Math.abs(both[i] - one[i] - two[i]));
  }
  const mean = sSum / (n - 600);
  console.log('  info   two tones: mean of the sum ' + (sSum / (n - 600)).toExponential(2) +
    ', largest cross term ' + worst.toExponential(2) +
    ' (' + (100 * worst / mean).toFixed(0) + '% of the mean)');
  check('the two-tone average still adds up', sBoth / sSum, 1, 0.02);
  check('but sample by sample it does not', worst / mean > 0.5 ? 1 : 0, 1, 0.001);
}

/* ---- 23. AVT is its three steps and nothing else ---- */
{
  const wav = SEIS.makeWavelet({ f: 25 });
  const u = new Float32Array(n);
  [0.7, 0.86, 1.2].forEach((tt, k) => {
    for (let i = 0; i < n; i++) u[i] += (k === 1 ? -0.7 : 1) * wav.fn(t(i) - tt);
  });
  const K = 12;
  const a = T.avt(u, dt, K);
  const env = T.envelope(u, T.hilbert(u));
  let d1 = 0, d2 = 0;
  const er = T.runningRMS(env, K);
  for (let i = 0; i < n; i++) {
    d1 = Math.max(d1, Math.abs(a.env[i] - env[i]));
    d2 = Math.max(d2, Math.abs(a.envRms[i] - er[i]));
  }
  check('AVT step 1 is the envelope', d1, 0, 1e-9);
  check('AVT step 2 is its running RMS', d2, 0, 1e-9);
  // the RMS envelope is positive; the output is not, and has zero mean
  let mn = 0, negs = 0, rms = 0;
  for (let i = 100; i < n - 100; i++) {
    mn += a.avt[i]; rms += a.avt[i] * a.avt[i];
    if (a.avt[i] < 0) negs++;
  }
  mn /= (n - 200); rms = Math.sqrt(rms / (n - 200));
  check('the RMS envelope is never negative', Math.min(...a.envRms) >= 0 ? 1 : 0, 1, 0.001);
  // measured against its own size: the residual is the window edge, not a bias
  check('AVT is centred on zero', mn / rms, 0, 0.05);
  console.log('  info   AVT is negative on ' + (100 * negs / (n - 200)).toFixed(0) +
    '% of samples, which is what makes it displayable');
}

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nall checks passed');
process.exit(fails ? 1 : 0);
