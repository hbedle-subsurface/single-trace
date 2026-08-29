# Maintaining this repository

Build and verification notes. The mission, audience and teaching principles are
in the top-level README; this file is only the plumbing.

## Layout

```
index.html                 landing page; thumbnails are computed, not drawn
assets/style.css           the visual identity, shared with the other sets
assets/seismic.js          wavelets, FFT, Hilbert, color maps, canvas helpers
assets/trace.js            the single-trace attribute library for this set
assets/count.js            optional page-view counting; see the file's own notes
modules/instantaneous.html module 01
tools/                     the verification and measurement harness
docs/                      this file
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

Two things worth knowing when reading the dashboard. GoatCounter lists the page
title beside the path, so a page whose `<title>` is generic will be hard to
identify later — the single-page quiz repositories are the ones to check.  And a
module opened from a downloaded copy is never counted, by design: the script
skips `file://` and `localhost`. The count measures visits to the site, not use
of the material.
