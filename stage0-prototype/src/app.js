import { desktopAdapter, dictionaryRepository, historyRepository, termRepository } from './adapters.js';
import { lookupBasicTranslations } from './basic-translation.js';
import { icon, mountIcons, setBusy, createToast, createModal } from '../../ui-toolkit/components.js';

const $ = selector => document.querySelector(selector);
const state = { view: 'library', query: '', showMatches: false, ...termRepository.list(), history: historyRepository.list(), currentMatches: [], pageHits: [], currentTranslation: '', readerPage: 10, indexReady: false };
const grid = $('#term-grid');
const showToast = createToast($('#toast'));
const quickModal = createModal($('#quick-overlay'), $('.app-shell'), $('#quick-input'));
const sourceModal = createModal($('#source-overlay'), $('.app-shell'), $('#source-close'));
mountIcons();

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function pageTextLabel(page) {
  return page?.textOrigin === 'pdf-text-layer' ? 'PDF文字层提取' : page?.textOrigin === 'human-transcription' ? '人工转写' : 'OCR识别';
}

function pageHitsLabel(hits) {
  if (!hits.length) return '词典页候选';
  const origins = new Set(hits.map(hit => hit.page.textOrigin || 'ocr'));
  return origins.size === 1 && origins.has('pdf-text-layer') ? 'PDF文字层候选' : origins.size === 1 && origins.has('ocr') ? 'OCR候选' : '全文候选';
}

function sourceButton(term, label = '查看原书第 ' + (term.page || '待核对') + ' 页') {
  if (!term.scanImage) return '<span>未附原图</span>';
  return `<button class="source-link" type="button" data-source-open="${escapeHtml(term.id)}">${icon('book')}<span>${escapeHtml(label)}</span></button>`;
}

function renderEntry(term, compact = false) {
  if (!term) return '';
  const phonetic = term.phonetic ? `<span class="term-phonetic">${escapeHtml(term.phonetic)}</span>` : '';
  const partOfSpeech = term.partOfSpeech ? `<span class="part-of-speech">${escapeHtml(term.partOfSpeech)}</span>` : '';
  const note = compact ? '' : `<div class="entry-explanation"><span class="field-label">词源与典故</span><p>${escapeHtml(term.note)}</p><div class="term-roots"><span class="root-chip">${escapeHtml(term.root)}</span><span>${escapeHtml(term.rootMeaning)}</span></div></div>`;
  return `<article class="lookup-entry"><div class="lookup-term-head"><div><h3>${escapeHtml(term.word)}</h3>${phonetic}</div>${partOfSpeech}</div><div class="definition-block"><span class="field-label">词典释义</span><p>${escapeHtml(term.meaning)}</p></div>${note}<div class="entry-source"><span>${escapeHtml(term.source)} · ${escapeHtml(term.author)} · 书内页码 ${escapeHtml(term.page || "待核对")}</span>${compact ? '' : sourceButton(term)}</div></article>`;
}

function renderCandidate(term, compact = false) {
  const origin = term.scanPage ? `扫描顺序第 ${term.scanPage} 页` : '原书页码待核对';
  return `<article class="lookup-entry pending-entry"><div class="lookup-term-head"><div><h3>${escapeHtml(term.word)}</h3></div><span class="term-status">原书词条 · 待校对</span></div><div class="definition-block"><span class="field-label">原书文字层摘录</span><p>${escapeHtml(term.meaning)}</p></div><div class="entry-source"><span>${escapeHtml(term.source)} · ${origin}</span>${term.scanPage ? `<button class="secondary-button" type="button" data-reader-open="${Number(term.scanPage)}" data-reader-dictionary="${escapeHtml(term.dictionaryId)}">核对原书页</button>` : ''}</div></article>`;
}

