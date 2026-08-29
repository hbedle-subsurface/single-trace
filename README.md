# How Single-Trace Attributes Actually Work

Interactive teaching modules on the seismic attributes computed from one trace
at a time. Free to use, nothing to install, and everything on the screen is
computed live in the browser while you change it.

**[Open the modules →](https://hbedle-subsurface.github.io/single-trace/)**

Heather Bedle, School of Geosciences, University of Oklahoma, with the
[AASPI](https://www.ou.edu/mcee/labs/aaspi) consortium.

---

## Why this exists

Most people who use seismic attributes were never taught the machinery inside
them. They know the rules — envelope is reflection strength, phase is good for
following weak reflectors, sweetness finds sands — and they apply those rules
where they remember them and nowhere else. What they have never done is *watch
the thing happen*: change the wavelet and see the frequency map change, turn the
gain up and watch a bright spot appear where there is no bright spot.

A rule that has been read is fragile. A limit that has been watched arising is
available in situations the rule never named.

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
  and every student opens the same picture.

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

The companion set, *How Geometric Attributes Actually Work*, covers the
attributes that do look sideways: dip, coherence, curvature.

## The modules

| # | Subject | The question it answers | Status |
|---|---------|-------------------------|--------|
| 01 | [Instantaneous attributes](modules/instantaneous.html) | Why does my frequency volume go negative? | **ready** |
| 02 | Relative acoustic impedance | Is this inversion? No — but why not? | planned |
| 03 | RMS amplitude | How long should my window be? | planned |
| 04 | AGC | Why did my bright spot disappear? | planned |
| 05 | Amplitude volume transform | What am I actually looking at on an AVT slice? | planned |
| 06 | Teager-Kaiser energy | How is this different from the envelope? | planned |

Algorithms follow the AASPI program documentation and the original papers. Where
a source is ambiguous or contradicts itself, the module says so rather than
quietly picking one.

## Using it in your teaching

Free to use for teaching, demonstration, and non-commercial study, provided the
source is credited. Please do not republish or redistribute it, modified or
otherwise, without permission. If you use it in a course or a talk, a credit
line and a link back are all that is asked.

To cite: H. Bedle, *How Single-Trace Attributes Actually Work*, University of
Oklahoma. SSRN: [article link to follow]

A module is a single self-contained HTML file. It can be downloaded, emailed, or
opened from a memory stick with no network at all and it will still work, which
matters in a classroom with unreliable wifi.

## What this is not

This is not attribute software. The algorithms are implemented as the literature
describes them, on small synthetic traces and in their plain form, so that the
method can be read and watched rather than assumed. For production work on real
volumes, use [AASPI](https://www.ou.edu/mcee/labs/aaspi) or your interpretation
package. The numbers here describe the model on the screen, not your survey.

## Privacy

Nothing you do inside a module leaves your browser. No slider setting, no click,
no computed trace is transmitted anywhere, and the modules make no network
requests at all.

The one thing recorded is that a page was opened. No cookie, no account,
nothing about the person. That count exists so the modules people actually use
are the ones that get improved, and so there is something to show the university
when it asks whether anyone uses these.

Counting is handled by [GoatCounter](https://www.goatcounter.com) — free for
non-commercial use, cookieless, and requiring no consent banner. It is off for
local copies and for anyone browsing with Do Not Track set, and it can be
switched off entirely by deleting `assets/count.js` and the one `<script>` line
that loads it. That file documents exactly what is sent.

## For anyone maintaining this

File layout, the shared attribute library, and the verification harness are
documented in [`docs/MAINTAINING.md`](docs/MAINTAINING.md).
