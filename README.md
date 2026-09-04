# How Single-Trace Attributes Actually Work

Interactive teaching modules on the seismic attributes computed from one trace
at a time. Free to use, nothing to install, and everything on the screen is
computed live in the browser while you change it.

**[Open the modules →](https://hbedle-subsurface.github.io/single-trace/)**

Heather Bedle and April Moreno-Ward, School of Geosciences, University of
Oklahoma, with the [AASPI](https://www.ou.edu/mcee/labs/aaspi) consortium.

---

## Why this exists

Most people who use seismic attributes were never taught the machinery inside
them. They know the rules — envelope is reflection strength, phase is good for
following weak reflectors, sweetness finds sands — and they apply those rules
where they remember them and nowhere else. What they have never done is *watch
the thing happen*: change the wavelet and see the frequency map change, turn the
gain up and watch a bright spot appear where there is no bright spot.

A rule you have only read is fragile: it holds in the case you read it in and
nowhere else. A limit you have watched appear is one you will recognize in
situations nobody named for you.

The gap is practical rather than conceptual. These models are small and run
perfectly well in a browser. What has been missing is somewhere to open them up
and push on them. An interpretation package computes attributes but will not
show you the calculation; a notebook will show you the calculation but needs an
installation, a language, and an afternoon. Neither is a reasonable ask for a
two-hour undergraduate session.

## Who it is for

- **Undergraduates** meeting attributes for the first time, who need the
  pictures before the equations.
- **Graduate students** in geology, structural geology or sedimentology whose
  research depends on tools they did not build and cannot easily inspect.
- **Professionals** who arrived in an interpretation role from an adjacent
  discipline and are expected to be productive in weeks.
- **Instructors**, who are welcome to use any of this in a course. Module state
  is encoded in the URL, so a specific configuration can be handed out as a link
  and every student opens the same picture. **Copy link to this setup**, above
  the step tabs, does it in one click.

## How the modules are built

Five principles, each applied against a real temptation:

1. **Compute, don't illustrate.** Every panel is generated from the parameters
   on screen. There are no stored images and no curves drawn to look plausible.
   That is a hard constraint, because it means the tool can be wrong — and
   several times it was, which is the point. A drawing cannot disagree with
   theory.
2. **Say what has been left out.** Every module carries a Method section listing
   its simplifications and naming where the implementation differs from
   production software. That is teaching content, not a disclaimer.
3. **Open on the problem, not the solution.** The defaults show the difficulty
   before the fix.
4. **Aim the interaction at a question.** Sliders on their own produce aimless
   clicking. Every module ends with exercises that say what to change, what to
   watch, and what to conclude, with the answers behind a toggle.
5. **Measure, never estimate.** Every number in the prose and in the exercise
   answers is read out of the running page by a test harness. Where a
   measurement contradicts the teaching text, the text is what changes.

## The through-line

Every attribute in this set is computed from **one trace, with no reference to
its neighbors**. That restriction is the spine of the whole set, and it is why
none of these attributes knows anything about structure: they cannot tell a
fault from a flat spot, because they never look at the trace next door.

Two pieces of machinery produce nearly all of them. The **complex trace** — the
trace read together with its Hilbert transform as a rotating arrow — gives
envelope, phase and frequency. A **running window** gives RMS amplitude and AGC.
Everything else is a combination of those two ideas rather than a new one.

The companion set, [*How Geometric Attributes Actually
Work*](https://hbedle-subsurface.github.io/geometric-attributes/), covers the
attributes that do look sideways: dip, coherence, curvature. A third set,
[*What Can You REALLY See in
Seismic?*](https://hbedle-subsurface.github.io/seismic_resolution/), covers
resolution.

## The modules

All six are finished.

| # | Subject | The question it answers 
|---|---------|-------------------------
| 01 | [Instantaneous attributes](modules/instantaneous.html) | Why does my frequency volume go negative? 
| 02 | [Relative acoustic impedance](modules/impedance.html) | Is this inversion? No — but why not? 
| 03 | [RMS amplitude](modules/rms.html) | How long should my window be? 
| 04 | [AGC](modules/agc.html) | Why did my bright spot disappear? 
| 05 | [Amplitude volume transform](modules/avt.html) | What am I actually looking at on an AVT slice? 
| 06 | [Teager-Kaiser energy](modules/teager.html) | How is this different from the envelope? 

Every module opens on the rock: step 1 draws the acoustic impedance under the
trace you have selected, beside the reflection coefficient each boundary
produces, so the chain from a layer to a wiggle to an attribute is visible
rather than asserted. Modules 01, 03, 05 and 06 also end in map view, because
that is where these attributes are actually used.

Algorithms follow the AASPI program documentation and the original papers. Where
a source is ambiguous or contradicts itself, the module says so rather than
quietly picking one.

Each module ends with the same four reference tabs: **Why it matters** (what the
attribute is used for and how it misleads), **Exercises** (six or seven, each
with the answer written out), **Key points**, and **Method** (how it is computed,
what has been simplified, and the references).

The exercises open in a second window on request, so they stay readable beside
the controls instead of behind them. The button is on the exercises tab; the
pop-out is a copy of the text already on the page, and it needs no network.

## What you need before starting

You should know that a seismic trace is a record of reflections, that a
reflection happens where acoustic impedance changes, and that impedance is
velocity multiplied by density. Nothing else is assumed. Every other term is
explained where it first appears, and there is no mathematics you have to do
yourself.

After working through the set you should be able to say what each attribute
measures and what it cannot see, recognize when an anomaly is geology and when
it is a window length or a gain decision, and give more than one explanation for
an amplitude anomaly. The last exercise in every module is built around that
habit.

## Using it in your teaching

Licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). You
are free to share and adapt this material for any purpose, including
commercially, provided you give appropriate credit and license any adaptation
under the same terms. Use it in a course, cut it up for a talk, translate it,
build on it — a credit line and a link back are all that is asked. The
ShareAlike term is the one that matters to us: what you make from this has to
stay as open as what you started with.

To cite: Bedle, H., and A. Moreno-Ward, 2026b, *How single-trace attributes
actually work: A set of browser-based interactive modules for teaching the
complex trace, relative impedance, RMS amplitude, AGC, AVT and Teager-Kaiser
energy*: SSRN Working Paper. SSRN: [article link to follow]

## What this is not

This is not attribute software. The algorithms are implemented as the literature
describes them, on small synthetic traces and in their plain form, so that the
method can be read and watched rather than assumed. For production work on real
volumes, use [AASPI](https://www.ou.edu/mcee/labs/aaspi) or your interpretation
package. The numbers here describe the model on the screen, not your survey.

## Privacy

Nothing you do inside a module leaves your browser. No slider setting, no click,
no computed trace is transmitted anywhere. One anonymous page-view ping goes out
from the hosted site, and a copy downloaded to disk does not send even that.

The one thing recorded is that a page was opened. No cookie, no account,
nothing about the person. That count exists so the modules people actually use
are the ones that get improved, and so there is something to show the university
when it asks whether anyone uses these.

Counting is handled by [GoatCounter](https://www.goatcounter.com) — free for
non-commercial use, cookieless, and requiring no consent banner. It is off for
local copies and for anyone browsing with Do Not Track set, and it can be
switched off entirely by deleting `assets/count.js` and the one `<script>` line
that loads it. That file documents exactly what is sent.

