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
    'entries-a': [{ id: 'bank', word: 'bank', meaning: '岸', reviewed: true }, { id: 'pending', word: 'unreviewed', meaning: '待校对', reviewed: false }],
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

test('single-book filtering and page routing cannot cross dictionary boundaries', async () => {
  const library = new DictionaryLibrary();
  const data = fixture();
  await library.load(async path => data[path]);
  assert.equal(library.searchPages('bank').length, 2);
  assert.equal(library.page(1, 'book-a').imageUrl, './assets/book-a/one.jpeg');
  assert.equal(library.page(1, 'book-b').imageUrl, './assets/book-b/one.jpeg');
  library.select('book-a');
  assert.deepEqual(library.lookup('bank').map(entry => entry.source), ['测试词典甲']);
  assert.deepEqual(library.searchPages('bank').map(hit => hit.page.dictionaryId), ['book-a']);
  assert.equal(library.allEntries().length, 4);
  assert.throws(() => library.select('absent'));
});

test('one missing book reports failure and keeps another book usable', async () => {
  const library = new DictionaryLibrary();
  const data = fixture();
  await library.load(async path => { if (path === 'pages-b') throw new Error('missing'); return data[path]; });
  assert.equal(library.loadErrors[0].title, '测试词典乙');
  assert.equal(library.lookup('bank')[0].source, '测试词典甲');
});

test('both imported books keep their scans and existing pinned identifiers after externalization', async () => {
  const library = new DictionaryLibrary();
  const appRoot = new URL('../', import.meta.url);
  await library.load(async path => JSON.parse(await readFile(new URL(path, appRoot), 'utf8')));
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

