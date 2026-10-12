"""Local supplier registry; imported snippets are stored as text, never executed."""
import hashlib
import json
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
CATEGORIES = {'button', 'input', 'loader', 'switch', 'card', 'other'}
ID = re.compile(r'^[a-z][a-z0-9-]{0,63}$')

def stamp():
    return datetime.now(timezone.utc).isoformat()

def https_url(value):
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError('请填写有效的 HTTPS 网址')
    parsed = urlsplit(value)
    try:
        port = parsed.port
    except ValueError:
        raise ValueError('网址端口无效') from None
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or port not in (None, 443):
        raise ValueError('网址须使用 HTTPS，且不能包含登录信息或特殊端口')
    host = parsed.hostname.lower()
    if not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', host) or '..' in host:
        raise ValueError('网站域名无效')
    return host

def field(data, key, limit=160):
    value = data.get(key, '')
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise ValueError(f'{key} 内容为空或过长')
    return value.strip()

class Registry:
    def __init__(self, root=ROOT):
        self.root = Path(root).resolve()
        self.folder = self.root / 'ui-toolkit' / 'registry'
        self.lock = threading.RLock()

    def read(self, kind):
        with self.lock:
            return json.loads((self.folder / f'{kind}.json').read_text(encoding='utf-8'))[kind]

    def write(self, kind, rows):
        target = self.folder / f'{kind}.json'
        temp = target.with_suffix('.tmp')
        temp.write_text(json.dumps({'schemaVersion': 1, kind: rows}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        temp.replace(target)

    def path(self, relative):
        if not isinstance(relative, str) or '\\' in relative:
            raise ValueError('文件路径无效')
        target = (self.root / relative).resolve()
        if not target.is_relative_to(self.root / 'ui-toolkit'):
            raise ValueError('文件须位于本地 UI 工具目录')
        return target

    def snapshot(self):
        with self.lock:
            return {'providers': self.read('providers'), 'materials': self.read('materials')}

    def add_provider(self, data):
        with self.lock:
            rows = self.read('providers')
            name = field(data, 'name', 80)
            homepage = field(data, 'homepage', 2048)
            host = https_url(homepage)
            if any(https_url(p['homepage']) == host for p in rows):
                raise ValueError('这个网站已经存在')
            category = data.get('category', 'other')
            if category not in CATEGORIES:
                raise ValueError('素材类型无效')
            row = {'id': 'site-' + uuid.uuid4().hex[:12], 'name': name, 'homepage': homepage,
                   'allowedHosts': [host], 'categories': sorted(CATEGORIES) if category == 'other' else [category],
                   'formats': ['html-css'], 'acquisition': 'manual', 'adapterId': 'manual-v1',
                   'status': 'active', 'licensePolicy': '逐条确认许可，未确认素材保留为候选', 'createdAt': stamp()}
            self.write('providers', rows + [row])
            return row

    def set_status(self, data):
        with self.lock:
            rows = self.read('providers')
            status = data.get('status')
            if status not in {'active', 'paused'}:
                raise ValueError('网站状态无效')
            row = next((p for p in rows if p['id'] == data.get('id')), None)
            if row is None:
                raise ValueError('网站不存在')
            row['status'] = status
            row['updatedAt'] = stamp()
            self.write('providers', rows)
            return row

    def add_material(self, data):
        with self.lock:
            provider = next((p for p in self.read('providers') if p['id'] == data.get('providerId')), None)
            if provider is None or provider['status'] != 'active':
                raise ValueError('请先启用素材网站')
            source = field(data, 'sourceUrl', 2048)
            if https_url(source) not in provider['allowedHosts']:
                raise ValueError('素材网址须属于所选网站；子域名需要单独登记')
            category = data.get('category', 'other')
            if category not in provider['categories']:
                raise ValueError('素材类型不在这个网站的供给范围内')
            name = field(data, 'name', 100)
            author = field(data, 'author', 100)
            code = field(data, 'code', 65536)
            if len(code.encode('utf-8')) > 65536:
                raise ValueError('单份素材最多 64 KB')
            rows = self.read('materials')
            if any(m['sourceUrl'] == source for m in rows):
                raise ValueError('这份素材已经收录')
            license_name = data.get('license', 'unknown')
            if license_name not in {'unknown', 'MIT', 'CC0', 'Apache-2.0', 'custom'}:
                raise ValueError('许可类型无效')
            evidence = data.get('licenseEvidence', '')
            if not isinstance(evidence, str):
                raise ValueError('许可说明网址无效')
            evidence = evidence.strip()
            if license_name != 'unknown':
                https_url(evidence)
            elif evidence:
                https_url(evidence)
            identifier = 'material-' + uuid.uuid4().hex[:12]
            relative = f'ui-toolkit/materials/{identifier}/original.txt'
            target = self.path(relative)
            target.parent.mkdir(parents=True, exist_ok=False)
            raw = code.encode('utf-8')
            target.write_bytes(raw)
            row = {'id': identifier, 'providerId': provider['id'], 'name': name, 'sourceUrl': source,
                   'author': author, 'category': category, 'format': 'html-css', 'status': 'candidate',
                   'license': license_name, 'licenseStatus': 'unverified' if license_name == 'unknown' else 'declared',
                   'licenseEvidence': evidence, 'retrievedAt': stamp(), 'version': 'manual-' + stamp(),
                   'contentHash': hashlib.sha256(raw).hexdigest(), 'sourceFiles': [relative],
                   'adaptedFiles': [], 'usedIn': [], 'verification': []}
            try:
                self.write('materials', rows + [row])
            except Exception:
                target.unlink()
                target.parent.rmdir()
                raise
            return row

    def source(self, identifier):
        row = next((m for m in self.read('materials') if m['id'] == identifier), None)
        if not row:
            raise ValueError('素材不存在')
        return self.path(row['sourceFiles'][0]).read_text(encoding='utf-8')

    def validate(self):
        data = self.snapshot()
        providers = {p['id']: p for p in data['providers']}
        if len(providers) != len(data['providers']):
            raise ValueError('网站标识重复')
        ids = set()
        for provider in providers.values():
            if not ID.fullmatch(provider['id']) or provider['status'] not in {'active', 'paused'}:
                raise ValueError('网站标识或状态无效')
            if https_url(provider['homepage']) not in provider['allowedHosts']:
                raise ValueError('网站域名登记不一致')
        for material in data['materials']:
            if material['id'] in ids or not ID.fullmatch(material['id']):
                raise ValueError('素材标识重复或无效')
            ids.add(material['id'])
            provider = providers.get(material['providerId'])
            if not provider or https_url(material['sourceUrl']) not in provider['allowedHosts']:
                raise ValueError('素材来源与网站不匹配')
            if material['status'] not in {'candidate', 'adapted', 'verified', 'retired'}:
                raise ValueError('素材状态无效')
            for relative in material['sourceFiles'] + material.get('adaptedFiles', []):
                if not self.path(relative).is_file():
                    raise ValueError('素材文件缺失: ' + relative)
            raw = self.path(material['sourceFiles'][0]).read_bytes()
            if hashlib.sha256(raw).hexdigest() != material['contentHash']:
                raise ValueError('素材快照哈希不匹配: ' + material['id'])
            if material['status'] in {'adapted', 'verified'}:
                if material['licenseStatus'] != 'confirmed' or not material.get('adaptedFiles') or not material.get('usedIn'):
                    raise ValueError('已适配素材缺少许可或使用记录')
                https_url(material['licenseEvidence'])
            if material['status'] == 'verified' and not material.get('verification'):
                raise ValueError('素材缺少验证记录')
        lock_file = self.folder / 'resources.lock.json'
        if lock_file.exists():
            lock = json.loads(lock_file.read_text(encoding='utf-8'))
            for resource in lock.get('resources', []):
                for item in resource.get('files', []):
                    target = (self.root / item['path']).resolve()
                    if not target.is_relative_to(self.root) or hashlib.sha256(target.read_bytes()).hexdigest() != item['sha256']:
                        raise ValueError('资源文件缺失或哈希不匹配: ' + item['path'])
        return {'providers': len(providers), 'materials': len(ids)}