function renderTranslationSections(basicMatches, matches, candidates) {
  const basicSection = basicMatches.length
    ? `<section class="translation-output basic-translation"><span class="translation-mode">基础常用译法 · 内置词条</span>${basicMatches.map(entry => `<p><strong>${escapeHtml(entry.phrase)}</strong><span>${escapeHtml(entry.translation)}</span><small class="translation-citation">${escapeHtml(entry.usage)} · 暂不依赖原书核对</small></p>`).join('')}</section>`
    : '<section class="translation-output empty-translation"><span class="translation-mode">基础常用译法</span><p>目前的内置基础词条尚未收录这段内容。</p></section>';
  const dictionarySection = matches.length || candidates.length
    ? `<section class="translation-output dictionary-translation ${candidates.length ? 'tentative' : ''}"><span class="translation-mode">导入词典释义${candidates.length ? ' · 自动整理，待核对' : ' · 已核对词条'}</span>${matches.map(term => `<p><strong>${escapeHtml(term.word)}</strong><span>${escapeHtml(term.meaning)}</span><small class="translation-citation">已核对 · ${escapeHtml(term.source)}</small></p>`).join('')}${candidates.map(term => `<p><strong>${escapeHtml(term.word)}</strong><span>${escapeHtml(term.meaning)}</span><small class="translation-citation">自动整理摘录 · 尚未逐条核对 · ${escapeHtml(term.source)}</small></p>`).join('')}</section>`
    : '<section class="translation-output empty-translation"><span class="translation-mode">导入词典释义</span><p>当前查询没有匹配到词典词条；可稍后查看相关原书页面。</p></section>';
  return basicSection + dictionarySection;
}

function visibleTerms() {
  let terms = dictionaryRepository.list().filter(term => state.view !== 'pinned' || state.pinned.includes(term.id));
  if (state.showMatches && state.currentMatches.length) {
    const ids = new Set(state.currentMatches.map(term => term.id));
    terms = terms.filter(term => ids.has(term.id));
  }
  const query = state.query.trim().toLowerCase();
  if (query) terms = terms.filter(term => [term.word, term.meaning, term.root, term.rootMeaning, term.note, term.page].join(' ').toLowerCase().includes(query));
  else terms = terms.filter(term => term.reviewed);
  return terms;
}

function renderTerms() {
  const queryText = state.query.trim();
  if (queryText && state.indexReady && state.view === 'library') {
    const candidates = dictionaryRepository.lookupCandidates(queryText);
    const hits = dictionaryRepository.searchPages(queryText, 30);
    $('#result-count').textContent = `${candidates.length} 条原书词条 · ${hits.length} 张词典页命中`;
    const candidateHtml = candidates.map(term => renderCandidate(term, true)).join('');
    const hitHtml = hits.map(({ page, snippet }) => `<article class="ocr-search-card"><span class="term-domain">${pageTextLabel(page)} · 待逐条核对</span><h3>${escapeHtml(page.source)} · 扫描顺序第 ${page.scanPage} 页</h3><p>${escapeHtml(snippet)}</p><button class="secondary-button" type="button" data-reader-open="${page.scanPage}" data-reader-dictionary="${escapeHtml(page.dictionaryId)}">查看原书页面</button></article>`).join('');
    grid.innerHTML = candidateHtml + hitHtml || '<div class="empty-state">词典全文索引中没有检出这个查询。可换一个词继续搜索。</div>';
    grid.querySelectorAll('[data-reader-open]').forEach(button => button.addEventListener('click', () => showReaderPage(Number(button.dataset.readerOpen), button.dataset.readerDictionary)));
    return;
  }
  const terms = visibleTerms();
  $('#result-count').textContent = `${terms.length} 条${state.view === 'pinned' ? '收藏' : '词条'}`;
  grid.innerHTML = terms.length ? terms.map(term => {
    const pinned = state.pinned.includes(term.id);
    return `<article class="term-card"><div class="term-top"><span class="term-domain">词典词条<span class="term-status">${term.reviewed ? "已核对" : "待校对"}</span></span><button class="pin-button ${pinned ? 'pinned' : ''}" data-pin="${escapeHtml(term.id)}" aria-pressed="${pinned}" aria-label="${pinned ? '取消收藏' : '收藏'} ${escapeHtml(term.word)} · ${escapeHtml(term.source)}">${icon('pin')}</button></div><h3 class="term-word">${escapeHtml(term.word)}</h3>${term.phonetic ? `<span class="term-phonetic">${escapeHtml(term.phonetic)}</span>` : ''}<p class="term-meaning">${escapeHtml(term.meaning)}</p><details class="term-details"><summary>查看词源与用法依据</summary><div><p>${escapeHtml(term.note)}</p><div class="term-roots"><span class="root-chip">${escapeHtml(term.root)}</span><span>${escapeHtml(term.rootMeaning)}</span></div></div></details><div class="term-source"><span>${escapeHtml(term.source)} · 第 ${escapeHtml(term.page)} 页</span>${sourceButton(term, '核对原书页面')}</div></article>`;
  }).join('') : `<div class="empty-state">${state.view === 'pinned' && !state.pinned.length ? '还没有收藏词条。查询词典后，可在词条卡片右上角收藏。' : state.showMatches && !state.currentMatches.length ? '没有在当前已核对的样例中找到匹配词条。可在词典全文候选页中继续查证。' : '没有匹配的词条，可以换个词语或释义搜索。'}</div>`;
}

