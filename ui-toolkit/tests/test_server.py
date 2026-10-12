import http.client
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from registry_store import Registry
from serve import Handler, ThreadingHTTPServer

class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = Path(__file__).resolve().parent / '.scratch'
        cls.scratch.mkdir(exist_ok=True)
        cls.temp = tempfile.TemporaryDirectory(dir=cls.scratch)
        cls.root = Path(cls.temp.name).resolve()
        folder = cls.root / 'ui-toolkit' / 'registry'
        folder.mkdir(parents=True)
        for kind in ('providers', 'materials'):
            (folder / f'{kind}.json').write_text(json.dumps({kind: []}), encoding='utf-8')
        class TestHandler(Handler):
            registry = Registry(cls.root)
            def log_message(self, *args):
                pass
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), TestHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(2)
        assert cls.root.is_relative_to(cls.scratch.resolve())
        cls.temp.cleanup()

    def request(self, path, data=None, **headers):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=4)
        host = f'127.0.0.1:{self.port}'
        defaults = {'Host': host, 'Origin': 'http://' + host, 'Content-Type': 'application/json'}
        defaults.update(headers)
        connection.request('POST' if data is not None else 'GET', path, json.dumps(data) if data is not None else None, defaults)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def test_cross_origin_and_untrusted_host_cannot_write(self):
        data = {'name':'Blocked', 'homepage':'https://blocked.example.com'}
        for headers in [{'Origin':'https://evil.example.com'}, {'Origin':''}, {'Host':'evil.example.com'}]:
            with self.subTest(headers=headers):
                self.assertEqual(self.request('/api/providers', data, **headers)[0], 403)
        self.assertEqual(self.request('/api/providers', data, **{'Content-Type':'text/plain'})[0], 415)

    def test_valid_api_import_and_reopen(self):
        status, _, body = self.request('/api/providers', {'name':'API test', 'homepage':'https://api.example.com'})
        self.assertEqual(status, 200)
        provider = json.loads(body)
        status, _, body = self.request('/api/materials', {'providerId':provider['id'], 'sourceUrl':'https://api.example.com/button', 'name':'API button', 'author':'Test', 'category':'button', 'code':'<script>bad()</script>'})
        self.assertEqual(status, 200)
        material = json.loads(body)
        status, _, source = self.request('/api/source?id=' + material['id'])
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(source)['code'], '<script>bad()</script>')
        self.assertEqual(Registry(self.root).read('materials')[0]['status'], 'candidate')

    def test_private_paths_and_traversal_not_served(self):
        for path in ['/.agents/skills/lexicon-ui/SKILL.md', '/ui-toolkit/scripts/serve.py', '/ui-toolkit/../build_proposal.py', '/stage0-prototype/%2e%2e/build_proposal.py', '/ui-toolkit/registry/providers.json']:
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)

    def test_original_html_served_as_text(self):
        status, headers, body = self.request('/ui-toolkit/materials/uiverse-button-popular-ladybug-27/original.html')
        self.assertEqual(status, 200)
        self.assertTrue(headers['Content-Type'].startswith('text/plain'))
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertIn(b'<button', body)

    def test_public_ui_and_local_only_policy(self):
        for path in ['/stage0-prototype/', '/ui-toolkit/preview/', '/ui-toolkit/components.js', '/ui-toolkit/assets/fonts/inter-latin-400-normal.woff2']:
            with self.subTest(path=path):
                status, headers, _ = self.request(path)
                self.assertEqual(status, 200)
                self.assertIn("connect-src 'self'", headers['Content-Security-Policy'])

    def test_dictionary_scan_image_is_served_with_image_type(self):
        status, headers, body = self.request('/stage0-prototype/assets/dictionary-pages/page-001.jpeg')
        self.assertEqual(status, 200)
        self.assertEqual(headers['Content-Type'], 'image/jpeg')
        self.assertTrue(body.startswith(b'\xff\xd8'))

if __name__ == '__main__':
    unittest.main()
