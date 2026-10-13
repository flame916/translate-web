# 英语词源典故词典翻译台 · 本地测试版

这是一个本地浏览器测试版：基础常用译法与导入词典释义分开展示。基础译法库首批收录常见问候语；词典已核对词条与自动整理候选分别标注，原书依据可按需展开。目前没有连接可生成整句译文的翻译引擎，未收录内容会明确提示。

## 运行

在本目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ../ui-toolkit/start.ps1
```

然后打开 <http://127.0.0.1:4173/stage0-prototype/>。也可双击 `../ui-toolkit/启动UI工具.cmd`。此服务同时提供共享组件预览和本地素材库管理。

## 当前界面与内容范围

- 分层翻译工作台：基础常用译法与导入词典释义分开显示；出处和原书页面按需展开
- 全书本地索引：两本词典共 1,076 页，可搜索页面文字并逐页浏览；《英汉词典》另导入约 1.7 万条自动整理词头，可直接检索候选原书释义
- 原书核对：页面命中可跳转对应来源页；扫描顺序与书内印刷页码分开标记
- 快捷翻译：支持 Ctrl/Command + K，展示译义和词典出处
- 收藏与最近查询：本机浏览器保存收藏和最多 20 条查询记录
- 书目：庄和诚、庄艳编《英语词源典故词典》；非常英语词典编写组《英汉词典（缩印本）》
- 多词典：通过独立书目目录新增内容，选择全部词典同时查询，或指定一本；同词的不同释义保留各自出处
- 接入方法：参见 `../docs/dictionary/新增词典与多词典使用说明.md`，含原始文件处理方式和统一内容包模板
- 自动整理的英汉词典词条和未校对全文命中均明确标为待核对，不会直接作为已确认译义；词源典故词典使用 OCR 文本，英汉词典使用 PDF 文字层提取，原书页可逐页核对

## 结构

- `index.html`：主窗口骨架与快捷翻译浮窗容器
- `styles.css`：翻译台布局，共享 `../ui-toolkit/tokens.css` 与 `components.css`
- `src/adapters.js`：全书 OCR 搜索、已核对词条、收藏与记录适配器
- `src/desktop-bridge.js`：Tauri 原生命令边界与浏览器回退实现
- `desktop/schema.sql`：SQLite MVP 表结构草案
- `desktop/README.md`：Tauri 接入顺序与命令契约
- `src/app.js`：译义优先展示、词典依据折叠查看、全书阅读交互
- `src/basic-translation.js`：内置常用问候语基础译法，与导入词典义项分层呈现
- `assets/dictionary-index.json`：英语词源典故词典的 484 页 OCR 搜索索引
- `assets/dictionaries/english-chinese-dictionary-2005/`：2005 版《英汉词典》的 592 页全文、页面图与书目信息
- `assets/dictionary-library.json`：词典目录，记录独立书目、作者、路径、启用状态和展示顺序
- `src/dictionary-library.js`：跨词典查询、来源归属和原书分页
- `../tools/import_dictionary.py`：新增词典内容包、备份后追加已有词典词条
- `../tools/structure_imported_dictionary.py`：从已导入的 PDF 文字层生成词头候选；生成内容默认未校对
- `assets/dictionary-pages/`：从用户提供 DOCX 按正文顺序抽取的 484 张原图
- `../docs/dictionary/英语词源典故词典_全书OCR稿.md`：完整 Markdown 转写，逐页链接原图
- `../ui-toolkit/README.md`：素材扩展与组件工作流

## 下一步

1. 从 OCR 文本中逐词条结构化抽取词头、词性、释义、词源、典故与印刷页码，并人工校对。
2. 明确整句翻译范围；若需要句子级译文，接入并标记具体翻译引擎，词典仍用于术语依据和优先匹配。
3. 安装 Rust/Tauri 后，按 `desktop/README.md` 将 `desktop-bridge.js` 映射为 Tauri command，并接入系统级快捷翻译。

