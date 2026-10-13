import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DictionaryLibrary } from '../src/dictionary-library.js';

function fixture() {
  const catalog = { schemaVersion: 1, dictionaries: [
    { id: 'book-a', title: '测试词典甲', authors: '测试作者甲', priority: 10, entriesPath: 'entries-a', indexPath: 'pages-a', imageBase: './assets/book-a/' },
    { id: 'book-b', title: '测试词典乙', authors: '测试作者乙', priority: 20, entriesPath: 'entries-b', indexPath: 'pages-b', imageBase: './assets/book-b/' },
    { id: 'paused', title: '停用词典', enabled: false, entriesPath: 'not-loaded' }
  ] };
  const data = {
    './assets/dictionary-library.json': catalog,
    'entries-a': [{ id: 'bank', word: 'bank', meaning: '岸', reviewed: true }, { id: 'pending', word: 'unreviewed', meaning: '待校对', reviewed: false }, { id: 'sternward', word: 'sternward', meaning: '在船尾地；向船尾地', reviewed: false }, { id: 'greet-example', word: 'greet', meaning: 'v. 问候〔你好，朋友。〕', reviewed: false }],
    'entries-b': [{ id: 'bank', word: 'bank', meaning: '银行', reviewed: true }, { id: 'phrase', word: 'red tape', meaning: '繁文缛节', reviewed: true }],
    'pages-a': { pages: [{ scanPage: 1, file: 'one.jpeg', text: 'bank 词典甲原文' }] },
    'pages-b': { pages: [{ scanPage: 1, file: 'one.jpeg', text: 'bank 词典乙原文' }] }
  };
  return data;
}

test('simultaneous lookup preserves conflicting meanings, priority and source-specific IDs', async () => {
  const library = new DictionaryLibrary();
  const data = fixture();
  await library.load(async path => { assert.ok(path in data, `Unexpected fetch: ${path}`); return data[path]; });
  const entries = library.lookup('bank');
  assert.deepEqual(entries.map(entry => [entry.id, entry.meaning, entry.source]), [['book-b:bank', '银行', '测试词典乙'], ['book-a:bank', '岸', '测试词典甲']]);
  assert.equal(library.lookup('banking').length, 0);
  assert.equal(library.lookup('unreviewed').length, 0);
  assert.equal(library.lookup('red tapes').length, 0);
  assert.equal(library.lookup('It is red tape.')[0].word, 'red tape');
});

test('Chinese reverse lookup finds English headwords from dictionary definitions', async () => {
  const library = new DictionaryLibrary();
  const data = fixture();
  await library.load(async path => data[path]);
  assert.deepEqual(library.reverseLookup('在船尾地').map(entry => entry.word), ['sternward']);
  assert.deepEqual(library.reverseLookup(' 在船尾地， ').map(entry => entry.word), ['sternward']);
  assert.deepEqual(library.reverseLookup('银行').map(entry => entry.word), ['bank']);
  assert.deepEqual(library.reverseLookup('你好').map(entry => entry.word), [], 'example sentences are excluded to avoid misleading reverse matches');
  assert.equal(library.reverseLookup('岸').length, 0, 'single-character searches are too noisy');
});

test('Chinese reverse lookup respects selected dictionaries, result limits and safety ordering', async () => {
  const library = new DictionaryLibrary();
  const data = fixture();
  data['entries-a'].push({ id: 'institution', word: 'institution', meaning: '银行；金融机构', reviewed: true });
  await library.load(async path => data[path]);
  assert.deepEqual(library.reverseLookup('银行').map(entry => entry.word), ['bank', 'institution']);
  assert.equal(library.reverseLookup('银行', 1).length, 1);
  library.select('book-b');
  assert.deepEqual(library.reverseLookup('银行').map(entry => entry.word), ['bank']);
});

