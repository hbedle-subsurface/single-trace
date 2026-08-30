#!/usr/bin/env python3
"""
reflow-steps.py — get a picture on screen sooner.

Every step in these modules opens with prose and then shows a panel. Reading
150 to 380 words before anything moves is the wrong order for an interactive
module: the reader should be able to look at the thing while reading about it.

This moves the surplus opening paragraphs to just after the panel instead of
deleting them. Nothing is lost, and the argument still runs in the same order
on the page — it just starts under the picture rather than above it.

The rule: keep opening paragraphs until the running total passes TARGET words,
then move everything else that sits between there and the panel. Lists and
sliders are never moved, because a list that explains the panel's three curves
belongs above it and a control belongs next to what it controls.

    python3 reflow-steps.py --dry-run ../modules/rms.html
    python3 reflow-steps.py ../modules/*.html
"""

import argparse
import re
import sys

TARGET = 120          # words before the panel, roughly
KEEP_AT_LEAST = 1     # never move the first paragraph

PANEL = re.compile(r'<canvas\b|<div class="sec-row"')
PARA = re.compile(r'[ \t]*<p class="lede">.*?</p>\n', re.S)
BLOCKER = re.compile(r'<ul class="lede"|<div class="ctl"|<div class="controls"')


def words(html):
    t = re.sub(r'<[^>]+>', ' ', html)
    t = re.sub(r'&[a-z]+;', ' ', t)
    return len(t.split())


def reflow_pane(pane):
    """Return the pane with surplus opening paragraphs moved below the panel."""
    m = PANEL.search(pane)
    if not m:
        return pane, 0, 0
    head, tail = pane[:m.start()], pane[m.start():]

    before = words(head)
    paras = list(PARA.finditer(head))
    if len(paras) <= KEEP_AT_LEAST:
        return pane, before, before

    # anything after a list or a control stays where it is: those blocks
    # introduce the panel directly and splitting around them reads badly
    blocker = BLOCKER.search(head)
    limit = blocker.start() if blocker else len(head)

    running, cut = 0, None
    for i, p in enumerate(paras):
        if p.start() >= limit:
            break
        running += words(p.group(0))
        if i + 1 >= KEEP_AT_LEAST and running >= TARGET and i + 1 < len(paras):
            cut = paras[i + 1].start()
            break
    if cut is None:
        return pane, before, before

    moved_end = paras[-1].end() if paras[-1].start() < limit else limit
    moved = head[cut:moved_end]
    if not moved.strip():
        return pane, before, before
    kept = head[:cut] + head[moved_end:]

    # put the moved paragraphs after the panel: after the closing </canvas> or
    # after the sec-row div, whichever this pane uses
    if tail.lstrip().startswith('<div class="sec-row"'):
        depth, i = 0, 0
        while i < len(tail):
            if tail.startswith('<div', i):
                depth += 1
            elif tail.startswith('</div>', i):
                depth -= 1
                if depth == 0:
                    i += len('</div>')
                    break
            i += 1
        insert = i
    else:
        e = tail.find('</canvas>')
        insert = e + len('</canvas>') if e >= 0 else len(tail)
    while insert < len(tail) and tail[insert] == '\n':
        insert += 1

    new_tail = tail[:insert] + '\n' + moved.rstrip('\n') + '\n' + tail[insert:]
    return kept + new_tail, before, words(kept)


def process(path, dry):
    s = open(path, encoding='utf-8').read()
    out, report = [], []
    pos = 0
    for m in re.finditer(r'<section class="tabpane" id="(p[1-9])".*?</section>', s, re.S):
        out.append(s[pos:m.start()])
        pane, before, after = reflow_pane(m.group(0))
        out.append(pane)
        report.append((m.group(1), before, after))
        pos = m.end()
    out.append(s[pos:])
    new = ''.join(out)
    changed = [r for r in report if r[1] != r[2]]
    print(path.split('/')[-1].ljust(22) +
          '  '.join('%s %d->%d' % r for r in report))
    if not dry and new != s:
        open(path, 'w', encoding='utf-8').write(new)
    return len(changed)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    n = sum(process(f, a.dry_run) for f in a.files)
    print(('would move' if a.dry_run else 'moved') + ' prose in %d step(s)' % n)


if __name__ == '__main__':
    main()
