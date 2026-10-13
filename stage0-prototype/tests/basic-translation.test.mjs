import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupBasicTranslations } from '../src/basic-translation.js';

test('basic translations normalize case and surrounding punctuation', () => {
  assert.deepEqual(lookupBasicTranslations(' HELLO! ').map(entry => entry.translation), ['你好']);
  assert.deepEqual(lookupBasicTranslations('Good morning.').map(entry => entry.translation), ['早上好']);
});

test('basic translation lookup uses complete phrases only', () => {
  assert.equal(lookupBasicTranslations('hello my friend').length, 0);
  assert.equal(lookupBasicTranslations('unknown phrase').length, 0);
});

