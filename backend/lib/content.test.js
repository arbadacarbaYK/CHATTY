const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanContent,
  isJunkContent,
  excerptForPrompt,
  buildFtsQuery,
  MAX_CONTENT_CHARS,
} = require('./content');

test('cleanContent collapses whitespace and truncates', () => {
  assert.equal(cleanContent('  hello\n\n  world\t '), 'hello world');
  const long = 'a'.repeat(MAX_CONTENT_CHARS + 100);
  assert.equal(cleanContent(long).length, MAX_CONTENT_CHARS);
  assert.equal(cleanContent(null), '');
});

test('isJunkContent detects JS shells and short text', () => {
  assert.equal(isJunkContent('hi'), true);
  assert.equal(
    isJunkContent('Please enable JavaScript to continue using this site. Sorry.'),
    true
  );
  assert.equal(
    isJunkContent(
      'Bitcoin is a peer-to-peer electronic cash system. Satoshi published the whitepaper in 2008. ' +
        'Lightning Network enables fast payments. Nostr is a relay protocol for notes.'
    ),
    false
  );
});

test('excerptForPrompt finds query match window', () => {
  const body =
    'Intro fluff. '.repeat(40) +
    'Lightning Network channels settle on Bitcoin. ' +
    'More fluff. '.repeat(40);
  const excerpt = excerptForPrompt(body, 'lightning channels', 80);
  assert.match(excerpt.toLowerCase(), /lightning/);
});

test('buildFtsQuery builds OR of quoted tokens', () => {
  assert.equal(buildFtsQuery('Lightning Network!'), '"lightning" OR "network"');
  assert.equal(buildFtsQuery('a'), null);
});
