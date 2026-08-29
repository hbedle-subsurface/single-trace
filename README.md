# How Single-Trace Attributes Actually Work

Interactive teaching modules on single-trace seismic attributes, built for
beginners: undergraduates meeting the topic for the first time, graduate
students whose research depends on tools they did not build, and professionals
who arrived in an interpretation role from an adjacent discipline.

Companion to *How Geometric Attributes Actually Work* and to the seismic
resolution module set. Everything runs in the browser from static files. No
server, no account, no analytics, no data leaves the machine.

Heather Bedle, School of Geosciences, University of Oklahoma, with the
[AASPI](https://www.ou.edu/mcee/labs/aaspi) consortium.

## The through-line

Every attribute in this set is computed from **one trace, with no reference to
its neighbors**. That restriction is the spine of the whole set, and it is why
none of these attributes knows anything about structure.

Two pieces of machinery produce nearly all of them:

- the **complex (analytic) trace** — the trace read together with its Hilbert
  transform as a rotating arrow, giving envelope, phase and frequency;
- the **running window** — RMS amplitude, AGC, and the attributes built on top
  of them.

## Modules

| # | File | Subject | Status |
|---|------|---------|--------|
| 01 | `modules/instantaneous.html` | Hilbert transform, complex trace, envelope, phase, cosine of phase, instantaneous frequency, wavelet and averaged frequency, sweetness | **finished** |
| 02 | `modules/impedance.html` | Relative acoustic impedance — trace integration and the Ormsby filter | planned |
| 03 | `modules/rms.html` | RMS amplitude in a running window | planned |
| 04 | `modules/agc.html` | AGC — the trace divided by its own RMS | planned |
| 05 | `modules/avt.html` | Amplitude volume transform | planned |
| 06 | `modules/teager.html` | Teager-Kaiser energy and its variational form | planned |

Each module is a **single self-contained HTML file**. It links only to
`assets/style.css`, `assets/seismic.js` and `assets/trace.js`, and it carries a
local fallback copy of the attribute math it needs, so it still draws if
`assets/` is stale or missing. A module can be copied, emailed or opened from
disk and it will work.

## Layout

```
index.html                 landing page; thumbnails are computed, not drawn
assets/style.css           the visual identity, shared with the other sets
assets/seismic.js          wavelets, FFT, Hilbert, color maps, canvas helpers
assets/trace.js            the single-trace attribute library for this set
modules/instantaneous.html module 01
tools/                     the verification and measurement harness
```

`assets/style.css` and `assets/seismic.js` are copies of the files in the
geometric-attributes repository and should be kept in step with it.

## assets/trace.js

The shared attribute library. Everything works on one trace at a time.

| Function | What it does |
|---|---|
| `hilbert(x)` | Hilbert transform via the analytic signal |
| `deriv(x, dt)` | time derivative through the Fourier transform |
| `envelope(u, uh)` | `sqrt(u² + uH²)` |
| `instPhase(u, uh)` | `atan2(uH, u)`, radians |
| `cosPhase(u, uh)` | cosine of the phase, continuous across the wrap |
| `instFreq(u, uh, dt)` | Taner chain-rule form, unstabilized on purpose |
| `averageFrequency(env, freq, K)` | Barnes energy-weighted mean, RMS frequency, and bandwidth `2σ` |
| `waveletAttributes(env, phase, freq)` | Bodine response attributes, held between envelope minima |
| `sweetness(env, freq)` | `e / √f` |
| `unwrapPhase(freq, dt)` | Vesnaver integration of `dφ/dt` |
| `runningRMS(x, K)` | the window primitive for modules 03 to 05 |
| `complexTrace(u, dt, {K})` | all of the above in one call |

Sign convention, used everywhere: `uH = sin(ωt)` when `u = cos(ωt)`, so phase
increases with time and a normal event has a positive frequency. Getting this
backwards negates every frequency in a volume without changing the envelope,
which is a hard error to notice later.

## Verification

Requires Node and `npm install jsdom` in `tools/`.

```
node tools/verify_trace.js     # trace.js against closed forms
node tools/harness.js          # opens module 01, drives every control, prints every readout
node tools/measure.js          # the measurements behind the exercise answers
node tools/gen_thumbs.js       # regenerates the landing-page thumbnails
```

`verify_trace.js` checks the library against cases with a known answer: the
Hilbert transform of a cosine, the Fourier derivative, the envelope of a
Gaussian packet, the instantaneous frequency of a linear chirp, the running RMS
of a sinusoid, and the slope of the unwrapped phase. The decisive one is the
instantaneous frequency at the peak of a zero-phase Ricker, which must equal the
mean frequency of the Ricker amplitude spectrum, `2f/√π`. It does, at every
frequency tested, to five decimal places — which is where the claim in module 01
step 4 comes from.

`harness.js` also checks that the local fallback copy inside the module and the
shared `trace.js` return identical numbers, so the two cannot drift apart
unnoticed.

**Every number in the prose and in the exercise answers is read out of the
running page by these tools.** None is estimated. When a measurement contradicts
the teaching text, the text is what changes.

## License

Free to use for teaching, demonstration, and non-commercial study, provided the
source is credited. Please do not republish or redistribute it, modified or
otherwise, without permission. If you use it in a course or a talk, a credit
line and a link back are all that is asked.

To cite: H. Bedle, *How Single-Trace Attributes Actually Work*, University of
Oklahoma. SSRN: [article link to follow]
