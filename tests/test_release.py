# SPDX-License-Identifier: MIT OR Apache-2.0
import importlib.util
import json
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('release', Path(__file__).parents[1] / 'scripts/release.py')
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def test_checked_in_distribution_is_consistent(self):
        self.assertIsNotNone(release.SEMVER.fullmatch(release.verify_local(release.ROOT)['version']))

    def test_versions_are_semver_and_do_not_accept_ambiguous_numbers(self):
        for version in ['0.1.0', '1.2.3', '0.2.0-rc.1']:
            self.assertIsNotNone(release.SEMVER.fullmatch(version))
        for version in ['3.6', '01.2.3', '0.1.0-01', 'v0.1.0', '0.1.0+different']:
            self.assertIsNone(release.SEMVER.fullmatch(version))

    def test_distribution_path_rejects_traversal_and_symlinks(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in ['/etc/passwd', '../outside', 'a/../../outside', 'a\\b']:
                with self.assertRaises(ValueError):
                    release.safe_path(root, name)
            (root / 'link').symlink_to('/etc/passwd')
            with self.assertRaises(ValueError):
                release.safe_path(root, 'link')

    def test_changed_served_file_is_rejected_until_prepared(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for p in release.distribution_files(release.ROOT):
                q = root / p.relative_to(release.ROOT)
                q.parent.mkdir(parents=True, exist_ok=True)
                # Isolate changed files while sharing the read-only large runtime payload.
                if p.suffix == '.bin':
                    import os
                    os.link(p, q)
                else:
                    shutil.copy2(p, q)
            (root / 'touch-nav.js').write_text((root / 'touch-nav.js').read_text() + '\n// test change\n')
            with self.assertRaisesRegex(ValueError, 'stale'):
                release.verify_local(root)
            release.prepare(root)
            release.verify_local(root)
            # No upstream runtime change may be passed off as the official release.
            script = next(root.glob('solidcraft-web-*.js'))
            script.write_text(script.read_text() + '\n// changed binding\n')
            release.prepare(root)
            with self.assertRaisesRegex(ValueError, 'upstream file changed'):
                release.verify_local(root)

    def test_release_is_reproducible_and_contains_notices_and_provenance(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            meta = release.metadata(release.ROOT)
            version = meta['version']
            a = release.package(release.ROOT, root / 'a', 'v' + version)
            b = release.package(release.ROOT, root / 'b', 'v' + version)
            self.assertEqual(release.sha(a.read_bytes()), release.sha(b.read_bytes()))
            with zipfile.ZipFile(a) as z:
                prefix = f'solidcraft-ipad-{version}/'
                for name in release.REQUIRED:
                    self.assertIn(prefix + name, z.namelist())
                for name in ['LICENSE-MIT', 'LICENSE-APACHE', 'NOTICE', 'THIRD-PARTY-LICENSES.txt']:
                    self.assertEqual(z.read(prefix + name), (release.ROOT / name).read_bytes())
                metadata = json.loads(z.read(prefix + 'RELEASE.json'))
                self.assertEqual(metadata['upstream']['version'], meta['upstream']['version'])
                self.assertRegex(metadata['source_commit'], r'^[a-f0-9]{40}$')
                self.assertFalse(any('/.git/' in name or '/dist/' in name or '.pyc' in name for name in z.namelist()))
            with self.assertRaisesRegex(ValueError, 'tag must equal'):
                release.package(release.ROOT, root / 'bad', 'v99.99.99')

    def test_diagnostics_need_explicit_opt_in(self):
        script = (release.ROOT / 'touch-nav.js').read_text()
        self.assertIn('query.get("senddiagnostics") === "1" &&', script)
        self.assertNotIn('const VERSION = "3.6"', script)


if __name__ == '__main__':
    unittest.main()
