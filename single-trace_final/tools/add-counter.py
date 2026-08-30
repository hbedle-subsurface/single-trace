#!/usr/bin/env python3
"""
add-counter.py — put the page-view counter into a teaching repository.

Run it once per repository. It copies assets/count.js in and adds the one
<script> line to every HTML page, working out the right relative path for
pages that sit in subfolders. Running it twice changes nothing.

    python3 add-counter.py ../../geometric-attributes
    python3 add-counter.py ../../attribute_quiz
    python3 add-counter.py ../../seismic_resolution

To check what it would do without touching anything:

    python3 add-counter.py --dry-run ../../avo-basics

To take the counter back out of a repository:

    python3 add-counter.py --remove ../../avo-basics

The counter itself is off until COUNT_CODE is filled in inside count.js, so it
is safe to install everywhere first and switch it on afterwards. Fill the code
in once, in this repository's assets/count.js, before running this — the copy
is taken from here, so every repository ends up with the same code.
"""

import argparse
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, '..', 'assets', 'count.js')

TAG = re.compile(r'[ \t]*<script[^>]*src="[^"]*count\.js"[^>]*></script>\n?')
SKIP_DIRS = {'.git', 'node_modules', 'tools', '.github'}


def html_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in sorted(filenames):
            if f.lower().endswith('.html'):
                yield os.path.join(dirpath, f)


def relative_src(page, root):
    """assets/count.js from the page's point of view, however deep it sits."""
    target = os.path.join(root, 'assets', 'count.js')
    rel = os.path.relpath(target, os.path.dirname(page))
    return rel.replace(os.sep, '/')


def install(root, dry):
    dest = os.path.join(root, 'assets', 'count.js')
    if not dry:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copyfile(SOURCE, dest)
    print(('would copy ' if dry else 'copied    ') + os.path.relpath(dest, root))

    for page in html_files(root):
        text = open(page, encoding='utf-8').read()
        name = os.path.relpath(page, root)
        if TAG.search(text):
            print('  already has it   ' + name)
            continue
        line = '<script src="%s"></script>\n' % relative_src(page, root)

        # Prefer to sit just above the first other <script>, which is where the
        # page's own code starts; otherwise just inside </body>.
        m = re.search(r'[ \t]*<script[ >]', text)
        if m:
            new = text[:m.start()] + line + text[m.start():]
        elif '</body>' in text:
            i = text.rindex('</body>')
            new = text[:i] + line + text[i:]
        else:
            print('  NO </body>, SKIPPED ' + name)
            continue
        if not dry:
            open(page, 'w', encoding='utf-8').write(new)
        print(('  would add        ' if dry else '  added           ') + name)


def remove(root, dry):
    for page in html_files(root):
        text = open(page, encoding='utf-8').read()
        new = TAG.sub('', text)
        name = os.path.relpath(page, root)
        if new == text:
            continue
        if not dry:
            open(page, 'w', encoding='utf-8').write(new)
        print(('  would remove from ' if dry else '  removed from     ') + name)
    dest = os.path.join(root, 'assets', 'count.js')
    if os.path.exists(dest):
        if not dry:
            os.remove(dest)
        print(('would delete ' if dry else 'deleted    ') + os.path.relpath(dest, root))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('repo', help='path to the repository to install into')
    ap.add_argument('--dry-run', action='store_true', help='say what would happen, change nothing')
    ap.add_argument('--remove', action='store_true', help='take the counter back out')
    a = ap.parse_args()

    root = os.path.abspath(a.repo)
    if not os.path.isdir(root):
        sys.exit('not a directory: ' + root)
    if not os.path.exists(SOURCE):
        sys.exit('cannot find ' + SOURCE)

    print(os.path.basename(root))
    if a.remove:
        remove(root, a.dry_run)
    else:
        install(root, a.dry_run)


if __name__ == '__main__':
    main()
