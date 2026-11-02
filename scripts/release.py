#!/usr/bin/env python3
# SPDX-License-Identifier: MIT OR Apache-2.0
"""Deterministic static-distribution packaging; Python standard library only."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEMVER = re.compile(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?')
BUILD_LINE = re.compile(r'^/\* @build \*/ const VERSION = .*?;$', re.M)
REQUIRED = ['keypad-tools.js', 'pencil-gestures.js', 'touch-shell.js', 'sketch-tools.js', 'sketch-tools-view.js', 'LICENSE-MIT', 'LICENSE-APACHE', 'NOTICE', 'FORK-NOTICE.md',
            'THIRD-PARTY-LICENSES.txt', 'IPAD-ANPASSUNG.md', 'README.md', 'CHANGELOG.md',
            'project.json', 'project-version.js', 'about.html', 'legal/upstream-files.json',
            'legal/upstream/ATTRIBUTION.md', 'legal/upstream/DISCLAIMER.md',
            'fonts/OFL.txt', 'fonts/craft-ui-sc/OFL.txt', 'fonts/craft-ui-tc/OFL.txt']


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(root, name):
    p = Path(name)
    if p.is_absolute() or '..' in p.parts or not p.parts or '\\' in name:
        raise ValueError(f'unsafe distribution path: {name}')
    result = root / p
    if result.is_symlink() or not result.resolve().is_relative_to(root.resolve()):
        raise ValueError(f'path leaves distribution: {name}')
    return result


def metadata(root):
    m = json.loads((root / 'project.json').read_text(encoding='utf-8'))
    if m.get('schema_version') != 1 or not SEMVER.fullmatch(m.get('version', '')):
        raise ValueError('project.json needs schema_version 1 and a SemVer version without build metadata')
    u = m['upstream']
    if not re.fullmatch(r'[a-f0-9]{40}', u['commit']):
        raise ValueError('upstream commit must be pinned to 40 hex characters')
    for key in ['archive_sha256', 'wasm_sha256']:
        if not re.fullmatch(r'[a-f0-9]{64}', u[key]):
            raise ValueError(f'upstream {key} must be SHA-256')
    expected = f"https://github.com/tangency-labs/solidcraft/releases/download/{u['tag']}/solidcraft-web-{u['version']}.zip"
    if u['repository'] != 'https://github.com/tangency-labs/solidcraft' or u['archive_url'] != expected:
        raise ValueError('upstream release URL must point to the pinned original repository')
    return m


def distribution_files(root):
    # Whitelist publishable material; never ship .git, Actions credentials or local output.
    files = {p for p in root.iterdir() if p.is_file() and p.suffix in {'.html', '.css', '.js', '.json', '.webmanifest', '.md', '.txt', '.svg'}}
    files.update(root / n for n in ['LICENSE-MIT', 'LICENSE-APACHE', 'NOTICE', '.nojekyll'])
    for directory in ['fonts', 'icons', 'wasm', 'legal', 'docs', 'scripts', 'tests']:
        files.update(p for p in (root / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    for p in files:
        safe_path(root, p.relative_to(root).as_posix())
    return sorted(files, key=lambda p: p.relative_to(root).as_posix())


def version_script(m):
    info = {'name': m['name'], 'version': m['version'], 'upstream_version': m['upstream']['version'], 'repository': m['repository']}
    return ('// Generated from project.json by scripts/release.py; do not edit.\n'
            '// SPDX-License-Identifier: MIT OR Apache-2.0\n'
            f'window.SOLIDCRAFT_IPAD_RELEASE = Object.freeze({json.dumps(info, ensure_ascii=False, sort_keys=True)});\n')


def write_or_check(path, content, check):
    if check:
        if not path.is_file() or path.read_text(encoding='utf-8') != content:
            raise ValueError(f'{path.name} is stale; run python3 scripts/release.py prepare')
    else:
        path.write_text(content, encoding='utf-8')


def prepare(root, check=False):
    m = metadata(root)
    write_or_check(root / 'project-version.js', version_script(m), check)
    rows = [{'file': p.relative_to(root).as_posix(), 'sha256': sha(p.read_bytes())}
            for p in distribution_files(root) if p.name not in {'build.json', 'sw.js'}]
    digest = sha(json.dumps(rows, sort_keys=True, separators=(',', ':')).encode())[:16]
    build = {'version': f"{m['version']}+{digest}", 'modified_by': 'solidcraft-ipad; see FORK-NOTICE.md', 'files': rows}
    write_or_check(root / 'build.json', json.dumps(build, indent=2, ensure_ascii=False) + '\n', check)
    worker = (root / 'sw.js').read_text(encoding='utf-8')
    replacement = f"/* @build */ const VERSION = {json.dumps(build['version'])}, FILES = {json.dumps(rows, separators=(',', ':'))};"
    if len(BUILD_LINE.findall(worker)) != 1:
        raise ValueError('sw.js must have exactly one generated @build line')
    write_or_check(root / 'sw.js', BUILD_LINE.sub(lambda _: replacement, worker), check)
    return build


def verify_local(root):
    m = metadata(root)
    for name in REQUIRED:
        if not safe_path(root, name).is_file():
            raise ValueError(f'missing distribution notice/metadata: {name}')
    prepare(root, check=True)
    readme = (root / 'README.md').read_text(encoding='utf-8')
    if f"**iPad-Ausgabe {m['version']}**" not in readme or f"**SolidCraft {m['upstream']['version']}**" not in readme:
        raise ValueError('README advertises a different project/upstream version')
    names = {p.relative_to(root).as_posix() for p in distribution_files(root)}
    for page in ['index.html', 'about.html']:
        for name in re.findall(r'(?:src|href)="([^"#]+)"', (root / page).read_text(encoding='utf-8')):
            if name.startswith(('https://', 'http://')) or name in {'./', '/'}:
                continue
            relative = name.removeprefix('./').split('?', 1)[0]
            if relative not in names:
                raise ValueError(f'{page} references an omitted file: {relative}')
    records = json.loads((root / 'legal/upstream-files.json').read_text(encoding='utf-8'))['files']
    if len({r['file'] for r in records}) != len(records):
        raise ValueError('duplicate upstream inventory entry')
    for row in records:
        if sha(safe_path(root, row['file']).read_bytes()) != row['sha256']:
            raise ValueError(f"upstream file changed without a provenance update: {row['file']}")
    parts = sorted((root / 'wasm').glob('*.bin'))
    # The numeric order is explicit: lexical sorting would place part10 before part2.
    parts.sort(key=lambda p: int(re.search(r'\.part(\d+)\.bin$', p.name).group(1)))
    if not parts or [int(re.search(r'\.part(\d+)\.bin$', p.name).group(1)) for p in parts] != list(range(len(parts))):
        raise ValueError('WASM parts must form a contiguous sequence starting at zero')
    digest = hashlib.sha256()
    size = 0
    for part in parts:
        data = part.read_bytes()
        digest.update(data)
        size += len(data)
    if size != m['upstream']['wasm_bytes'] or digest.hexdigest() != m['upstream']['wasm_sha256']:
        raise ValueError('reassembled WASM differs from the pinned upstream module')
    if f"## [{m['version']}]" not in (root / 'CHANGELOG.md').read_text(encoding='utf-8'):
        raise ValueError('version has no CHANGELOG section')
    return m


def verify_archive(root, archive):
    m = metadata(root)
    if sha(archive.read_bytes()) != m['upstream']['archive_sha256']:
        raise ValueError('upstream release archive checksum mismatch')
    with zipfile.ZipFile(archive) as z:
        prefix = f"solidcraft-web-{m['upstream']['version']}/"
        for row in json.loads((root / 'legal/upstream-files.json').read_text(encoding='utf-8'))['files']:
            name = row['file']
            if name.startswith(('legal/', 'wasm/')):
                continue
            if sha(z.read(prefix + name)) != row['sha256']:
                raise ValueError(f'file does not match official release: {name}')
        wasm = [n for n in z.namelist() if n.endswith('.wasm')]
        if len(wasm) != 1 or sha(z.read(wasm[0])) != m['upstream']['wasm_sha256']:
            raise ValueError('official release WASM checksum mismatch')


def package(root, output, tag=None):
    m = verify_local(root)
    if tag is not None and tag != f"v{m['version']}":
        raise ValueError('tag must equal v + project.json version (not the upstream version)')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    stem = f"solidcraft-ipad-{m['version']}"
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f'{stem}.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        entries = {p.relative_to(root).as_posix(): p.read_bytes() for p in distribution_files(root)}
        entries['RELEASE.json'] = (json.dumps({'version': m['version'], 'source_commit': commit, 'upstream': m['upstream']}, indent=2) + '\n').encode()
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(f'{stem}/{name}', date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, data)
    (output / 'SHA256SUMS.txt').write_text(f'{sha(archive.read_bytes())}  {archive.name}\n')
    changes = (root / 'CHANGELOG.md').read_text(encoding='utf-8').split(f"## [{m['version']}]", 1)[1].split('\n## [', 1)[0]
    notes = (f"# SolidCraft iPad {m['version']} (unofficial)\n\n"
             f"Based on SolidCraft {m['upstream']['version']} at `{m['upstream']['commit']}`.\n"
             f"iPad source commit: `{commit}`. No affiliation with or endorsement by Tangency Labs or Apple.\n\n"
             "ZIP includes both project licences, upstream NOTICE, third-party/font licences, provenance and modification records.\n\n"
             f"## Changes\n{changes.split(chr(10), 1)[-1]}\n"
             "## Validation\nAutomated distribution checks passed. Real iPad/Pencil testing must be recorded by the maintainer before publishing this draft.\n")
    (output / 'release-notes.md').write_text(notes, encoding='utf-8')
    return archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'check', 'verify-upstream', 'package'])
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    parser.add_argument('--tag')
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        if args.command == 'prepare':
            prepare(root)
        elif args.command == 'check':
            verify_local(root)
        elif args.command == 'verify-upstream':
            verify_local(root)
            if args.archive is None:
                parser.error('verify-upstream requires --archive (download the pinned URL in project.json)')
            verify_archive(root, args.archive)
            commit = metadata(root)['upstream']['commit']
            for name in ['ATTRIBUTION.md', 'DISCLAIMER.md']:
                url = f'https://raw.githubusercontent.com/tangency-labs/solidcraft/{commit}/{name}'
                with urllib.request.urlopen(url, timeout=30) as response:
                    if response.read() != (root / 'legal/upstream' / name).read_bytes():
                        raise ValueError(f'upstream source notice differs: {name}')
        elif args.command == 'package':
            if subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=root).strip():
                raise ValueError('commit all distribution changes before packaging; release provenance requires a clean tree')
            print(package(root, args.output, args.tag))
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, subprocess.CalledProcessError) as e:
        print(f'release: {e}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
