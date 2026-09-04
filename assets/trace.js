/* ===========================================================================
   trace.js — single-trace (complex trace) attribute computation
   "How Single-Trace Attributes Actually Work"
   Heather Bedle and April Moreno-Ward / AASPI / University of Oklahoma

   Companion to seismic.js, which supplies wavelets, the FFT, color maps and
   the canvas helpers. This file holds the attribute algorithms themselves,
   written the way the AASPI documentation describes them rather than in any
   optimized form, so the code can be read alongside the module using it.

   Everything here works on ONE trace at a time. That is the whole point of the
   set: no neighboring trace is ever consulted, so nothing here knows anything
   about structure, dip or continuity. Where a formula is a simplification of
   what production software does, the comment says so.

   Sign conventions, fixed once and used everywhere:
     analytic trace   A(t) = u(t) + i*uH(t)
     Hilbert          uH = sin(wt)  when  u = cos(wt)
     phase            phi = atan2(uH, u),  so phase INCREASES with time
     frequency        f = (1/2pi) dphi/dt,  positive for a normal event
   Getting the Hilbert sign backwards silently negates every frequency in the
   volume, which is easy to miss because the envelope does not change at all.
   =========================================================================== */

const TRACE = (function () {
  'use strict';

  const TWOPI = 2 * Math.PI;

  /* --------------------------------------------------------------------
     FFT plumbing. seismic.js owns the FFT; this file only needs a padded
     power-of-two buffer to put things into.
     -------------------------------------------------------------------- */

  function pow2(n) { let p = 1; while (p < n) p *= 2; return p; }

  function needFFT() {
    if (typeof SEIS === 'undefined' || !SEIS.fft) {
      throw new Error('trace.js needs seismic.js for the FFT');
    }
  }

  /**
   * Hilbert transform of one trace, through the analytic signal: zero the
   * negative frequencies, double the positive ones, and the imaginary part of
   * the inverse transform is the quadrature trace.
   *
   * This is the frequency-domain route AASPI describes. The time-domain sum
   * over reciprocal odd integers gives the same answer but has to be truncated.
   */
  function hilbert(x) {
    if (typeof SEIS !== 'undefined' && SEIS.hilbert) return SEIS.hilbert(x);
    needFFT();
    const n0 = x.length, n = pow2(2 * n0);
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n0; i++) re[i] = x[i];
    SEIS.fft(re, im, false);
    for (let k = 1; k < n; k++) {
      if (k === n / 2) continue;
      if (k < n / 2) { re[k] *= 2; im[k] *= 2; } else { re[k] = 0; im[k] = 0; }
    }
    SEIS.fft(re, im, true);
    const out = new Float32Array(n0);
    for (let i = 0; i < n0; i++) out[i] = im[i];
    return out;
  }

  /**
   * Time derivative through the Fourier transform: multiply by i*omega.
   * AASPI computes the derivatives needed for instantaneous frequency this way
   * rather than by differencing, because differencing is a high-pass filter
   * with a badly behaved response near Nyquist.
   *
   * The trace is zero-padded to twice its length, so it must decay to roughly
   * zero at both ends or the wrap-around will show up as edge ringing.
   */
  function deriv(x, dt) {
    needFFT();
    const n0 = x.length, n = pow2(2 * n0);
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n0; i++) re[i] = x[i];
    SEIS.fft(re, im, false);
    for (let k = 0; k < n; k++) {
      // negative frequencies live in the top half of the array
      const kk = k <= n / 2 ? k : k - n;
      const w = (k === n / 2) ? 0 : TWOPI * kk / (n * dt);   // kill Nyquist
      const a = re[k], b = im[k];
      re[k] = -w * b;                                        // (a+ib)*(i*w)
      im[k] = w * a;
    }
    SEIS.fft(re, im, true);
    const out = new Float32Array(n0);
    for (let i = 0; i < n0; i++) out[i] = re[i];
    return out;
  }

  /* --------------------------------------------------------------------
     THE COMPLEX TRACE  (Taner et al., 1979)
     -------------------------------------------------------------------- */

  /** e(t) = |A(t)| = sqrt(u^2 + uH^2). Always positive, never negative. */
  function envelope(u, uh) {
    const n = u.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.sqrt(u[i] * u[i] + uh[i] * uh[i]);
    return out;
  }

  /** phi(t) = atan2(uH, u), in RADIANS, wrapped into -pi..+pi. */
  function instPhase(u, uh) {
    const n = u.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.atan2(uh[i], u[i]);
    return out;
  }

  /**
   * cos(phi) — the same information with the wrap taken out, because cosine is
   * continuous where the sawtooth jumps from +180 to -180.
   * Equal to u/e, which is why it is amplitude-blind: it is the trace divided
   * by its own strength.
   */
  function cosPhase(u, uh) {
    const n = u.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const e = Math.sqrt(u[i] * u[i] + uh[i] * uh[i]);
      out[i] = e > 1e-30 ? u[i] / e : 0;
    }
    return out;
  }

  /**
   * Instantaneous frequency in Hz, by the Taner chain-rule form
   *
   *      f = (1/2pi) * (u * duH/dt - uH * du/dt) / e^2
   *
   * rather than by differencing the wrapped phase, which would put a spike at
   * every wrap. Note there is no protection here against a small denominator:
   * where the envelope goes to zero the answer really is unstable, and hiding
   * that would hide the reason the averaged and wavelet frequencies exist.
   */
  function instFreq(u, uh, dt) {
    const du = deriv(u, dt), duh = deriv(uh, dt);
    const n = u.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const e2 = u[i] * u[i] + uh[i] * uh[i];
      out[i] = (u[i] * duh[i] - uh[i] * du[i]) / (TWOPI * (e2 + 1e-30));
    }
    return out;
  }

  /* --------------------------------------------------------------------
     STABILISED VERSIONS

     Instantaneous frequency is unusable raw, and everyone who ships it knows
     that. There are two standard cures and both are here, because they give
     different answers and the difference is worth seeing.
     -------------------------------------------------------------------- */

  /** Raised-cosine window weights over -K..+K, normalized to sum 1. */
  function taper(K) {
    const n = 2 * K + 1, w = new Float64Array(n);
    let s = 0;
    for (let k = 0; k < n; k++) {
      w[k] = 0.5 - 0.5 * Math.cos((TWOPI * (k + 1)) / (n + 1));
      s += w[k];
    }
    for (let k = 0; k < n; k++) w[k] /= s;
    return w;
  }

  /**
   * Weighted-average frequency (Barnes, 2000; 2016). Average the instantaneous
   * frequency over a window, weighting each sample by its instantaneous POWER
   * e^2, so the samples where the frequency is meaningless — the ones with no
   * energy — contribute almost nothing.
   *
   * Returns { favg, frms, band } with band = 2*sigma, the full bandwidth.
   * AASPI's documentation notes that it takes sigma as a half bandwidth, in
   * keeping with the signal-processing literature, and reports 2*sigma.
   */
  function averageFrequency(env, freq, K) {
    const n = env.length, w = taper(K);
    const favg = new Float32Array(n);
    const frms = new Float32Array(n);
    const band = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let num = 0, num2 = 0, den = 0;
      for (let k = -K; k <= K; k++) {
        const j = i + k;
        if (j < 0 || j >= n) continue;
        const p = env[j] * env[j] * w[k + K];
        num += p * freq[j];
        num2 += p * freq[j] * freq[j];
        den += p;
      }
      if (den <= 1e-30) { favg[i] = 0; frms[i] = 0; band[i] = 0; continue; }
      const fa = num / den;
      const fr2 = num2 / den;
      favg[i] = fa;
      frms[i] = Math.sqrt(Math.max(0, fr2));
      band[i] = 2 * Math.sqrt(Math.max(0, fr2 - fa * fa));
    }
    return { favg, frms, band };
  }

  /**
   * Wavelet (response) attributes, after Bodine (1984).
   *
   * Most of the energy in a trace sits near the envelope peaks, so the phase
   * and frequency measured AT an envelope peak describe the reflection better
   * than the values a few samples away do. Find every local envelope maximum,
   * and hold its value across the interval between the envelope minima on
   * either side. The result is blocky by construction: that is what tells you
   * you are looking at a wavelet attribute rather than an instantaneous one.
   *
   * The block edges are the envelope minima, not the midpoints between maxima.
   * The two coincide when neighboring events are the same size and part
   * company when they are not: a weak event beside a strong one has its
   * trough pushed toward the weak side, so a midpoint rule would hand several
   * tens of milliseconds of the weak event to the strong one. On the line
   * these modules run, the two rules disagree on about four percent of
   * samples, by as much as 17 Hz. tools/check-blocking.js measures it.
   *
   * A minimum belongs to the block that starts at it, so every sample lands in
   * exactly one block. Where an interval holds more than one maximum, which
   * strict interlacing forbids but a plateau in the envelope can produce, the
   * largest is used. Samples before the first maximum or after the last take
   * that maximum, since there is no interval for them to sit in.
   *
   * Returns { phase, freq, env, isPeak } — isPeak marks the sample each block
   * was read from, which the module draws so the blockiness is explainable.
   */
  function waveletAttributes(env, phase, freq) {
    const n = env.length;
    const outP = new Float32Array(n);
    const outF = new Float32Array(n);
    const outE = new Float32Array(n);
    const isPeak = new Uint8Array(n);

    // local maxima and minima of the envelope
    const maxima = [], minima = [];
    for (let i = 1; i < n - 1; i++) {
      if (env[i] >= env[i - 1] && env[i] > env[i + 1]) { maxima.push(i); isPeak[i] = 1; }
      if (env[i] <= env[i - 1] && env[i] < env[i + 1]) minima.push(i);
    }
    if (!maxima.length) return { phase: outP, freq: outF, env: outE, isPeak, maxima, minima };

    // block edges: the start of the trace, every envelope minimum, the end
    const edges = [0].concat(minima, [n]);

    let m = 0;                                   // index into maxima, swept once
    for (let b = 0; b < edges.length - 1; b++) {
      const lo = edges[b], hi = edges[b + 1];     // block covers lo .. hi-1
      if (hi <= lo) continue;

      while (m < maxima.length - 1 && maxima[m] < lo) m++;
      let p = -1;
      for (let k = m; k < maxima.length && maxima[k] < hi; k++) {
        if (maxima[k] >= lo && (p < 0 || env[maxima[k]] > env[p])) p = maxima[k];
      }
      if (p < 0) {
        // no maximum inside this block: the leading and trailing stretches of
        // the trace, which take the first or last maximum there is
        p = lo < maxima[0] ? maxima[0] : maxima[maxima.length - 1];
      }
      for (let i = lo; i < hi; i++) {
        outP[i] = phase[p];
        outF[i] = freq[p];
        outE[i] = env[p];
      }
    }
    return { phase: outP, freq: outF, env: outE, isPeak, maxima, minima };
  }

  /**
   * Sweetness (Radovich and Oliveros, 1998): envelope divided by the square
   * root of frequency. Bright and low frequency scores high.
   *
   * WHICH frequency is the whole question, and it changes the picture more
   * than the formula does. Radovich and Oliveros used the response (wavelet)
   * attributes, and the AASPI documentation follows them; taken literally that
   * gives a piecewise-constant attribute, one value per event, which is not
   * what a sweetness volume looks like in any package. What is displayed in
   * practice is the smooth version: the envelope itself over the square root
   * of an energy-weighted average frequency, which is Barnes's stabilization
   * rather than Bodine's. AASPI reaches the same place from the other
   * direction, by running a median filter over the response version.
   *
   * Both are computed here. `sweet` is the smooth one and is what the modules
   * display; `sweetResp` is the literal response-attribute form, kept so the
   * difference can be shown rather than described.
   *
   * It has no units anyone can defend and its absolute value means nothing
   * between two surveys; it is a within-survey ranking, and the module says so.
   */
  function sweetness(env, freq, fmin) {
    const n = env.length, out = new Float32Array(n);
    const floor = fmin === undefined ? 1 : fmin;
    for (let i = 0; i < n; i++) {
      out[i] = env[i] / Math.sqrt(Math.max(floor, Math.abs(freq[i])));
    }
    return out;
  }

  /**
   * Unwrapped phase by the method of Vesnaver (2017): integrate the derivative
   * of the phase instead of trying to detect and repair the +-180 jumps. Since
   * dphi/dt is 2*pi*f, this is just a running integral of the instantaneous
   * frequency, and it never has a jump to repair in the first place.
   */
  function unwrapPhase(freq, dt, phase0) {
    const n = freq.length, out = new Float32Array(n);
    let acc = phase0 === undefined ? 0 : phase0;
    for (let i = 0; i < n; i++) {
      acc += TWOPI * freq[i] * dt;
      out[i] = acc;
    }
    return out;
  }

  /* --------------------------------------------------------------------
     RUNNING WINDOW PRIMITIVE

     Shared with the RMS amplitude and AGC modules. Boxcar, length 2K+1,
     shortened at the ends rather than padded, which is what AASPI does and
     which keeps the first and last samples from being biased toward zero.
     -------------------------------------------------------------------- */

  /**
   * A note on the name, because the AASPI documentation says one thing and its
   * equation says another. The text calls this the standard deviation of the
   * data in the window; the formula given is the root mean square, with no mean
   * removed. On seismic data the two are close, because a trace has almost no
   * mean, but they are not the same quantity and they part company as soon as
   * anything puts a bias in the data. Both are provided here so the difference
   * can be looked at rather than argued about: runningRMS is the formula AASPI
   * implements, runningStd is what the sentence describes.
   */
  function runningRMS(x, K) {
    const n = x.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let k = -K; k <= K; k++) {
        const j = i + k;
        if (j < 0 || j >= n) continue;
        s += x[j] * x[j]; c++;
      }
      out[i] = c ? Math.sqrt(s / c) : 0;
    }
    return out;
  }


  /* --------------------------------------------------------------------
     TRACE INTEGRATION  (module 02, relative acoustic impedance)

     Reflectivity is, to a first approximation, the derivative of the
     logarithm of impedance:

         r = (Z2 - Z1)/(Z2 + Z1) = tanh(0.5 * dlnZ)  ~  0.5 * dlnZ

     so integrating a reflectivity trace returns 0.5*ln(Z), band-limited to
     whatever the seismic actually recorded. AASPI does the integration in the
     frequency domain by dividing by i*omega, then applies a 4-point Ormsby
     filter, because 1/omega grows without limit toward zero frequency and
     would otherwise amplify whatever noise sits below the data spectrum.
     -------------------------------------------------------------------- */

  /** Trapezoid amplitude response: 0, ramp f1-f2, 1, ramp f3-f4, 0. */
  function ormsbyAmp(f, f1, f2, f3, f4) {
    const a = Math.abs(f);
    if (a <= f1 || a >= f4) return 0;
    if (a < f2) return (a - f1) / (f2 - f1);
    if (a <= f3) return 1;
    return (f4 - a) / (f4 - f3);
  }

  /**
   * Zero-phase Ormsby bandpass of one trace. Used to band-limit the true
   * impedance log so it can be compared against the integrated trace on equal
   * terms — comparing against the full-band log would blame integration for
   * frequencies the seismic never recorded.
   */
  function bandpass(x, dt, f1, f2, f3, f4) {
    needFFT();
    const n0 = x.length, n = pow2(2 * n0);
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n0; i++) re[i] = x[i];
    SEIS.fft(re, im, false);
    for (let k = 0; k < n; k++) {
      const kk = k <= n / 2 ? k : k - n;
      const f = kk / (n * dt);
      const h = ormsbyAmp(f, f1, f2, f3, f4);
      re[k] *= h; im[k] *= h;
    }
    SEIS.fft(re, im, true);
    const out = new Float32Array(n0);
    for (let i = 0; i < n0; i++) out[i] = re[i];
    return out;
  }

  /**
   * Trace integration, AASPI's relative_acoustic_impedance in one function:
   * divide the spectrum by i*omega and apply the Ormsby filter.
   *
   * Pass filt = {f1,f2,f3,f4} for the filter, or omit it to see what the
   * unfiltered integral does — which is the point of step 5.
   */
  function integrate(x, dt, filt) {
    needFFT();
    const n0 = x.length, n = pow2(2 * n0);
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n0; i++) re[i] = x[i];
    SEIS.fft(re, im, false);
    for (let k = 0; k < n; k++) {
      const kk = k <= n / 2 ? k : k - n;
      const w = TWOPI * kk / (n * dt);
      // zero frequency has no integral that anyone can recover, and the
      // Nyquist bin has to stay real, so both are simply dropped
      if (k === 0 || k === n / 2) { re[k] = 0; im[k] = 0; continue; }
      const h = filt ? ormsbyAmp(kk / (n * dt), filt.f1, filt.f2, filt.f3, filt.f4) : 1;
      const g = h / w;
      const a = re[k], b = im[k];
      re[k] = b * g;            // (a + ib) / (i*w) = (b - ia)/w
      im[k] = -a * g;
    }
    SEIS.fft(re, im, true);
    const out = new Float32Array(n0);
    for (let i = 0; i < n0; i++) out[i] = re[i];
    return out;
  }

  /** Reflection coefficient from impedances above and below a boundary. */
  function rcFromZ(z1, z2) { return (z2 - z1) / (z2 + z1); }

  /** Pearson correlation, for checking a result against what it approximates. */
  function correlation(a, b, i0, i1) {
    let sa = 0, sb = 0, n = 0;
    for (let i = i0; i <= i1; i++) { sa += a[i]; sb += b[i]; n++; }
    const ma = sa / n, mb = sb / n;
    let num = 0, va = 0, vb = 0;
    for (let i = i0; i <= i1; i++) {
      const da = a[i] - ma, db = b[i] - mb;
      num += da * db; va += da * da; vb += db * db;
    }
    return (va > 0 && vb > 0) ? num / Math.sqrt(va * vb) : 0;
  }

  /** The same window, with the mean taken out first: a true standard deviation. */
  function runningStd(x, K) {
    const n = x.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0, s2 = 0, c = 0;
      for (let k = -K; k <= K; k++) {
        const j = i + k;
        if (j < 0 || j >= n) continue;
        s += x[j]; s2 += x[j] * x[j]; c++;
      }
      if (!c) { out[i] = 0; continue; }
      const m = s / c;
      out[i] = Math.sqrt(Math.max(0, s2 / c - m * m));
    }
    return out;
  }

  /**
   * Automatic gain control, exactly as AASPI's `agc` describes it: compute the
   * RMS amplitude in a running window, then divide every sample by it.
   *
   *     d_agc(j) = d(j) / sigma(j)
   *
   * The one addition is a floor under the divisor. In a window with nothing in
   * it, sigma goes to zero and the division goes to infinity; real data always
   * has some noise so this rarely bites, but a synthetic with a genuinely
   * silent zone will produce garbage without it. The floor is a fraction of the
   * largest sigma on the trace, so it scales with the data rather than being a
   * magic number, and the module reports how often it was reached.
   *
   * Returns { out, rms, floored } — floored is the count of samples where the
   * floor did the work instead of the data.
   */
  function agc(x, K, floorFrac) {
    const rms = runningRMS(x, K);
    const n = x.length;
    let mx = 0;
    for (let i = 0; i < n; i++) mx = Math.max(mx, rms[i]);
    const floor = (floorFrac === undefined ? 0.02 : floorFrac) * mx;
    // a trace with nothing in it anywhere has a floor of zero, so the test
    // below never fires and the count would read zero on the one trace where
    // the floor did all of the work
    if (mx <= 0) return { out: new Float32Array(n), rms: rms, floored: n, floor: 0 };
    const out = new Float32Array(n);
    let floored = 0;
    for (let i = 0; i < n; i++) {
      const d = rms[i];
      if (d < floor) floored++;
      out[i] = x[i] / Math.max(d, floor || 1e-30);
    }
    return { out: out, rms: rms, floored: floored, floor: floor };
  }

  /* --------------------------------------------------------------------
     AMPLITUDE VOLUME TRANSFORM  (module 05)

     Three steps, all of which appear earlier in this set:

       1. the envelope of the trace                     (module 01)
       2. the RMS of that envelope in a window          (module 03)
       3. an inverse Hilbert transform of the result    (module 01 again)

     The last step is the one that needs explaining. An RMS envelope is
     positive everywhere, which displays badly: no polarity, no zero crossings,
     nothing to pick. The inverse Hilbert transform, which is just the negative
     of the forward one, turns each positive hump into an odd-symmetric wiggle
     centered on it, so the result is bipolar and looks like seismic again while
     carrying envelope information instead of reflectivity.
     -------------------------------------------------------------------- */

  function avt(u, dt, K) {
    const uh = hilbert(u);
    const env = envelope(u, uh);
    const envRms = runningRMS(env, K);
    // H^-1 = -H, which is what "inverse Hilbert transform" means here
    const h = hilbert(envRms);
    const out = new Float32Array(h.length);
    for (let i = 0; i < h.length; i++) out[i] = -h[i];
    return { env: env, envRms: envRms, avt: out };
  }

  /* --------------------------------------------------------------------
     TEAGER-KAISER ENERGY  (module 06)

     Kaiser's insight is that the energy of an oscillation depends on its
     frequency as well as its amplitude: for a mass on a spring, and for a
     seismic wave, E is proportional to A^2 * omega^2. The envelope measures
     only A. This measures both, which is why a quiet high-frequency event and
     a loud low-frequency one can carry the same energy.

     Two forms, and the module shows both. Discrete (Kaiser, 1990):

         psi[x](n) = x(n)^2 - x(n+1) x(n-1)

     which for x = A cos(w n dt) returns exactly A^2 sin^2(w dt) -- close to
     A^2 w^2 dt^2 while w dt is small, and increasingly wrong as it is not.
     Continuous (Kaiser, 1993), which is what AASPI computes:

         psi[x](t) = (dx/dt)^2 - x (d^2x/dt^2)

     returning exactly A^2 w^2 for a pure tone at any frequency.
     -------------------------------------------------------------------- */

  /**
   * Holoborodko (2008) smooth noise-robust differentiators, the filters the
   * AASPI documentation specifies. Differencing amplifies high frequencies;
   * these are designed to differentiate while suppressing them.
   *
   * A note on the source. The documentation's first-derivative coefficients are
   * correct and exact for a straight line. Its second-derivative row is printed
   * with the signs of the two nearest neighbors wrong: as written the
   * coefficients sum to 48 rather than 0, which would give a non-zero second
   * derivative for a constant. The set below is the one that satisfies both
   * conditions a second-derivative filter must satisfy -- it sums to zero and
   * returns exactly 2 for t^2 -- and it uses the same numbers, so the printed
   * row is a typesetting slip rather than a different filter.
   */
  const HOLO1 = [-1, -8, -27, -48, -42, 0, 42, 48, 27, 8, 1];        // /512, half 5
  const HOLO2 = [-7, 12, 52, -12, -90, -12, 52, 12, -7];             // /192, half 4

  function convolveSym(x, coef, half, scale) {
    const n = x.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = -half; k <= half; k++) {
        const j = Math.min(n - 1, Math.max(0, i + k));   // clamp at the ends
        s += coef[k + half] * x[j];
      }
      out[i] = s / scale;
    }
    return out;
  }

  function holoDeriv1(x, dt) { return convolveSym(x, HOLO1, 5, 512 * dt); }
  function holoDeriv2(x, dt) { return convolveSym(x, HOLO2, 4, 192 * dt * dt); }

  /** psi[x](n) = x^2 - x(n+1)x(n-1), the three-sample original. */
  function tkDiscrete(x) {
    const n = x.length, out = new Float32Array(n);
    for (let i = 1; i < n - 1; i++) out[i] = x[i] * x[i] - x[i + 1] * x[i - 1];
    out[0] = out[1]; out[n - 1] = out[n - 2];
    return out;
  }

  /**
   * psi[x](t) = (dx/dt)^2 - x d^2x/dt^2, with the derivative filters chosen by
   * `method`: 'holo' for Holoborodko, as AASPI uses, or 'fft' for exact
   * spectral derivatives. The two agree closely in the seismic band and part
   * company near Nyquist, which is the whole reason for using a smooth filter.
   */
  function tkEnergy(x, dt, method) {
    const d1 = method === 'fft' ? deriv(x, dt) : holoDeriv1(x, dt);
    const d2 = method === 'fft' ? deriv(deriv(x, dt), dt) : holoDeriv2(x, dt);
    const n = x.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = d1[i] * d1[i] - x[i] * d2[i];
    return out;
  }

  /**
   * Teager-Kaiser energy of the analytic trace. Hamila et al. (1999) showed
   * this is the sum of the energies of the real and imaginary parts, and the
   * result is smooth where the real-trace version pulses at twice the signal
   * frequency -- the same reason the envelope is smoother than the trace.
   */
  function tkAnalytic(u, dt, method) {
    const uh = hilbert(u);
    const a = tkEnergy(u, dt, method), b = tkEnergy(uh, dt, method);
    const out = new Float32Array(u.length);
    for (let i = 0; i < u.length; i++) out[i] = a[i] + b[i];
    return out;
  }

  /**
   * Teager-Kaiser variation (Matos, 2018): the energy sits on one side of zero
   * nearly everywhere -- exactly so for a single frequency, where the operator
   * returns A^2 w^2, and within a fraction of a percent of its peak on a
   * broadband trace, where the cross terms push a few samples below zero. A
   * one-sided attribute is awkward to display, so it is bandpassed and Hilbert
   * transformed into something bipolar. The same trick module 05 uses on the
   * RMS envelope, for the same reason.
   */
  function tkVariation(tk, dt, filt) {
    const b = filt ? bandpass(tk, dt, filt.f1, filt.f2, filt.f3, filt.f4) : tk;
    const h = hilbert(b);
    const out = new Float32Array(h.length);
    for (let i = 0; i < h.length; i++) out[i] = -h[i];
    return out;
  }

  /* --------------------------------------------------------------------
     ONE CALL FOR THE WHOLE FAMILY
     -------------------------------------------------------------------- */

  function complexTrace(u, dt, opts) {
    const o = opts || {};
    const K = o.K === undefined ? 8 : o.K;
    const uh = hilbert(u);
    const env = envelope(u, uh);
    const ph = instPhase(u, uh);
    const cp = cosPhase(u, uh);
    const f = instFreq(u, uh, dt);
    const avg = averageFrequency(env, f, K);
    const wav = waveletAttributes(env, ph, f);
    return {
      u, uh, env, phase: ph, cosPhase: cp, freq: f,
      favg: avg.favg, frms: avg.frms, band: avg.band,
      wphase: wav.phase, wfreq: wav.freq, wenv: wav.env,
      isPeak: wav.isPeak, maxima: wav.maxima, minima: wav.minima,
      sweet: sweetness(env, avg.favg),               // the one packages display
      sweetResp: sweetness(wav.env, wav.freq),       // the literal 1998 form
    };
  }

  return {
    hilbert, deriv, envelope, instPhase, cosPhase, instFreq,
    taper, averageFrequency, waveletAttributes, sweetness, unwrapPhase,
    runningRMS, runningStd, agc, complexTrace,
    ormsbyAmp, bandpass, integrate, rcFromZ, correlation,
    avt, holoDeriv1, holoDeriv2, tkDiscrete, tkEnergy, tkAnalytic, tkVariation,
    HOLO1, HOLO2,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = TRACE;
