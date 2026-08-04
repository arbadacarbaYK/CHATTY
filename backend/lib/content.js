/** Shared content cleaning / junk detection for the knowledge crawler. */

const MAX_CONTENT_CHARS = 50000;
const MIN_USEFUL_CHARS = 80;

const JUNK_PATTERNS = [
  /enable\s+javascript/i,
  /javascript\s+(is\s+)?(required|disabled|not\s+enabled)/i,
  /doesn't\s+work\s+without\s+javascript/i,
  /please\s+enable\s+cookies/i,
  /captcha/i,
  /access\s+denied/i,
  /just\s+a\s+moment/i,
];

/**
 * Normalize crawled page text for storage.
 * @param {string} text
 * @param {number} [maxChars]
 * @returns {string}
 */
function cleanContent(text, maxChars = MAX_CONTENT_CHARS) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/**
 * Detect SPA shells / bot walls that are useless for RAG.
 * @param {string} text
 * @returns {boolean}
 */
function isJunkContent(text) {
  if (!text || text.length < MIN_USEFUL_CHARS) return true;
  const sample = text.slice(0, 500);
  return JUNK_PATTERNS.some((re) => re.test(sample));
}

/**
 * Prefer a mid-document window when the query matches; else lead excerpt.
 * @param {string} content
 * @param {string} [query]
 * @param {number} [maxLen]
 * @returns {string}
 */
function excerptForPrompt(content, query = '', maxLen = 1200) {
  const cleaned = cleanContent(content, MAX_CONTENT_CHARS);
  if (!cleaned) return '';
  if (cleaned.length <= maxLen) return cleaned;

  const words = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) {
    return `${cleaned.slice(0, maxLen)}...`;
  }

  const lower = cleaned.toLowerCase();
  let bestIdx = -1;
  for (const word of words) {
    const idx = lower.indexOf(word);
    if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx < 0) {
    return `${cleaned.slice(0, maxLen)}...`;
  }

  const start = Math.max(0, bestIdx - Math.floor(maxLen / 4));
  const slice = cleaned.slice(start, start + maxLen);
  const prefix = start > 0 ? '...' : '';
  const suffix = start + maxLen < cleaned.length ? '...' : '';
  return `${prefix}${slice}${suffix}`;
}

/**
 * Build a safe FTS5 MATCH query from user text (OR of quoted tokens).
 * @param {string} q
 * @returns {string|null}
 */
function buildFtsQuery(q) {
  const tokens = String(q || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replace(/"/g, '')}"`).join(' OR ');
}

module.exports = {
  MAX_CONTENT_CHARS,
  MIN_USEFUL_CHARS,
  cleanContent,
  isJunkContent,
  excerptForPrompt,
  buildFtsQuery,
};
