# Adding the control-panel pop-out to a repository

`assets/panelout.js` puts an **Open controls in a window** button on the header
panel of every module. The student gets the seismic line and the sliders in a
second window and can keep them beside the panels they drive.

It is the live companion to `assets/popout.js`, which does the same for the
exercises. The exercise copy is static, because exercise text does not change.
This one is connected: every slider moved in the second window changes the
module in the first, and the header canvases are mirrored back, so the second
window shows whatever the module drew on the line.

The same file goes in every teaching repository, unchanged.

---

## 1. Copy the file

Copy `assets/panelout.js` from any repository that already has it. Do not edit
it. If it needs a change, change it everywhere.

## 2. Add one script tag per module

Next to the other shared scripts:

```html
<script src="../assets/count.js"></script>
<script src="../assets/popout.js"></script>
<script src="../assets/panelout.js"></script>
<script src="../assets/seismic.js"></script>
<script src="../assets/trace.js"></script>
```

Order does not matter. The script waits for `DOMContentLoaded` and touches
nothing but the header panel.

## 3. What the module has to provide

One thing, already true of every module here: the header panel is
`<div class="labhead">`, and each half of it opens with a `<p class="cap">` line.
The button goes at the right-hand end of the last of those. The earlier module
sets put their sliders in `<section class="controls">` with no caption line; the
script takes that element instead where it finds it, and adds a row along the
foot of the grid to hold the button. If neither is present the button does not
appear and the page is otherwise untouched.

**No module JavaScript has to change.** The clone's inputs are not the module's
inputs. When one of them moves, the matching element in the first window is
found by its position in the panel, its value is copied onto it, and an ordinary
`input` event is fired there. Every module already listens for that event, so it
cannot tell the difference between a slider moved in its own window and one
moved in the second. Buttons call `click()` on their counterpart, and a pointer
press on a cloned canvas is forwarded to the real canvas at the same fractional
position — which is what keeps the click-to-pick-a-trace behavior of the seismic
line working from the second window.

## 4. What it does to the page

While the pop-out is open the real panel is moved into a zero-height wrapper
rather than hidden with `display:none`. The modules measure canvas width from
the parent element, and an element that is `display:none` has no width to
measure, so hiding it that way would collapse every plot on the page. A slim bar
takes its place with a **Bring them back** button.

Closing either window restores the panel.

## 5. Check it

```
node tools/harness-panelout.js modules/rms.html
```

The harness loads the module with its own scripts running, gives `window.open` a
second document, and then works the module from the clone: every slider in turn,
a press on the map, the readouts coming back, and the panel returning to the
page when the window closes. Run it against each module after installing the
file.

By hand, open a module and confirm:

- moving a slider in the second window changes the panels in the first
- the seismic line in the second window follows, including the trace marker
- clicking the line in the second window picks a trace in the first
- moving a slider in the first window moves the matching slider in the second
- a second module opens its own window rather than replacing the first
- closing the pop-out puts the panel back and the plots redraw at full width

## 6. What it does and does not do

**Does:** clone markup that is already on the page into a second window and
forward events between the two.

**Does not:** fetch anything, send anything, store anything, or set a cookie. It
works from a `file://` copy with no network, which is the case that matters when
a student is working from a downloaded folder.
