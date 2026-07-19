import assert from 'node:assert/strict';
import { parseInlineRichText, parseRichText } from '../src/lib/richText.ts';

assert.deepEqual(parseInlineRichText('safe **bold** text'), [
  { text: 'safe ', strong: false },
  { text: 'bold', strong: true },
  { text: ' text', strong: false },
]);

const malicious = '<img src=x onerror=alert(1)> **kept as text**';
assert.deepEqual(parseRichText(malicious), [{
  kind: 'paragraph',
  inline: [
    { text: '<img src=x onerror=alert(1)> ', strong: false },
    { text: 'kept as text', strong: true },
  ],
}]);

assert.deepEqual(parseRichText('• one\n---\n\nparagraph').map(({ kind }) => kind), [
  'bullet',
  'separator',
  'blank',
  'paragraph',
]);

console.log('rich text regression checks passed');
