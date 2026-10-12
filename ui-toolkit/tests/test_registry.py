import json
import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from registry_store import Registry, https_url

class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.scratch = Path(__file__).resolve().parent / '.scratch'
        self.scratch.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.scratch)
        self.root = Path(self.temp.name)
        folder = self.root / 'ui-toolkit' / 'registry'
        folder.mkdir(parents=True)
        for kind in ('providers', 'materials'):
            (folder / f'{kind}.json').write_text(json.dumps({kind: []}), encoding='utf-8')
        self.registry = Registry(self.root)
        self.provider = self.registry.add_provider({'name':'Test library', 'homepage':'https://example.com', 'category':'other'})

    def tearDown(self):
        assert self.root.resolve().is_relative_to(self.scratch.resolve())
        self.temp.cleanup()

    def material(self, **changes):
        data = {'providerId': self.provider['id'], 'name': 'Test button', 'author':'Test author',
                'sourceUrl':'https://example.com/button', 'category':'button', 'code':'<button>Example</button>', 'license':'unknown'}
        data.update(changes)
        return data

    def test_add_supplier_and_material_survive_reopen(self):
        row = self.registry.add_material(self.material())
        reopened = Registry(self.root)
        self.assertEqual(reopened.read('providers')[0]['name'], 'Test library')
        self.assertEqual(reopened.source(row['id']), '<button>Example</button>')
        self.assertEqual(reopened.validate(), {'providers': 1, 'materials': 1})

    def test_pause_blocks_import_but_preserves_snapshot(self):
        row = self.registry.add_material(self.material())
        self.registry.set_status({'id':self.provider['id'], 'status':'paused'})
        with self.assertRaises(ValueError):
            self.registry.add_material(self.material(sourceUrl='https://example.com/new'))
        self.assertEqual(self.registry.source(row['id']), '<button>Example</button>')
        self.assertEqual(Registry(self.root).read('providers')[0]['status'], 'paused')

    def test_source_requires_exact_registered_host(self):
        for url in ['https://example.com.evil.org/button', 'https://cdn.example.com/button', 'http://example.com/button', 'https://user:secret@example.com/button']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                self.registry.add_material(self.material(sourceUrl=url))
        self.assertEqual(self.registry.read('materials'), [])

    def test_untrusted_code_stays_plain_snapshot(self):
        code = '<script>window.pwned=true</script><button onclick="alert(1)">X</button>'
        row = self.registry.add_material(self.material(code=code))
        self.assertEqual(row['status'], 'candidate')
        self.assertEqual(row['licenseStatus'], 'unverified')
        self.assertEqual(self.registry.source(row['id']), code)
        self.assertEqual(row['adaptedFiles'], [])

    def test_no_browser_controlled_file_paths(self):
        row = self.registry.add_material(self.material(sourceFiles=['../../outside.txt'], id='../../outside'))
        self.assertTrue(row['sourceFiles'][0].startswith('ui-toolkit/materials/material-'))
        for path in ['../outside.txt', 'C:/outside.txt', 'ui-toolkit/../../outside.txt', 'ui-toolkit\\secret.txt']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.registry.path(path)

    def test_hash_tampering_is_detected(self):
        row = self.registry.add_material(self.material())
        self.registry.path(row['sourceFiles'][0]).write_text('changed', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '哈希'):
            self.registry.validate()

    def test_duplicate_and_invalid_values_do_not_mutate(self):
        self.registry.add_material(self.material())
        changes = [{}, {'category':'bad'}, {'code':'x'*65537}, {'license':'MIT','licenseEvidence':''}, {'licenseEvidence':123}]
        for index, change in enumerate(changes):
            if index:
                change['sourceUrl'] = f'https://example.com/invalid-{index}'
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.registry.add_material(self.material(**change))
        with self.assertRaises(ValueError):
            self.registry.add_provider({'name':'Duplicate','homepage':'https://example.com/path'})
        self.assertEqual(len(self.registry.read('providers')), 1)
        self.assertEqual(len(self.registry.read('materials')), 1)

    def test_unknown_license_cannot_be_verified(self):
        self.registry.add_material(self.material())
        rows = self.registry.read('materials')
        rows[0]['status'] = 'verified'
        rows[0]['adaptedFiles'] = rows[0]['sourceFiles']
        rows[0]['usedIn'] = ['Test']
        rows[0]['verification'] = ['Test passed']
        self.registry.write('materials', rows)
        with self.assertRaises(ValueError):
            self.registry.validate()

    def test_bad_https_urls_rejected(self):
        for url in ['https://example.com:8080', 'javascript:alert(1)', 'https://example.com:bad', 'https://a..b', '//example.com']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                https_url(url)

if __name__ == '__main__':
    unittest.main()
