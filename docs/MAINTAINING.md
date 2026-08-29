# Maintaining this repository

Build and verification notes. The mission, audience and teaching principles are
in the top-level README; this file is only the plumbing.

## Layout

```
index.html                 landing page; thumbnails are computed, not drawn
assets/style.css           the visual identity, shared with the other sets
assets/seismic.js          wavelets, FFT, Hilbert, color maps, canvas helpers
assets/trace.js            the single-trace attribute library for this set
assets/count.js            page-view counting; see the file's own notes
modules/instantaneous.html module 01
modules/impedance.html     module 02
modules/rms.html           module 03
modules/agc.html           module 04
modules/avt.html           module 05
modules/teager.html        module 06
tools/                     the verification and measurement harness
docs/                      this file, and ADD-COUNTING.md
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
| | `complexTrace` returns both `sweet` (envelope over the energy-weighted average frequency, the smooth form every package displays) and `sweetResp` (the literal response-attribute form, which is piecewise constant). Module 01 lets the reader switch between them. |
| `unwrapPhase(freq, dt)` | Vesnaver integration of `dφ/dt` |
| `runningRMS(x, K)` | running RMS over a boxcar window, as AASPI's formula gives it |
| `runningStd(x, K)` | the same window with the mean removed &mdash; what AASPI's sentence describes |
| `agc(x, K, floorFrac)` | trace divided by its running RMS, with a floor under the divisor |
| `avt(u, dt, K)` | envelope, its running RMS, and the inverse Hilbert transform of that |
| `holoDeriv1` / `holoDeriv2` | Holoborodko smooth noise-robust differentiators |
| `tkDiscrete(x)` | Kaiser's three-sample energy |
| `tkEnergy(x, dt, method)` | the continuous operator, with `'holo'` or `'fft'` derivatives |
| `tkAnalytic(u, dt, method)` | the same on the analytic trace, which removes the ripple |
| `tkVariation(tk, dt, filt)` | bandpassed and Hilbert transformed, for display |
| `ormsbyAmp(f, f1..f4)` | trapezoid filter response |
| `bandpass(x, dt, f1..f4)` | zero-phase Ormsby bandpass |
| `integrate(x, dt, filt)` | trace integration, 1/(i&omega;) with an optional Ormsby |
| `rcFromZ(z1, z2)` | reflection coefficient from two impedances |
| `correlation(a, b, i0, i1)` | Pearson correlation over a window |
| `complexTrace(u, dt, {K})` | all of the above in one call |

Sign convention, used everywhere: `uH = sin(ωt)` when `u = cos(ωt)`, so phase
increases with time and a normal event has a positive frequency. Getting this
backwards negates every frequency in a volume without changing the envelope,
which is a hard error to notice later.

## Verification

Requires Node and `npm install jsdom` in `tools/`.

```
node tools/verify_trace.js          # trace.js against closed forms
node tools/harness.js               # module 01: drive every control, print every readout
node tools/measure.js               # module 01: the numbers behind the exercise answers
node tools/harness-impedance.js     # module 02: same
node tools/measure-impedance.js     # module 02: same
node tools/harness-rms.js           # module 03: same
node tools/measure-rms.js           # module 03: same
node tools/harness-agc.js           # module 04: same
node tools/measure-agc.js           # module 04: same
node tools/harness-avt.js           # module 05: same
node tools/harness-teager.js        # module 06: same
node tools/check-shared.js          # modules 01, 03-06 are running one line
node tools/gen_thumbs.js            # regenerates the landing-page thumbnails
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

## Adding a module

Copy `modules/instantaneous.html` and work from it. The page structure, in
order: masthead, module head, the sticky lab header holding the live panel and
its controls, the tab strip, one pane per step, then Why it matters, Exercises,
Key points and Method, then the footer.

Aim for five steps plus the four reference tabs, and keep the total length of
the tab labels under about 115 characters or the strip wraps. Build one module
all the way to finished — exercises, Why it matters, and verification — before
starting the next.

Drawing rules learned the hard way:

- a color bar on every attribute panel, always;
- fixed axes on anything a slider drives, or the rescaling hides the change;
- check label and color-bar collisions arithmetically, not by eye — the trace
  axis label and a color bar under the same panel will overlap at the default
  margins;
- take canvas width from the parent's content box rather than `clientWidth`, as
  a tab pane has 26 px of padding either side;
- `SEIS.tag()` writes white text into a filled box, so never pass it white.

## Structural checks to run after every edit

`node --check` on the extracted inline script, tag balance, `$('id')`
references against the ids actually present, and the headless render. The first
three are in `tools/harness.js` and run automatically when it does.

## Page-view counting across the other repositories

All of the teaching sites are served from `hbedle-subsurface.github.io`, so one
GoatCounter account covers every one of them and the path tells them apart:
`/single-trace/modules/instantaneous.html`, `/geometric-attributes/modules/
curvature.html`, `/attribute_quiz/`. There is no need for a separate account,
code, or dashboard per repository.

`assets/count.js` is the same file in every repository, and the code in it is
already set to `hbedle` (https://hbedle.goatcounter.com). Roll it out with:

```
python3 tools/add-counter.py --dry-run ../geometric-attributes   # look first
python3 tools/add-counter.py ../geometric-attributes
python3 tools/add-counter.py ../seismic_resolution
python3 tools/add-counter.py ../avo-basics
python3 tools/add-counter.py ../attribute_quiz
```

The script copies `assets/count.js` in, adds one `<script>` line to every HTML
page, and works out the relative path for pages in subfolders. Running it twice
does nothing the second time. `--remove` takes it all back out.

If the work is being done in another conversation or by someone else,
[`docs/ADD-COUNTING.md`](ADD-COUNTING.md) is a self-contained handoff: it
carries the whole of `count.js` inline, the script tag with its relative paths,
the privacy wording, a check list, and what not to do. Nothing else needs to be
read alongside it.

Two things worth knowing when reading the dashboard. GoatCounter lists the page
title beside the path, so a page whose `<title>` is generic will be hard to
identify later — the single-page quiz repositories are the ones to check.  And a
module opened from a downloaded copy is never counted, by design: the script
skips `file://` and `localhost`. The count measures visits to the site, not use
of the material.

## The shared synthetic line

Modules 01, 03, 04, 05 and 06 all run on the same line: the same wedge, the same gas
sand, the same interbeds. A reader who has met them once should not have to meet
a new section in every module. The model code is copied into each file rather
than loaded from a shared script, because a module has to keep drawing when
`assets/` is stale or absent.

Copies drift, so `tools/check-shared.js` opens all five modules and compares the
raw model output sample by sample at several frequencies. If you edit the earth
model in one of them, run it, and expect it to fail until you have edited the
others to match.

Those five module scripts were assembled from shared blocks rather than typed
five times. If a shared block needs changing, change it in every module and let
`check-shared.js` confirm the result.

Module 02 deliberately does **not** share that line. It needs an impedance log as
its truth rather than a set of reflection coefficients, so it builds its own.

## A correction carried in module 06

The AASPI `teager_kaiser_energy` documentation prints Holoborodko's nine-point
second-derivative filter with the signs of the two coefficients either side of
the centre reversed. As printed the coefficients sum to 48 rather than 0, which
would report a second derivative of 0.25 for a constant. The set used here keeps
the same numbers with those two signs corrected: it sums to zero and returns
exactly 2 for t squared. `verify_trace.js` checks both conditions, which is how
the error surfaced. The eleven-point first-derivative filter in the same document
is correct as printed.
