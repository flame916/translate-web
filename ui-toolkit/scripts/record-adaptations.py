"""Record reviewed adaptations without changing immutable downloaded snapshots."""
import re
from registry_store import Registry

registry = Registry()
rows = registry.read('materials')
adopted = {'uiverse-button-popular-ladybug-27', 'uiverse-input-proud-husky-84', 'uiverse-loader-ugly-skunk-66'}
for row in rows:
    source = registry.source(row['id'])
    credit = re.search(r'From Uiverse.io by ([\w-]+)', source)
    if credit:
        row['originalCredit'] = credit[1]
    if row['id'] in adopted:
        row['status'] = 'adapted'
        row['adaptedFiles'] = ['ui-toolkit/components.css', 'ui-toolkit/components.js']
        row['usedIn'] = ['stage0-prototype/index.html', 'ui-toolkit/preview/index.html']
        row['adaptationNote'] = {
            'button': '保留背景和文字过渡，移除发光、字距和装饰边线，补充禁用和加载状态。',
            'input': '保留圆角和偏移焦点环，替换为语义配色、弹性宽度和键盘可见焦点。',
            'loader': '保留虚线圆环旋转，移除手机外框和摇晃，使用相对尺寸并支持减少动效。'
        }[row['category']]
registry.write('materials', rows)
print('Recorded 3 adaptations; 3 candidates retained.')
