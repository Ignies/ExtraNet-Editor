#!/usr/bin/env python3
"""Refreshes game/, the editor's bundled snapshot of the game's ExtraNet content, from a checkout.

    python tools/snapshot.py C:\\cmu\\wt-pc [--master origin/master]

Copies, at their repository paths:
  - every page and package under Content.CMU/Resources/ServerInfo/CMU14/ExtraNet/
  - the prototypes in Content.CMU/Resources/Prototypes/CMU14/PersonalComputers/
  - Content.CMU/Resources/Locale/en-US/CMU14/personal-computers.ftl and the games' Games/*.ftl beside it
  - the art in Content.CMU/Resources/Textures/CMU14/PersonalComputers/
  - the computer's sounds in Content.CMU/Resources/Audio/CMU14/PersonalComputers/, with their attributions.yml
  - every other texture, RSI or font those files (and the editor) use that the public master branch lacks,
    and every CMU14 texture they use, so art that is not pushed yet shows too.
  - the games' own resources, always: the blood splatter RSI, and every /Audio/...ogg path written out in full
    in a string in js/emulator/ (with the attributions.yml of its folder).
Then writes game/index.json, the list of bundled files. Anything else the editor reads (most game sprites)
comes from GitHub master. Files are copied as they are; text files get LF line endings.

It also writes data/shop_items.json: the name, description and sprite layers of every item an ExtraNet shop
catalogue (cmuShopCatalog) sells, following parent: as the game does, for the shop's pictures. That needs PyYAML;
without it the file is left as it is.
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
    CMU + 'Locale/en-US/CMU14/PersonalComputers/Games/',
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
    '/Textures/CMU14/Interface/VerbIcons/relay_bug.svg.192dpi.png',
    '/Textures/CMU14/Interface/VerbIcons/relay_format.svg.192dpi.png',
]
# Resources the emulator's games use, bundled even when master has them, so the games play offline.
GAME_NEEDS = [
    '/Textures/Fluids/splatter.rsi', '/Audio/Machines/printer.ogg', '/Audio/_RMC14/Handling/paper_pickup.ogg',
    '/Textures/_RMC14/Objects/Misc/paper.rsi', '/Textures/_RMC14/Interface/map_blips.rsi',
    '/Textures/Interface/Paper/paper_background_default.svg.96dpi.png',
]
EDITOR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SOUND = re.compile(r'''['"`](/Audio/[^'"`\s$]+\.ogg)['"`]''')
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


ENTITY_ID = re.compile(r'^\s*(?:-\s+)?id:\s*([A-Za-z0-9_]+)\s*$', re.M)


def load_yaml(text):
    """The game's YAML, its !type: tags read as plain values. None without PyYAML."""
    try:
        import yaml
    except ImportError:
        return None

    class Loader(yaml.SafeLoader):
        pass

    def tagged(loader, suffix, node):
        if isinstance(node, yaml.MappingNode):
            return loader.construct_mapping(node, deep=True)
        if isinstance(node, yaml.SequenceNode):
            return loader.construct_sequence(node, deep=True)
        return loader.construct_scalar(node)

    Loader.add_multi_constructor('!', tagged)
    try:
        return yaml.load(text, Loader=Loader) or []
    except yaml.YAMLError:
        return []