function renderHistory() {
  const query = state.query.trim().toLowerCase();
  const entries = state.history.filter(entry => [entry.sourceText, entry.domain, entry.provider].join(' ').toLowerCase().includes(query));
  $('#result-count').textContent = `${entries.length} 条记录`;
  grid.innerHTML = entries.length ? `<div class="history-list">${entries.map(entry => {
    const legacy = !entry.dictionaryIds && !entry.provider.includes('英语词源典故词典');
    const matched = Array.isArray(entry.matchedTerms) ? entry.matchedTerms.join('、') : '';
    return `<article class="history-item"><div><small>${escapeHtml(new Date(entry.createdAt).toLocaleString('zh-CN'))} · ${legacy ? '早期原型记录' : '词典查询'}</small><p>${escapeHtml(entry.sourceText)}</p><small>${legacy ? '此记录来自此前模拟流程，不是词典释义。' : matched ? `命中：${escapeHtml(matched)}` : '当前已核对样例中没有匹配。'}</small></div><span class="history-domain">${legacy ? '原型记录' : '本机查询'}</span></article>`;
  }).join('')}</div><button class="quiet-button history-clear" id="history-clear">清空本机记录</button>` : '<div class="empty-state">还没有查询记录。完成一次词典查询后，记录会保存在这个浏览器。</div>';
  $('#history-clear')?.addEventListener('click', () => {
    try { state.history = historyRepository.clear(); renderHistory(); showToast('本机记录已清空'); }
    catch { showToast('记录未能清空，请检查浏览器存储权限'); }
  });
}

function render() {
  if (state.view === 'history') renderHistory(); else renderTerms();
}

