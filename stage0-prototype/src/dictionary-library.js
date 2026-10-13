// Dictionary books, entries and scans are content data, independent of UI suppliers.
const normalize = text => String(text || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class DictionaryLibrary {
  constructor() {
    this.books = [];
    this.scope = 'all';
    this.readerId = '';
    this.loadErrors = [];
    this.pageLoadErrors = [];
    this.pageIndexesReady = false;
    this.pageIndexesPromise = null;
  }

  async load(fetchData = async path => {
    // Let the browser reuse static dictionary assets between visits. Deployments
    // still revalidate according to the server's normal cache headers.
    const response = await fetch(path, { cache: 'default' });
    if (!response.ok) throw new Error(`加载失败：${path} (${response.status})`);
    return response.json();
  }) {
    const catalog = await fetchData('./assets/dictionary-library.json');
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.dictionaries)) throw new Error('词典目录格式不正确');
    const enabled = catalog.dictionaries.filter(book => book.enabled !== false).sort((a, b) => (b.priority || 0) - (a.priority || 0));
    if (new Set(enabled.map(book => book.id)).size !== enabled.length) throw new Error('词典目录存在重复标识');
    const results = await Promise.allSettled(enabled.map(async book => {
      const entries = book.entriesPath ? await fetchData(book.entriesPath) : [];
      if (!Array.isArray(entries)) throw new Error('词条格式不正确');
      return {
        ...book,
        entries: entries.map(entry => ({
          ...entry,
          id: book.id === 'english-etymology' ? entry.id : `${book.id}:${entry.id}`,
          dictionaryId: book.id,
          source: book.title,
          author: book.authors,
          reviewed: entry.reviewed === true
        })),
        pages: []
      };
    }));
    const loadedBooks = results.filter(result => result.status === 'fulfilled').map(result => result.value);
    this.loadErrors = results.flatMap((result, i) => result.status === 'rejected' ? [{ title: enabled[i].title, message: String(result.reason) }] : []);
    if (!loadedBooks.length) throw new Error('没有可载入的词典');
    this.books = loadedBooks;
    if (this.scope !== 'all' && !this.books.some(book => book.id === this.scope)) this.scope = 'all';
    this.readerId = this.books[0].id;
    this.pageIndexesReady = false;
    this.pageIndexesPromise = null;
    this.pageLoadErrors = [];
    return { pages: [] };
  }

  async loadPageIndexes(fetchData = async path => {
    const response = await fetch(path, { cache: 'default' });
    if (!response.ok) throw new Error(`加载失败：${path} (${response.status})`);
    return response.json();
  }) {
    if (this.pageIndexesReady && !this.pageLoadErrors.length) return { pages: this.books.flatMap(book => book.pages) };
    if (this.pageIndexesPromise) return this.pageIndexesPromise;
    this.pageIndexesPromise = (async () => {
      const pendingBooks = this.books.filter(book => book.indexPath && !book.pages.length);
      const results = await Promise.allSettled(pendingBooks.map(async book => {
        const index = book.indexPath ? await fetchData(book.indexPath) : { pages: [] };
        if (!Array.isArray(index.pages)) throw new Error('页面索引格式不正确');
        return { book, pages: index.pages.map(page => ({
          ...page,
          dictionaryId: book.id,
          source: book.title,
          author: book.authors,
          imageUrl: page.file ? `${book.imageBase}${page.file}` : ''
        })) };
      }));
      const loaded = results.filter(result => result.status === 'fulfilled');
      this.pageLoadErrors = results.flatMap((result, index) => result.status === 'rejected'
        ? [{ title: pendingBooks[index].title, message: String(result.reason) }]
        : []);
      if (!loaded.length && !this.books.some(book => book.pages.length)) throw new Error('没有可载入的词典页面');
      loaded.forEach(result => { result.value.book.pages = result.value.pages; });
      this.pageIndexesReady = this.pageLoadErrors.length === 0;
      if (!this.pageIndexesReady) this.pageIndexesPromise = null;
      return { pages: this.books.flatMap(book => book.pages) };
    })().catch(error => {
      this.pageIndexesPromise = null;
      throw error;
    });
    return this.pageIndexesPromise;
  }

  dictionaries() { return this.books; }
  selectedBooks() { return this.scope === 'all' ? this.books : this.books.filter(book => book.id === this.scope); }
  select(id) {
    if (id !== 'all' && !this.books.some(book => book.id === id)) throw new Error('词典不存在');
    this.scope = id;
  }
  selectReader(id) {
    if (!this.books.some(book => book.id === id)) throw new Error('词典不存在');
    this.readerId = id;
  }
  allEntries() { return this.books.flatMap(book => book.entries); }
  list() { return this.selectedBooks().flatMap(book => book.entries); }
  pageCount() { return this.books.find(book => book.id === this.readerId)?.pages.length || 0; }
  totalPageCount() { return this.selectedBooks().reduce((sum, book) => sum + book.pages.length, 0); }
  page(scanPage, dictionaryId = this.readerId) { return this.books.find(book => book.id === dictionaryId)?.pages.find(page => page.scanPage === Number(scanPage)) || null; }
  lookup(text) {
    const query = normalize(text);
    if (!query) return [];
    return this.list().filter(entry => entry.reviewed && entry.word && entry.meaning && new RegExp(`(^|[^a-z])${escapeRegex(normalize(entry.word))}([^a-z]|$)`, 'i').test(query));
  }
  lookupCandidates(text) {
    const query = normalize(text);
    if (!query) return [];
    return this.list().filter(entry => !entry.reviewed && normalize(entry.word) === query);
  }
  searchPages(text, limit = 12) {
    const query = normalize(text);
    if (!query) return [];
    const tokens = query.match(/[a-z][a-z'-]{2,}|[\u3400-\u9fff]{1,}/gi) || [query];
    const matches = [];
    for (const book of this.selectedBooks()) for (const page of book.pages) {
      const content = String(page.text || '').replace(/\s+/g, ' ');
      const normalized = normalize(content);
      if (!normalized) continue;
      const score = normalized.includes(query) ? 100 : tokens.reduce((sum, token) => sum + (normalized.includes(token) ? 1 : 0), 0);
      if (!score) continue;
      const at = normalized.indexOf(tokens.find(token => normalized.includes(token)) || query);
      const start = Math.max(0, at - 90);
      matches.push({ page, score, snippet: content.slice(start, start + 260) });
    }
    return matches.sort((a, b) => b.score - a.score || a.page.scanPage - b.page.scanPage).slice(0, limit);
  }
}