def shop_items(checkout, catalogs):
    """
    { entity id: { name, description, layers: [{ rsi, state }] } } for every item the catalogues sell: what
    EntityPrototypeView draws, the Sprite component merged down the parents, its hidden layers left out.
    """
    if load_yaml('[]') is None:
        return None
    files = {}
    for root in (CMU + 'Prototypes/', UPSTREAM + 'Prototypes/'):
        for path in walk(os.path.join(checkout, root)):
            if not path.endswith('.yml'):
                continue
            with open(path, encoding='utf-8', errors='replace') as f:
                for found in ENTITY_ID.findall(f.read()):
                    files.setdefault(found, []).append(path)
    parsed = {}
    entities = {}

    def entity(ident):
        if ident in entities:
            return entities[ident]
        entities[ident] = None
        for path in files.get(ident, []):
            if path not in parsed:
                with open(path, encoding='utf-8', errors='replace') as f:
                    parsed[path] = load_yaml(f.read())
            for proto in parsed[path] if isinstance(parsed[path], list) else []:
                if isinstance(proto, dict) and proto.get('type') == 'entity' and proto.get('id') == ident:
                    entities[ident] = proto
                    return proto
        return None

    def merged(ident, seen=()):
        proto = entity(ident)
        if not proto or ident in seen:
            return {'components': {}}
        parents = proto.get('parent') or []
        if isinstance(parents, str):
            parents = [parents]
        out = {'components': {}}
        for parent in parents:
            base = merged(parent, seen + (ident,))
            for key in ('name', 'description'):
                if key in base:
                    out[key] = base[key]
            for kind, data in base['components'].items():
                out['components'][kind] = {**out['components'].get(kind, {}), **data}
        for key in ('name', 'description'):
            if key in proto:
                out[key] = proto[key]
        for component in proto.get('components') or []:
            if isinstance(component, dict) and component.get('type'):
                kind = component['type']
                out['components'][kind] = {**out['components'].get(kind, {}), **component}
        return out

    items = {}
    for ident in sorted({item for catalog in catalogs for item in catalog}):
        data = merged(ident)
        sprite = data['components'].get('Sprite', {})
        rsi = sprite.get('sprite')
        layers = []
        for layer in sprite.get('layers') or ([{'state': sprite['state']}] if sprite.get('state') else []):
            if not isinstance(layer, dict) or layer.get('visible') is False or not layer.get('state'):
                continue
            path = layer.get('sprite') or rsi
            if path:
                layers.append({'rsi': str(path), 'state': str(layer['state'])})
        items[ident] = {'name': str(data.get('name') or ident), 'description': str(data.get('description') or ''), 'layers': layers}
    return items


def emulator_sounds():
    """Every /Audio/...ogg path written out in a string literal in the emulator's scripts."""
    sounds = set()
    for path in walk(os.path.join(EDITOR, 'js', 'emulator')):
        if path.endswith('.js'):
            with open(path, encoding='utf-8', errors='replace') as f:
                sounds.update(SOUND.findall(f.read()))
    return sounds


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
    # What the shops sell, for their pictures (CMUNetShop).
    catalogs = []
    for path in sorted(wanted):
        if path.startswith(CMU + 'Prototypes/') and path.endswith('.yml'):
            with open(os.path.join(checkout, path), encoding='utf-8', errors='replace') as f:
                text = f.read()
            if 'cmuShopCatalog' not in text:
                continue
            for proto in load_yaml(text) or []:
                if isinstance(proto, dict) and proto.get('type') == 'cmuShopCatalog':
                    catalogs.append([e['item'] for e in proto.get('entries') or [] if isinstance(e, dict) and e.get('item')])
    shop = os.path.join(EDITOR, 'data', 'shop_items.json')
    items = shop_items(checkout, catalogs)
    if items is None:
        print('warning: PyYAML is not installed; data/shop_items.json is left as it is', file=sys.stderr)
    else:
        with open(shop, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(items, f, indent=1, ensure_ascii=False)
            f.write('\n')
    for sprites in (os.path.join(EDITOR, 'data', 'ad_sprites.json'), shop):
        if not os.path.exists(sprites):
            continue
        with open(sprites, encoding='utf-8') as f:
            for layers in json.load(f).values():
                for layer in layers['layers'] if isinstance(layers, dict) else layers:
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

    # The games' textures and sounds, with the attributions that license each sound folder.
    for rooted in sorted(set(GAME_NEEDS) | emulator_sounds()):
        found = resolve(checkout, rooted)
        if not found:
            missing.append(rooted)
            continue
        full = os.path.join(checkout, found)
        if os.path.isdir(full):
            wanted.update(rel(checkout, p) for p in walk(full))
        else:
            wanted.add(found)
        attributions = os.path.join(os.path.dirname(full), 'attributions.yml')
        if found.startswith(tuple(p + 'Audio/' for p in (CMU, UPSTREAM))) and os.path.exists(attributions):
            wanted.add(rel(checkout, attributions))

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