function resultFor(text, record = true, updateMain = true) {
  const basicMatches = lookupBasicTranslations(text);
  const matches = dictionaryRepository.lookup(text);
  const candidates = dictionaryRepository.lookupCandidates(text);
  const pageHits = dictionaryRepository.searchPages(text);
  if (!updateMain) {
    try {
      if (record) state.history = historyRepository.add({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), sourceText: text.slice(0, 240), provider: dictionaryRepository.selectedBooks().map(book => book.title).join('、') + ' · 本地测试译义', dictionaryIds: dictionaryRepository.selectedBooks().map(book => book.id), domain: '翻译查询', matchedTerms: matches.map(term => term.word) });
      if (state.view === 'history') renderHistory();
    } catch { showToast('查询完成，但本机记录未能保存'); }
    return { basicMatches, matches, candidates, pageHits };
  }
  state.lastText = text;
  state.currentMatches = matches;
  state.pageHits = pageHits;
  const copyableTerms = basicMatches.length ? basicMatches : [...matches, ...candidates];
  state.currentTranslation = basicMatches.length
    ? basicMatches.map(entry => entry.translation).join('\n')
    : copyableTerms.map(term => copyableTerms.length > 1 ? `${term.word}：${term.meaning}` : term.meaning).join('\n');
  state.showMatches = true;
  $('#main-insight').classList.remove('hidden');
  $('#match-count').textContent = `已核对释义 ${matches.length} 条 · 原书词条候选 ${candidates.length} 条 · ${pageHitsLabel(pageHits)} ${pageHits.length} 页`;
  $('#matched-terms').innerHTML = matches.map(term => `<button class="match-chip" type="button" data-select-term="${escapeHtml(term.id)}">${escapeHtml(term.word)}<small>${escapeHtml(term.source)} · 页码 ${escapeHtml(term.page || "待核对")}</small></button>`).join('');
  const translationHtml = renderTranslationSections(basicMatches, matches, candidates);
  const evidenceHtml = matches.length ? `<details class="translation-evidence"><summary>查看词典依据 · ${matches.length} 条</summary>${matches.map(term => renderEntry(term)).join('')}</details>` : '';
  const pageHtml = pageHits.map(({ page, snippet }) => `<article class="ocr-hit"><div><strong>${escapeHtml(page.source)} · 扫描顺序第 ${page.scanPage} 页</strong><span>${pageTextLabel(page)} · 尚未逐条校对</span><p>${escapeHtml(snippet)}</p></div><button class="secondary-button" type="button" data-reader-open="${page.scanPage}" data-reader-dictionary="${escapeHtml(page.dictionaryId)}">查看原页</button></article>`).join('');
  $('#section-title').textContent = state.view === 'pinned' ? '收藏的词条' : '词典查证与来源';
  $('#main-provider').textContent = basicMatches.length ? '基础译法 + 词典释义' : '基础译法库 + 词典作为来源';
  $('#main-result-note').textContent = basicMatches.length ? '复制时优先复制基础常用译法' : candidates.length ? '自动整理释义与基础译法分开展示' : '基础常用译法与词典释义分开展示';
  const candidateEvidence = candidates.length ? `<details class="translation-evidence"><summary>稍后核对原书摘录 · ${candidates.length} 条</summary>${candidates.map(term => renderCandidate(term)).join('')}</details>` : '';
  $('#main-result').innerHTML = `${translationHtml}${evidenceHtml}${candidateEvidence}${pageHits.length ? `<details class="translation-evidence ocr-evidence"><summary>稍后查看相关原书页面 · ${pageHits.length} 页</summary>${pageHtml}</details>` : ''}`;
  $('#main-copy').disabled = !copyableTerms.length;
  renderTerms();
  try {
    if (record) state.history = historyRepository.add({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), sourceText: text.slice(0, 240), provider: dictionaryRepository.selectedBooks().map(book => book.title).join('、') + ' · 本地测试译义', dictionaryIds: dictionaryRepository.selectedBooks().map(book => book.id), domain: '翻译查询', matchedTerms: matches.map(term => term.word) });
    if (state.view === 'history') renderHistory();
  } catch { showToast('查询完成，但本机记录未能保存'); }
  return { basicMatches, matches, candidates, pageHits };
}