test('single-book filtering and page routing cannot cross dictionary boundaries', async () => {
  const library = new DictionaryLibrary();
  const data = fixture();
  await library.load(async path => data[path]);
  await library.loadPageIndexes(async path => data[path]);
  assert.equal(library.searchPages('bank').length, 2);
  assert.equal(library.page(1, 'book-a').imageUrl, './assets/book-a/one.jpeg');
  assert.equal(library.page(1, 'book-b').imageUrl, './assets/book-b/one.jpeg');
  library.select('book-a');
  assert.deepEqual(library.lookup('bank').map(entry => entry.source), ['测试词典甲']);
  assert.deepEqual(library.searchPages('bank').map(hit => hit.page.dictionaryId), ['book-a']);
  assert.equal(library.allEntries().length, 6);
  assert.throws(() => library.select('absent'));
});

test('one missing book reports failure and keeps another book usable', async () => {
  const library = new DictionaryLibrary();
  const data = fixture();
  await library.load(async path => { if (path === 'entries-b') throw new Error('missing'); return data[path]; });
  assert.equal(library.loadErrors[0].title, '测试词典乙');
  assert.equal(library.lookup('bank')[0].source, '测试词典甲');
});

test('scan indexes are fetched only when requested', async () => {
  const library = new DictionaryLibrary();
  const data = fixture();
  const fetched = [];
  await library.load(async path => { fetched.push(path); return data[path]; });
  assert.equal(fetched.some(path => path.startsWith('pages-')), false);
  assert.equal(library.pageIndexesReady, false);
  await library.loadPageIndexes(async path => { fetched.push(path); return data[path]; });
  assert.equal(fetched.filter(path => path.startsWith('pages-')).length, 2);
  assert.equal(library.pageIndexesReady, true);
});

test('a missing scan index can be retried without reloading working indexes', async () => {
  const library = new DictionaryLibrary();
  const data = fixture();
  await library.load(async path => data[path]);
  await library.loadPageIndexes(async path => {
    if (path === 'pages-b') throw new Error('offline');
    return data[path];
  });
  assert.equal(library.pageIndexesReady, false);
  assert.equal(library.pageLoadErrors[0].title, '测试词典乙');
  const retried = [];
  await library.loadPageIndexes(async path => { retried.push(path); return data[path]; });
  assert.equal(library.pageIndexesReady, true);
  assert.deepEqual(retried, ['pages-b']);
  assert.equal(library.totalPageCount(), 2);
});

test('a failed retry does not discard dictionaries that were already loaded', async () => {
  const library = new DictionaryLibrary();
  const data = fixture();
  await library.load(async path => data[path]);
  await assert.rejects(library.load(async path => {
    if (path !== './assets/dictionary-library.json') throw new Error('offline');
    return data[path];
  }), /没有可载入的词典/);
  assert.equal(library.lookup('bank').length, 2);
});

test('both imported books keep their scans and existing pinned identifiers after externalization', async () => {
  const library = new DictionaryLibrary();
  const appRoot = new URL('../', import.meta.url);
  await library.load(async path => JSON.parse(await readFile(new URL(path, appRoot), 'utf8')));
  await library.loadPageIndexes(async path => JSON.parse(await readFile(new URL(path, appRoot), 'utf8')));
  assert.equal(library.totalPageCount(), 1076);
  library.select('english-etymology');
  assert.equal(library.totalPageCount(), 484);
  assert.equal(library.page(484).scanPage, 484);
  assert.equal(library.lookup("Aladdin's cave")[0].id, 'aladdins-cave');
  assert.ok(library.searchPages('Aladdin').some(hit => hit.page.scanPage === 10));
  library.select('english-chinese-dictionary-2005');
  assert.equal(library.lookupCandidates('abandon')[0].scanPage, 7);
  assert.equal(library.lookup('abandon').length, 0, 'automatically extracted content stays out of verified translations');
  const hello = library.lookupCandidates('hello')[0];
  assert.match(hello.meaning, /喂/);
  assert.equal(library.lookup('hello').length, 0, 'the imported hello entry stays separate until reviewed');
});
