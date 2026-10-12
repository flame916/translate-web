"""Archive only the known disposable browser fixture and record completed checks."""
import json
from registry_store import Registry, stamp

registry = Registry()
data = registry.snapshot()
fixture_providers = [p for p in data['providers'] if p['name'] == '扩展验收网站' and p['homepage'] == 'https://example.com']
fixture_ids = {p['id'] for p in fixture_providers}
fixtures = [m for m in data['materials'] if m['providerId'] in fixture_ids and m['name'] == '扩展验收素材' and m['sourceUrl'] == 'https://example.com/lexicon-ui-acceptance']
if any(m['providerId'] in fixture_ids and m not in fixtures for m in data['materials']):
    raise ValueError('Fixture provider has additional materials; leave it intact')
if fixture_providers:
    archive = registry.root / 'output/ui/extension-acceptance.json'
    archive.parent.mkdir(parents=True, exist_ok=True)
    archive.write_text(json.dumps({'checkedAt': stamp(), 'providers': fixture_providers, 'materials': fixtures,
                                   'checks': ['browser form persisted new supplier and material', 'wrong source host rejected', 'raw script displayed as text', 'pause survived reload', 'adopted components worked with supplier paused']}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    registry.write('materials', [m for m in data['materials'] if m not in fixtures])
    registry.write('providers', [p for p in data['providers'] if p['id'] not in fixture_ids])
    for material in fixtures:
        for relative in material['sourceFiles']:
            path = registry.path(relative)
            assert path.is_relative_to(registry.root / 'ui-toolkit/materials') and path.name == 'original.txt'
            path.unlink()
            path.parent.rmdir()
rows = registry.read('materials')
for row in rows:
    if row['status'] == 'adapted' and row['id'] in {'uiverse-button-popular-ladybug-27', 'uiverse-input-proud-husky-84', 'uiverse-loader-ugly-skunk-66'}:
        row['status'] = 'verified'
        row['verifiedAt'] = stamp()
        row['verification'] = [
            '2026-10-08 浏览器：默认、加载、禁用、错误、成功和空白组件状态通过',
            '2026-10-08 阅读台与预览：1440/1024/768/390px，无横向溢出',
            '2026-10-08 键盘：浮窗焦点循环/恢复、开关空格操作；减少动效预览关闭动画',
            '2026-10-08 本机服务与素材库 14 项测试通过；详情 docs/ui/UI工具实施与验收记录.md'
        ]
registry.write('materials', rows)
print(registry.validate())