async function lookupInto(input, result, button, isMain = false) {
  if (button.disabled) return;
  const text = input.value.trim();
  if (!text) { input.setAttribute('aria-invalid', 'true'); input.focus(); showToast('请输入要查询的英文'); return; }
  input.removeAttribute('aria-invalid');
  setBusy(button, true, '翻译', '翻译中…');
  result.setAttribute('aria-busy', 'true');
  if (isMain) {
    $('#main-clear').disabled = true;
    $('#main-clipboard').disabled = true;
    $('#main-provider').textContent = '正在匹配词典…';
    $('#main-result').textContent = '正在整理词典译义…';
  } else {
    result.textContent = '正在整理词典译义…';
  }
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    const { basicMatches, matches, candidates, pageHits } = resultFor(text, true, isMain);
    if (!isMain) {
      result.innerHTML = `${renderTranslationSections(basicMatches, matches, candidates)}${matches.length ? `<details class="translation-evidence"><summary>稍后查看词典出处 · ${matches.length} 条</summary>${matches.map(term => renderEntry(term)).join('')}</details>` : ''}${candidates.length ? `<details class="translation-evidence"><summary>稍后核对原书摘录 · ${candidates.length} 条</summary>${candidates.map(term => renderCandidate(term, true)).join('')}</details>` : ''}${!basicMatches.length && !matches.length && !candidates.length ? `<button class="secondary-button quick-to-main" id="quick-to-main">${pageHits.length ? '稍后查看相关词典页面' : '打开全书词典查找'}</button>` : ''}`;
      $('#quick-to-main')?.addEventListener('click', () => { quickModal.close(); $('#main-input').value = text; $('#main-input').focus(); });
    }
  } catch {
    if (isMain) $('#main-result').textContent = '本机词典暂时无法查询，请重试。';
    else result.textContent = '本机词典暂时无法查询，请重试。';
    showToast('译义查询未完成');
  } finally {
  setBusy(button, false, '翻译', '翻译中…');
    result.setAttribute('aria-busy', 'false');
    if (isMain) { $('#main-clear').disabled = false; $('#main-clipboard').disabled = false; }
  }
}

