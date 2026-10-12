"""Loopback-only preview with persistent manual supplier imports."""
import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote, parse_qs
from registry_store import Registry, ROOT

class Handler(BaseHTTPRequestHandler):
    registry = Registry()
    def send(self, status, body, content_type='application/json; charset=utf-8'):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(body)

    def host_valid(self):
        port = self.server.server_port
        return self.headers.get('Host') in {f'127.0.0.1:{port}', f'localhost:{port}'}

    def do_GET(self):
        if not self.host_valid():
            return self.send(403, {'error': '仅允许本机访问'})
        parsed = urlsplit(self.path)
        if parsed.path == '/api/registry':
            return self.send(200, self.registry.snapshot())
        if parsed.path == '/api/source':
            try:
                identifier = parse_qs(parsed.query).get('id', [''])[0]
                return self.send(200, {'code': self.registry.source(identifier)})
            except ValueError as e:
                return self.send(400, {'error': str(e)})
        path = unquote(parsed.path)
        if path == '/':
            path = '/stage0-prototype/index.html'
        if path.endswith('/'):
            path += 'index.html'
        target = (ROOT / path.lstrip('/')).resolve()
        if not target.is_relative_to(ROOT) or path.split('/')[1] not in {'stage0-prototype', 'ui-toolkit'}:
            return self.send(404, {'error': '页面不存在'})
        # Only public UI files; exclude scripts, Skills, licenses and registry internals.
        relative = target.relative_to(ROOT).as_posix()
        public = relative.startswith(('stage0-prototype/', 'ui-toolkit/preview/', 'ui-toolkit/assets/', 'ui-toolkit/vendor/', 'ui-toolkit/materials/')) or relative in {'ui-toolkit/tokens.css', 'ui-toolkit/components.css', 'ui-toolkit/components.js'}
        if not public or not target.is_file() or target.suffix not in {'.html', '.js', '.css', '.woff2', '.svg', '.txt', '.json', '.jpeg', '.jpg', '.png', '.webp'}:
            return self.send(404, {'error': '页面不存在'})
        content_type = mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
        if relative.startswith('ui-toolkit/materials/'):
            content_type = 'text/plain; charset=utf-8'
        elif target.suffix == '.js':
            content_type = 'text/javascript; charset=utf-8'
        return self.send(200, target.read_bytes(), content_type)

    def do_POST(self):
        origin = self.headers.get('Origin')
        if not self.host_valid() or origin != 'http://' + self.headers.get('Host', ''):
            return self.send(403, {'error': '保存操作仅允许从本机工具页面发起'})
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.send(415, {'error': '需要 JSON 数据'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 150000:
                raise ValueError('提交内容过大或为空')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('提交格式无效')
            routes = {'/api/providers': self.registry.add_provider, '/api/providers/status': self.registry.set_status, '/api/materials': self.registry.add_material}
            action = routes.get(self.path)
            if action is None:
                return self.send(404, {'error': '操作不存在'})
            return self.send(200, action(data))
        except (ValueError, TypeError, KeyError) as e:
            return self.send(400, {'error': str(e)})
        except OSError:
            return self.send(500, {'error': '文件未能保存，请检查本地目录权限'})

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Lexicon: http://127.0.0.1:{args.port}/stage0-prototype/\nUI toolkit: http://127.0.0.1:{args.port}/ui-toolkit/preview/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
