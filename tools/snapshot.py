#!/usr/bin/env python3
"""Refreshes game/, the editor's bundled snapshot of the game's ExtraNet content, from a checkout.

    python tools/snapshot.py C:\\cmu\\wt-pc [--master origin/master]

Copies, at their repository paths:
  - every page and package under Content.CMU/Resources/ServerInfo/CMU14/ExtraNet/
  - the prototypes in Content.CMU/Resources/Prototypes/CMU14/PersonalComputers/
  - Content.CMU/Resources/Locale/en-US/CMU14/personal-computers.ftl
  - the art in Content.CMU/Resources/Textures/CMU14/PersonalComputers/
  - the computer's sounds in Content.CMU/Resources/Audio/CMU14/PersonalComputers/, with their attributions.yml
  - every other texture, RSI or font those files (and the editor) use that the public master branch lacks,
    and every CMU14 texture they use, so art that is not pushed yet shows too.
Then writes game/index.json, the list of bundled files. Anything else the editor reads (most game sprites)
comes from GitHub master. Files are copied as they are; text files get LF line endings.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone

CMU = 'Content.CMU/Resources/'
UPSTREAM = 'Resources/'
FOLDERS = [
    CMU + 'ServerInfo/CMU14/ExtraNet/',
    CMU + 'Prototypes/CMU14/PersonalComputers/',
    CMU + 'Textures/CMU14/PersonalComputers/',
    CMU + 'Audio/CMU14/PersonalComputers/',
]
FILES = [CMU + 'Locale/en-US/CMU14/personal-computers.ftl']
# Resources the editor itself draws: the page fonts, the ATM card reader and lights, the ID card.
EDITOR_NEEDS = [
    '/Fonts/NotoSans/NotoSans-Regular.ttf', '/Fonts/NotoSans/NotoSans-Bold.ttf', '/Fonts/NotoSans/NotoSans-Italic.ttf',
    '/Fonts/NotoSans/NotoSans-BoldItalic.ttf', '/Fonts/NotoSansDisplay/NotoSansDisplay-Regular.ttf',
    '/Fonts/NotoSansDisplay/NotoSansDisplay-Bold.ttf', '/Fonts/RobotoMono/RobotoMono-Regular.ttf',
    '/Fonts/RobotoMono/RobotoMono-Bold.ttf', '/Fonts/UAVOSD/UAV-OSD-Sans-Mono.ttf', '/Fonts/Cozette/CozetteVector.ttf',
    '/Fonts/Cozette/CozetteVectorBold.ttf',
    '/Textures/CMU14/ColonyEconomy/atm_reader.rsi', '/Textures/CMU14/ColonyEconomy/atm_leds.rsi',
    '/Textures/_RMC14/Objects/CMIDs/id.rsi',
]
TEXT = re.compile(r'\.(xml|yml|yaml|ftl|json|txt|md)$', re.I)
REFERENCE = re.compile(r'(/(?:Textures|Fonts|ServerInfo)/[^"\'\s<>\]\[)]+)')
RSI_ATTR = re.compile(r'\b(?:Rsi|rsi)\s*[=:]\s*"?([^"\s>]+\.rsi)')


def git_files(checkout, ref):
    try:
        out = subprocess.run(['git', '-C', checkout, 'ls-tree', '-r', '--name-only', ref],
                             check=True, capture_output=True, text=True).stdout
        return set(out.splitlines())
    except (OSError, subprocess.CalledProcessError) as e:
        print(f'warning: could not list {ref} ({e}); bundling every referenced file', file=sys.stderr)
        return set()


def walk(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d != '__pycache__']
        for name in filenames:
            yield os.path.join(dirpath, name)


def rel(checkout, path):
    return os.path.relpath(path, checkout).replace(os.sep, '/')


def resolve(checkout, rooted):
    """A rooted resource path (/Textures/x) as its repository path, the way the game merges both roots."""
    rooted = rooted.rstrip('/.,;')
    for prefix in (CMU, UPSTREAM):
        candidate = prefix + rooted.lstrip('/')
        if os.path.exists(os.path.join(checkout, candidate)):
            return candidate
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('checkout', help='the game repository checkout, e.g. C:\\cmu\\wt-pc')
    parser.add_argument('--master', default='origin/master', help='the public branch whose files need no copy')
    parser.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'game'))
    args = parser.parse_args()
    checkout = os.path.abspath(args.checkout)
    out = os.path.abspath(args.out)
    if not os.path.isdir(os.path.join(checkout, CMU)):
        sys.exit(f'{checkout} does not look like the game repository (no {CMU})')

    master = git_files(checkout, args.master)
    wanted = set()
    for folder in FOLDERS:
        for path in walk(os.path.join(checkout, folder)):
            wanted.add(rel(checkout, path))
    for file in FILES:
        if os.path.exists(os.path.join(checkout, file)):
            wanted.add(file)

    # Everything the bundled text files and the editor point at.
    references = set(EDITOR_NEEDS)
    for path in sorted(wanted):
        if not TEXT.search(path):
            continue
        with open(os.path.join(checkout, path), encoding='utf-8', errors='replace') as f:
            text = f.read()
        references.update(REFERENCE.findall(text))
        references.update('/Textures/' + r.lstrip('/') if not r.startswith('/') else r for r in RSI_ATTR.findall(text))
    sprites = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'ad_sprites.json')
    if os.path.exists(sprites):
        with open(sprites, encoding='utf-8') as f:
            for layers in json.load(f).values():
                for layer in layers:
                    if layer.get('rsi'):
                        references.add('/Textures/' + layer['rsi'].lstrip('/'))

    missing = []
    for rooted in sorted(references):
        found = resolve(checkout, rooted)
        if not found:
            missing.append(rooted)
            continue
        full = os.path.join(checkout, found)
        files = [rel(checkout, p) for p in walk(full)] if os.path.isdir(full) else [found]
        for file in files:
            # CMU14 art is always bundled (it may be newer than master); upstream art only when master lacks it.
            if file.startswith(CMU + 'Textures/CMU14/') or file.startswith(CMU + 'Fonts/') or file not in master:
                wanted.add(file)

    if os.path.isdir(out):
        shutil.rmtree(out)
    total = 0
    for file in sorted(wanted):
        source = os.path.join(checkout, file)
        target = os.path.join(out, file)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        if TEXT.search(file):
            with open(source, 'rb') as f:
                data = f.read()
            if data.startswith(b'\xef\xbb\xbf'):
                data = data[3:]
            data = data.replace(b'\r\n', b'\n').replace(b'\r', b'\n')
            with open(target, 'wb') as f:
                f.write(data)
        else:
            shutil.copyfile(source, target)
        total += os.path.getsize(target)

    try:
        commit = subprocess.run(['git', '-C', checkout, 'rev-parse', '--short', 'HEAD'], check=True,
                                capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        commit = ''
    index = {
        'generated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'commit': commit,
        'files': sorted(wanted),
    }
    with open(os.path.join(out, 'index.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(index, f, indent=0)
        f.write('\n')
    print(f'{len(wanted)} files, {total / 1048576:.1f} MB, into {out}')
    if missing:
        print(f'{len(missing)} referenced paths not found in the checkout (the game would miss them too):')
        for path in missing:
            print('  ' + path)


if __name__ == '__main__':
    main()