$('#search-input').addEventListener('input', event => { state.query = event.target.value; render(); });
grid.addEventListener('click', event => {
  const pin = event.target.closest('[data-pin]');
  if (pin) {
    try { state.pinned = termRepository.togglePinned(pin.dataset.pin); renderTerms(); grid.querySelector(`[data-pin="${pin.dataset.pin}"]`)?.focus(); showToast(state.pinned.includes(pin.dataset.pin) ? '已加入收藏' : '已取消收藏'); }
    catch { showToast('未能保存收藏，请检查浏览器存储权限'); }
    return;
  }
  const source = event.target.closest('[data-source-open]');
  if (source) openSource(source.dataset.sourceOpen);
  const reader = event.target.closest('[data-reader-open]');
  if (reader) { showReaderPage(Number(reader.dataset.readerOpen), reader.dataset.readerDictionary); $('#book-reader-title').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});
$('#matched-terms').addEventListener('click', event => {
  const chip = event.target.closest('[data-select-term]');
  if (!chip) return;
  const term = dictionaryRepository.list().find(entry => entry.id === chip.dataset.selectTerm);
  if (term) { $('#main-input').value = term.word; resultFor(term.word, false); }
});

document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => {
  state.view = item.dataset.view;
  document.querySelectorAll('.nav-item').forEach(el => { el.classList.toggle('active', el === item); el === item ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current'); });
  $('#view-title').textContent = { library: '翻译', pinned: '收藏', history: '最近记录' }[state.view];
  $('#section-title').textContent = { library: '词典查证与来源', pinned: '收藏的词条', history: '最近查询' }[state.view];
  render();
}));

function openSource(id) {
  const term = dictionaryRepository.list().find(entry => entry.id === id);
  if (!term) return;
  const pageLabel = term.page ? `印刷页码 ${term.page}` : '印刷页码待核对';
  $('#source-title').textContent = `${term.word} · ${pageLabel}`;
  $('#source-page-caption').textContent = `${term.source}（${term.author}） · ${pageLabel}`;
  $('#source-image').src = term.scanImage;
  $('#source-image').alt = `《${term.source}》${pageLabel}，包含词条 ${term.word}`;
  $('#source-image').onerror = () => { $('#source-image').alt = '原书扫描页暂时无法显示'; showToast('原书页面暂时无法打开'); };
  sourceModal.open();
}

function showReaderPage(scanPage, dictionaryId = dictionaryRepository.readerId) {
  dictionaryRepository.selectReader(dictionaryId);
  $('#reader-dictionary').value = dictionaryId;
  const count = dictionaryRepository.pageCount();
  const page = dictionaryRepository.page(scanPage);
  $('#reader-total').textContent = `/ ${count}`;
  $('#reader-page').max = Math.max(1, count);
  $('#reader-page').disabled = !count;
  $('#reader-go').disabled = !count;
  $('#reader-prev').disabled = !count || scanPage <= 1;
  $('#reader-next').disabled = !count || scanPage >= count;
  $('#reader-view-source').disabled = !page?.imageUrl;
  const book = dictionaryRepository.dictionaries().find(book => book.id === dictionaryId);
  $('#reader-status').textContent = `${book.title} · ${book.authors} · ${count} 页`;
  if (!page) {
    state.readerPage = 1;
    $('#reader-page').value = 1;
    $('#reader-page-label').textContent = book.title;
    $('#reader-text').textContent = '此词典目前仅提供结构化词条，未附扫描页面。';
    $('#reader-image').removeAttribute('src');
    $('#reader-image').hidden = true;
    return;
  }
  state.readerPage = page.scanPage;
  $('#reader-page').value = page.scanPage;
  $('#reader-page-label').textContent = `${page.source} · 扫描顺序第 ${page.scanPage} 页`;
  $('#reader-text').textContent = page.text || '本页未识别出可用文本，请查看原书扫描页。';
  $('#reader-image').hidden = !page.imageUrl;
  if (page.imageUrl) $('#reader-image').src = page.imageUrl;
  else $('#reader-image').removeAttribute('src');
  $('#reader-image').alt = `《${page.source}》扫描顺序第 ${page.scanPage} 页`;
}

function openCurrentScan() {
  const page = dictionaryRepository.page(state.readerPage);
  if (!page?.imageUrl) return;
  $('#source-title').textContent = `原书扫描页 · 顺序第 ${page.scanPage} 页`;
  $('#source-page-caption').textContent = `《${page.source}》（${page.author}）· 扫描顺序第 ${page.scanPage} 页`;
  $('#source-image').src = page.imageUrl;
  $('#source-image').alt = `《${page.source}》扫描顺序第 ${page.scanPage} 页原图`;
  sourceModal.open();
}

function goToReaderInput() {
  const value = Number($('#reader-page').value);
  if (!Number.isInteger(value) || value < 1 || value > dictionaryRepository.pageCount()) {
    showToast(`请输入 1 至 ${dictionaryRepository.pageCount()} 之间的扫描页码`);
    return;
  }
  showReaderPage(value);
}

$('#reader-prev').addEventListener('click', () => showReaderPage(Math.max(1, state.readerPage - 1)));
$('#reader-next').addEventListener('click', () => showReaderPage(Math.min(dictionaryRepository.pageCount(), state.readerPage + 1)));
$('#reader-go').addEventListener('click', goToReaderInput);
$('#reader-page').addEventListener('keydown', event => { if (event.key === 'Enter') goToReaderInput(); });
$('#reader-view-source').addEventListener('click', openCurrentScan);

$('#quick-open').addEventListener('click', quickModal.open);
$('#quick-close').addEventListener('click', quickModal.close);
$('#source-close').addEventListener('click', sourceModal.close);
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); quickModal.open(); } });

for (const [buttonSelector, inputSelector] of [['#clipboard-read', '#quick-input'], ['#main-clipboard', '#main-input']]) {
  $(buttonSelector).addEventListener('click', async () => {
    const text = await desktopAdapter.readClipboard();
    if (text) { $(inputSelector).value = text; $(inputSelector).removeAttribute('aria-invalid'); showToast('已从剪贴板读取'); }
    else showToast('无法读取或剪贴板为空，请手动粘贴');
  });
}

