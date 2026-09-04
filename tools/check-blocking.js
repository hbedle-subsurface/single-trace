/* check-blocking.js — the response (wavelet) attributes are blocked between
   adjacent envelope minima, following Bodine (1984). This was once done by
   nearest maximum, which puts the edge at the midpoint between two maxima
   instead. The two agree on symmetric events and disagree wherever a weak
   event sits beside a strong one, so the check is against an independent
   implementation of the rule rather than against a stored number.

   Run:  node check-blocking.js */
const { win, errors } = require('./harness.js');

/* The rule, written out again here on purpose: a check that shares code with
   the thing it is checking is not a check. */
function blockByMinima(env, freq) {
  const n = env.length, maxima = [], minima = [];
  for (let i = 1; i < n - 1; i++) {
    if (env[i] >= env[i - 1] && env[i] > env[i + 1]) maxima.push(i);
    if (env[i] <= env[i - 1] && env[i] < env[i + 1]) minima.push(i);
  }
  const out = new Float32Array(n);
  if (!maxima.length) return out;
  const edges = [0].concat(minima, [n]);
  for (let b = 0; b < edges.length - 1; b++) {
    const lo = edges[b], hi = edges[b + 1];
    let p = -1;
    for (const k of maxima) {
      if (k >= lo && k < hi && (p < 0 || env[k] > env[p])) p = k;
    }
    if (p < 0) p = lo < maxima[0] ? maxima[0] : maxima[maxima.length - 1];
    for (let i = lo; i < hi; i++) out[i] = freq[p];
  }
  return out;
}

setTimeout(() => {
  const M = win.__MOD;
  const T = win.TRACE || win.eval('TRACE');
  if (!M || !T) {
    console.log('MODULE DID NOT INITIALISE');
    errors.forEach((e) => console.log(e));
    process.exit(1);
  }

  const NX = 96, NT = 500, DT = 0.002;
  let worst = 0, differing = 0, total = 0;

  for (const [fdom, phase] of [[25, 0], [40, 0], [15, 0], [25, 90]]) {
    const sec = M.rawSection(fdom, phase);
    for (let ix = 0; ix < NX; ix++) {
      const u = new Float32Array(NT);
      for (let it = 0; it < NT; it++) u[it] = sec[ix * NT + it];
      const uh = T.hilbert(u);
      const env = T.envelope(u, uh);
      const fq = T.instFreq(u, uh, DT);
      const got = T.waveletAttributes(env, T.instPhase(u, uh), fq).freq;
      const want = blockByMinima(env, fq);
      for (let i = 0; i < NT; i++) {
        const d = Math.abs(got[i] - want[i]);
        if (d > 1e-6) differing++;
        if (d > worst) worst = d;
        total++;
      }
    }
  }

  const ok = differing === 0;
  console.log('response attributes: block edges against the envelope minima');
  console.log(`  ${(ok ? 'ok  ' : 'FAIL')}  ${total} samples over 4 wavelet settings` +
    `, ${differing} differing, largest difference ${worst.toExponential(2)} Hz`);
  console.log('\n' + (ok
    ? 'the blocking rule is the one the Method tab and the paper describe'
    : 'the blocking rule does NOT match the documented between-minima rule'));
  if (!ok) process.exit(1);
}, 800);
