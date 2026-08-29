/* ===========================================================================
   trace.js — single-trace (complex trace) attribute computation
   "How Single-Trace Attributes Actually Work"
   Heather Bedle / AASPI / University of Oklahoma

   Companion to seismic.js, which supplies wavelets, the FFT, colour maps and
   the canvas helpers. This file holds the attribute algorithms themselves,
   written the way the AASPI documentation describes them rather than in any
   optimised form, so the code can be read alongside the module using it.

   Everything here works on ONE trace at a time. That is the whole point of the
   set: no neighbouring trace is ever consulted, so nothing here knows anything
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

  /** Raised-cosine window weights over -K..+K, normalised to sum 1. */
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
   * Weighted-average frequency (Barnes, 1993; 2016). Average the instantaneous
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
    if (!maxima.length) return { phase: outP, freq: outF, env: outE, isPeak };

    // each sample takes the value at the nearest envelope maximum that is not
    // separated from it by another maximum: i.e. the maximum inside its block
    let m = 0;
    for (let i = 0; i < n; i++) {
      while (m < maxima.length - 1 &&
             Math.abs(maxima[m + 1] - i) < Math.abs(maxima[m] - i)) m++;
      const p = maxima[m];
      outP[i] = phase[p];
      outF[i] = freq[p];
      outE[i] = env[p];
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
    runningRMS, complexTrace,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = TRACE;