$('#main-clear').addEventListener('click', () => {
  if ($('#main-lookup').disabled) return;
  $('#main-input').value = '';
  $('#main-input').removeAttribute('aria-invalid');
  $('#main-result').innerHTML = '<span class="result-placeholder">中文译文会优先显示在这里</span>';
  $('#main-provider').textContent = '等待翻译';
  $('#main-result-note').textContent = '译文优先展示，词典依据随后展开';
  $('#main-insight').classList.add('hidden');
  $('#main-copy').disabled = true;
  state.currentMatches = [];
  state.currentTranslation = '';
  state.lastText = '';
  state.pageHits = [];
  state.showMatches = false;
  renderTerms();
  $('#main-input').focus();
});

$('#main-copy').addEventListener('click', async () => {
  if (!state.currentTranslation) return;
  try {
    if (!await desktopAdapter.writeClipboard(state.currentTranslation)) throw Error('Unavailable');
    showToast('译义已复制');
  } catch { showToast('未能复制，请手动选取译义'); }
});

$('#main-lookup').addEventListener('click', () => lookupInto($('#main-input'), $('#main-result'), $('#main-lookup'), true));
$('#translate-button').addEventListener('click', () => lookupInto($('#quick-input'), $('#translation-result'), $('#translate-button')));
$('#main-input').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') $('#main-lookup').click(); });
$('#quick-input').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') $('#translate-button').click(); });

renderTerms();
$('#main-lookup').disabled = true;
$('#translate-button').disabled = true;
dictionaryRepository.loadIndex().then(index => {
  state.indexReady = true;
  Object.assign(state, termRepository.list());
  const books = dictionaryRepository.dictionaries();
  const options = books.map(book => `<option value="${escapeHtml(book.id)}">${escapeHtml(book.title)}</option>`).join('');
  $('#dictionary-select').innerHTML = '<option value="all">全部已启用词典</option>' + options;
  $('#reader-dictionary').innerHTML = options;
  $('#dictionary-select').disabled = false;
  $('#reader-dictionary').disabled = false;
  $('#main-lookup').disabled = false;
  $('#translate-button').disabled = false;
  $('.coverage-badge').innerHTML = `<span class="status-dot"></span>${books.length} 本词典 · ${index.pages.length} 页已载入`;
  if (dictionaryRepository.loadErrors.length) showToast(dictionaryRepository.loadErrors.map(error => `${error.title}：${error.message}`).join('；'));
  updateDictionaryLabels();
  showReaderPage(Math.min(10, books[0].pages.length) || 1);
  render();
}).catch(error => {
  console.error(error);
  $('#reader-status').textContent = '词典库未能载入，请通过本机预览服务打开测试版。';
  showToast('词典库载入失败');
});

function updateDictionaryLabels() {
  const selected = dictionaryRepository.selectedBooks();
  const names = selected.map(book => book.title).join('、');
  $('#dictionary-summary').textContent = selected.map(book => `${book.title}（${book.authors}）`).join('；');
  $('#dictionary-source-label').textContent = `译义来源 · ${names}`;
  $('#quick-source-caption').textContent = `译义来源：${names}`;
}
$('#dictionary-select').addEventListener('change', event => {
  dictionaryRepository.select(event.target.value);
  updateDictionaryLabels();
  const input = state.lastText || $('#main-input').value.trim();
  if (state.showMatches && input) resultFor(input, false);
  else render();
  if (event.target.value !== 'all') showReaderPage(1, event.target.value);
});
$('#reader-dictionary').addEventListener('change', event => showReaderPage(1, event.target.value));
for (const result of [$('#main-result'), $('#translation-result')]) result.addEventListener('click', event => {
  const source = event.target.closest('[data-source-open]');
  if (source) openSource(source.dataset.sourceOpen);
  const reader = event.target.closest('[data-reader-open]');
  if (reader) showReaderPage(Number(reader.dataset.readerOpen), reader.dataset.readerDictionary);
});

