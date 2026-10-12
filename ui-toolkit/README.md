# Lexicon UI 工具

统一词源翻译项目的界面、共享组件和素材供给。当前原型使用原生 HTML/CSS/JavaScript，保留现有技术结构。

## 打开工具

双击本目录的 `启动UI工具.cmd`，保持服务窗口打开，然后访问：

- 阅读台：http://127.0.0.1:4173/stage0-prototype/
- UI 工具：http://127.0.0.1:4173/ui-toolkit/preview/

启动器优先使用 Codex 提供的 Python，备用环境需要 Python 3.10 或更高版本。也可在项目根目录运行 `python ui-toolkit/scripts/serve.py`。端口冲突时，可运行 `powershell -File ui-toolkit/start.ps1 -Port 4174`。

## 使用方式

1. **组件预览**：查看按钮、输入框、加载器、状态、开关和词源卡片；切换组件区域宽度、减少动效和默认、加载、禁用、错误、成功、空白状态。
2. **素材与来源 → 添加网站**：填写名称、HTTPS 首页和素材范围。新网站使用通用手动导入方式，无须修改翻译页面。
3. **导入候选素材**：选择已启用的网站，填写素材网址、作者、类型、许可依据并粘贴 HTML/CSS，也可读取本机 HTML/CSS/TXT 文件。代码保存为本地文本快照，不会在预览中执行。
4. 候选素材经许可复核、样式适配和界面检查后，由维护者接入共享组件并更新清单。页面中填写许可只代表声明，尚未视作核验完成。
5. 暂停网站后停止接收新素材，已适配组件继续本地使用。可导出清单备份。

网站和素材保存在项目的 JSON 清单与素材目录中；翻译记录和固定术语保存在当前浏览器中，两者独立。

## 已下载和整合

| 资源 | 当前使用 |
| --- | --- |
| `lexicon-ui` 项目 Skill | `.agents/skills/lexicon-ui`，约束原生组件、阅读层级和素材流程 |
| 官方 shadcn Skill | `.agents/skills/shadcn`，未来存在兼容配置时采用 |
| Radix Colors 3.0.0 | 本地 Gray/Bronze/Green/Red 色阶，统一语义配色 |
| Fontsource Inter 5.3.0 | 本地 Latin 400/600 WOFF2；中文使用系统字体 |
| Uiverse / 官方 Galaxy | 6 份原始快照；按钮、输入框和加载器经过适配 |
| 项目原创组件 | SVG 图标、开关、词源卡片、浮窗焦点管理和提示 |

第一篇笔记提到的 Rough.js、Mermaid、Simple Icons、README Stats 和 Markdown Badges 按用途保留为后续选择，当前阅读台没有相应需求。没有将普通组件库伪装成 Skill，也没有为接入 shadcn 强制迁移到 React。

已安装 Skill 会在后续对话重新发现时可用。使用 `$lexicon-ui` 可明确调用项目 UI 工作流。项目 Skill 的可编辑源位于 `skill/lexicon-ui/`；修改后同步到 `.agents/skills/lexicon-ui/`。

## 文件分工

- `tokens.css`：语义颜色、本地字体与减少动效规则。
- `components.css` / `components.js`：共享控件、原创图标、加载提示、通知与浮窗逻辑。
- `preview/`：组件状态预览、网站登记、候选素材导入与清单导出。
- `registry/providers.json`：供应网站及启用状态。
- `registry/materials.json`：来源、作者、许可、快照哈希、适配和验证记录。
- `registry/resources.lock.json`：下载版本、固定提交与文件哈希。
- `materials/`：不可直接执行的原始素材快照。
- `licenses/`：下载时保留的许可文件。原始代码署名与来源页发布者不同的情况，两者均保留。
- `scripts/registry.py validate`：检查清单、文件和哈希。
- `tests/`：素材持久化、暂停来源、域名约束、许可状态、原始代码隔离和本机服务校验。

服务只绑定 `127.0.0.1`，页面运行资源都在本地；新增网站不会触发远程抓取。若未来需要自动供应适配器，应单独定义目标站点的 API/抓取范围、认证方式、格式和更新策略，并继续将外部代码保持为候选数据。

## 验证

在项目根目录运行：

```text
python ui-toolkit/scripts/registry.py validate
python -m unittest discover -s ui-toolkit/tests -v
```

界面验收记录与截图位于 `docs/ui/UI工具实施与验收记录.md` 和 `output/ui/`。

本次可恢复的源代码快照为 `output/ui/lexicon-ui-v0.1.0.zip`，包含 UI 工具、阅读原型、两套 Skill、来源清单与许可。后续更新前应先保存独立版本快照，并重新检查受影响的组件。

翻译仍使用模拟适配器，真实翻译服务和真实词源出处核验是后续独立工作。
