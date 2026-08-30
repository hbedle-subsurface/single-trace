#!/usr/bin/env python3
"""
retrofit-footer.py — bring an older teaching repository's footers into line.

Does three things to every HTML page in a repository:

  1. installs assets/count.js and the one <script> line that loads it
  2. rewrites the footer as two columns: credit and citation on the left,
     licence and what-is-recorded on the right
  3. corrects any claim that no data leaves the machine, which stops being
     true the moment the counter is switched on

It leaves everything else alone. No markup outside the footer is touched, no
stylesheet is edited, and no teaching content is read or changed.

    python3 retrofit-footer.py --dry-run ../../seismic_resolution
    python3 retrofit-footer.py --title "What Can You REALLY See in Seismic?" \\
                               ../../seismic_resolution

--title is the work's title for the citation line. Without it the script uses
the repository's folder name, which is almost never what you want.

Run add-counter.py first, or pass --with-counter to do both in one go.
"""

import argparse
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
COUNT_SRC = os.path.join(HERE, '..', 'assets', 'count.js')
SKIP_DIRS = {'.git', 'node_modules', 'tools', '.github'}
TAG = re.compile(r'[ \t]*<script[^>]*src="[^"]*count\.js"[^>]*></script>\n?')

CREDIT = ('Built for teaching by Heather Bedle, School of Geosciences, University of Oklahoma, '
          'with the\n          <a href="https://www.ou.edu/mcee/labs/aaspi">AASPI</a> consortium.')

LICENCE = ('Free to use for teaching, demonstration and non-commercial\n'
           '          study, with credit. Please do not republish or redistribute it, modified or '
           'otherwise, without\n          permission.')

PRIVACY_MODULE = ('Nothing you do in this module leaves your browser. The only thing recorded is that\n'
                  '          the page was opened, so that I can show the university these are being used '
                  '&mdash; no cookie, no\n          account, nothing about you.')

PRIVACY_INDEX = ('Nothing you do in a module leaves your browser. The only thing recorded is that a\n'
                 '          page was opened &mdash; no cookie, no account, nothing about you.')


def footer_html(title, is_index):
    cite = ('To cite: H. Bedle, <i>%s</i>, University of\n'
            '          Oklahoma. <span class="k">SSRN: [article link to follow]</span>' % title)
    privacy = PRIVACY_INDEX if is_index else PRIVACY_MODULE
    return ('  <footer>\n'
            '    <div class="foot-grid">\n'
            '      <div style="flex:1 1 330px;max-width:46ch">\n'
            '        <p>%s</p>\n'
            '        <p>%s</p>\n'
            '      </div>\n'
            '      <div style="flex:1 1 330px;max-width:52ch">\n'
            '        <p>%s</p>\n'
            '        <p>%s</p>\n'
            '      </div>\n'
            '    </div>\n'
            '  </footer>' % (CREDIT, cite, LICENCE, privacy))


# claims that stop being true once a counter is installed
UNTRUE = [
    (re.compile(r'no data leaves your machine[.,]?\s*', re.I), ''),
    (re.compile(r',?\s*and no data is transmitted[.,]?\s*', re.I), ''),
    (re.compile(r'\bno analytics\b[.,]?\s*', re.I), ''),
]


# sentences the new footer already says, in one form or another. Anything else
# found in an old footer is real content and gets reported rather than binned:
# replacing a footer wholesale is the easiest way to delete something useful
# without noticing.
BOILERPLATE = [
    'built for teaching', 'heather bedle', 'school of geosciences',
    'university of oklahoma', 'aaspi', 'consortium',
    'free to use', 'adapt in your own courses', 'with citation',
    'runs in your browser', 'no install', 'no account',
    'no data leaves your machine', 'to cite',
]


def discarded(old_footer):
    """Sentences in the old footer that the new one does not cover."""
    txt = re.sub(r'<[^>]+>', ' ', old_footer)
    txt = re.sub(r'\s+', ' ', txt).strip()
    out = []
    for sentence in re.split(r'(?<=[.!?]) ', txt):
        s = sentence.strip()
        if len(s) < 25:
            continue
        low = s.lower()
        if any(b in low for b in BOILERPLATE):
            continue
        out.append(s)
    return ' | '.join(out)


def html_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in sorted(filenames):
            if f.lower().endswith('.html'):
                yield os.path.join(dirpath, f)


def relative_src(page, root):
    rel = os.path.relpath(os.path.join(root, 'assets', 'count.js'), os.path.dirname(page))
    return rel.replace(os.sep, '/')


def process(root, title, dry, with_counter):
    if with_counter:
        dest = os.path.join(root, 'assets', 'count.js')
        if not dry:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copyfile(COUNT_SRC, dest)
        print(('would copy ' if dry else 'copied    ') + os.path.relpath(dest, root))

    for page in html_files(root):
        name = os.path.relpath(page, root)
        text = open(page, encoding='utf-8').read()
        original = text
        notes = []
        is_index = os.path.basename(page).lower() == 'index.html'

        if with_counter and not TAG.search(text):
            line = '<script src="%s"></script>\n' % relative_src(page, root)
            m = re.search(r'[ \t]*<script[ >]', text)
            if m:
                text = text[:m.start()] + line + text[m.start():]
                notes.append('counter')
            elif '</body>' in text:
                i = text.rindex('</body>')
                text = text[:i] + line + text[i:]
                notes.append('counter')
            else:
                notes.append('NO </body>, counter skipped')

        # the footer, replaced whole
        fm = re.search(r'[ \t]*<footer[^>]*>.*?</footer>', text, re.S)
        if fm:
            new = footer_html(title, is_index)
            if fm.group(0).strip() != new.strip():
                lost = discarded(fm.group(0))
                if lost:
                    notes.append('DISCARDED: ' + lost)
                text = text[:fm.start()] + new + text[fm.end():]
                notes.append('footer')
        else:
            notes.append('NO FOOTER FOUND')

        # claims that are no longer true
        for pat, repl in UNTRUE:
            if pat.search(text):
                text = pat.sub(repl, text)
                notes.append('privacy claim corrected')

        if text == original:
            print('  unchanged        ' + name)
            continue
        if not dry:
            open(page, 'w', encoding='utf-8').write(text)
        print(('  would update     ' if dry else '  updated         ') + name +
              '   (' + ', '.join(notes) + ')')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('repo')
    ap.add_argument('--title', default=None, help="the work's title, for the citation line")
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--with-counter', action='store_true',
                    help='also install assets/count.js and its script tag')
    a = ap.parse_args()

    root = os.path.abspath(a.repo)
    if not os.path.isdir(root):
        sys.exit('not a directory: ' + root)
    title = a.title or os.path.basename(root)
    if not a.title:
        print('no --title given, using the folder name: ' + title)

    print(os.path.basename(root) + '   citing as: ' + title)
    process(root, title, a.dry_run, a.with_counter)


if __name__ == '__main__':
    main()
