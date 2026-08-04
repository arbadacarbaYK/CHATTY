const express = require('express');
const fetch = require('node-fetch');
const sqlite3 = require('sqlite3').verbose();
const puppeteer = require('puppeteer');
const xml2js = require('xml2js');
const path = require('path');
const rateLimit = require('express-rate-limit');
const {
  MAX_CONTENT_CHARS,
  cleanContent,
  isJunkContent,
  buildFtsQuery,
} = require('../lib/content');

const router = express.Router();

const crawlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many crawl requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const discoverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many discovery requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

function isBlockedHostname(hostname) {
  const h = hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '[::1]' ||
    h === 'metadata.google.internal' ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  ) {
    return true;
  }
  if (h === '169.254.169.254' || h.startsWith('169.254.')) return true;
  if (h.startsWith('192.168.') || h.startsWith('10.')) return true;
  // 172.16.0.0 – 172.31.255.255
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function assertSafePublicUrl(url) {
  const urlObj = new URL(url);
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    const err = new Error('Invalid URL protocol. Only HTTP and HTTPS are allowed.');
    err.status = 400;
    throw err;
  }
  if (isBlockedHostname(urlObj.hostname)) {
    const err = new Error('Local/internal URLs are not allowed for security reasons.');
    err.status = 400;
    throw err;
  }
  return urlObj;
}

async function parseRobotsTxt(baseUrl) {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const response = await fetch(robotsUrl, { timeout: 10000 });
    if (!response.ok) return [];
    const robotsText = await response.text();
    const sitemaps = [];
    for (const line of robotsText.split('\n')) {
      if (line.toLowerCase().startsWith('sitemap:')) {
        const sitemapUrl = line.substring(8).trim();
        if (sitemapUrl) sitemaps.push(sitemapUrl);
      }
    }
    return sitemaps;
  } catch (error) {
    console.log('Failed to parse robots.txt:', error.message);
    return [];
  }
}

async function parseSitemap(sitemapUrl) {
  try {
    const response = await fetch(sitemapUrl, { timeout: 15000 });
    if (!response.ok) return [];
    const xmlText = await response.text();
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlText);
    const urls = [];
    if (result.sitemapindex && result.sitemapindex.sitemap) {
      for (const sitemap of result.sitemapindex.sitemap) {
        if (sitemap.loc && sitemap.loc[0]) urls.push(sitemap.loc[0]);
      }
    }
    if (result.urlset && result.urlset.url) {
      for (const url of result.urlset.url) {
        if (url.loc && url.loc[0]) urls.push(url.loc[0]);
      }
    }
    return urls;
  } catch (error) {
    console.log('Failed to parse sitemap:', error.message);
    return [];
  }
}

const dbPath = path.join(__dirname, '..', '..', 'knowledge.db');
const db = new sqlite3.Database(dbPath);

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function ensureSchema() {
  await runAsync(`CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    status TEXT,
    tags TEXT,
    content TEXT,
    errorMsg TEXT,
    metadata TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  try {
    await runAsync(
      `CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        url, tags, content, metadata,
        tokenize = 'porter unicode61'
      )`
    );
  } catch (err) {
    console.warn('FTS5 unavailable, falling back to LIKE search:', err.message);
  }
}

async function syncFtsRow(id) {
  const row = await getAsync('SELECT * FROM knowledge WHERE id = ?', [id]);
  if (!row) return;
  try {
    await runAsync('DELETE FROM knowledge_fts WHERE rowid = ?', [id]);
    if (row.status === 'crawled' && row.content) {
      await runAsync(
        'INSERT INTO knowledge_fts(rowid, url, tags, content, metadata) VALUES (?, ?, ?, ?, ?)',
        [id, row.url || '', row.tags || '', row.content || '', row.metadata || '']
      );
    }
  } catch (err) {
    // FTS optional
  }
}

async function rebuildFts() {
  try {
    await runAsync('DELETE FROM knowledge_fts');
    const rows = await allAsync(
      "SELECT id, url, tags, content, metadata FROM knowledge WHERE status = 'crawled' AND content IS NOT NULL"
    );
    for (const row of rows) {
      await runAsync(
        'INSERT INTO knowledge_fts(rowid, url, tags, content, metadata) VALUES (?, ?, ?, ?, ?)',
        [row.id, row.url || '', row.tags || '', row.content || '', row.metadata || '']
      );
    }
    console.log(`FTS index rebuilt with ${rows.length} entries`);
  } catch (err) {
    console.warn('FTS rebuild skipped:', err.message);
  }
}

ensureSchema()
  .then(() => rebuildFts())
  .catch((err) => console.error('DB init failed:', err));

async function extractEnhancedContent(page) {
  return page.evaluate(() => {
    function isVisible(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
      const style = window.getComputedStyle(el);
      if (!style) return true;
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      return true;
    }

    function textFrom(el) {
      if (!el) return '';
      const clone = el.cloneNode(true);
      clone.querySelectorAll('script, style, noscript, svg, nav, footer, header, iframe').forEach((n) => n.remove());
      return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    const candidates = [
      document.querySelector('article'),
      document.querySelector('main'),
      document.querySelector('[role="main"]'),
      document.querySelector('.markdown-body'),
      document.querySelector('#content'),
      document.body,
    ].filter(Boolean);

    let best = '';
    for (const el of candidates) {
      if (!isVisible(el) && el !== document.body) continue;
      const t = textFrom(el);
      if (t.length > best.length) best = t;
    }

    const socialLinks = [];
    document
      .querySelectorAll(
        'a[href*="twitter.com"],a[href*="github.com"],a[href*="discord.com"],a[href*="telegram.me"],a[href*="reddit.com"],a[href*="youtube.com"],a[href*="medium.com"]'
      )
      .forEach((link) => {
        if (link.href) socialLinks.push(link.href);
      });

    const emails = [];
    const emailMatches = (document.body.textContent || '').match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    );
    if (emailMatches) emails.push(...new Set(emailMatches));

    return {
      visibleText: best,
      socialLinks: [...new Set(socialLinks)].slice(0, 20),
      emails: emails.slice(0, 10),
      title: document.title || '',
      metaDescription: document.querySelector('meta[name="description"]')?.content || '',
    };
  });
}

function extractTags(content, url, metadata = {}) {
  if (!content || typeof content !== 'string') content = '';

  const staticTags = [
    'bitcoin',
    'lightning',
    'nostr',
    'hardware',
    'software',
    'cashu',
    'wallet',
    'node',
    'api',
    'extension',
    'protocol',
    'ecash',
    'fedimint',
    'lnbits',
    'taproot',
  ];

  const foundStatic = staticTags.filter(
    (tag) => content.toLowerCase().includes(tag) || url.toLowerCase().includes(tag)
  );

  const stop = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
    'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now',
    'old', 'see', 'two', 'way', 'who', 'did', 'its', 'let', 'put', 'say', 'she', 'too',
    'use', 'this', 'that', 'with', 'from', 'have', 'will', 'would', 'could', 'should',
    'when', 'where', 'what', 'why', 'which', 'there', 'their', 'they', 'them', 'then',
    'than', 'been', 'being', 'into', 'over', 'under', 'after', 'before', 'during',
    'menu', 'navigation', 'home', 'about', 'contact', 'login', 'register', 'search',
    'button', 'click', 'loading', 'error', 'success', 'cookie', 'privacy', 'terms',
  ]);

  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && word.length <= 24 && /^[a-z]+$/.test(word) && !stop.has(word));

  const wordCount = {};
  words.forEach((word) => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  const sortedWords = Object.entries(wordCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);

  const metadataTags = [];
  if (metadata.socialLinks?.length) metadataTags.push('social');
  if (metadata.emails?.length) metadataTags.push('contact');
  if (metadata.title) {
    const titleWords = metadata.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && staticTags.includes(w));
    metadataTags.push(...titleWords);
  }

  return [...new Set([...foundStatic, ...sortedWords, ...metadataTags])].slice(0, 15);
}

function puppeteerArgs() {
  return [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--disable-gpu',
  ];
}

async function crawlAndStore(url) {
  assertSafePublicUrl(url);
  await runAsync('INSERT OR REPLACE INTO knowledge (url, status) VALUES (?, ?)', [url, 'crawling']);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: puppeteerArgs(),
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'CHATTY-KnowledgeBot/1.0 (+local; Bitcoin education knowledge crawler)'
    );
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('body', { timeout: 15000 });

    const enhanced = await extractEnhancedContent(page);
    const cleaned = cleanContent(enhanced.visibleText || '', MAX_CONTENT_CHARS);
    const metadata = {
      socialLinks: enhanced.socialLinks || [],
      emails: enhanced.emails || [],
      title: enhanced.title || '',
      metaDescription: enhanced.metaDescription || '',
      contentLength: cleaned.length,
    };

    if (isJunkContent(cleaned)) {
      const msg = 'Page content looks empty or blocked (JS shell / captcha / too short)';
      await runAsync(
        'UPDATE knowledge SET status=?, errorMsg=?, content=?, tags=?, metadata=?, updatedAt=CURRENT_TIMESTAMP WHERE url=?',
        ['error', msg, cleaned.slice(0, 500), '[]', JSON.stringify(metadata), url]
      );
      const row = await getAsync('SELECT id FROM knowledge WHERE url = ?', [url]);
      if (row) await syncFtsRow(row.id);
      const err = new Error(msg);
      err.status = 422;
      throw err;
    }

    const tags = extractTags(cleaned, url, metadata);
    await runAsync(
      'UPDATE knowledge SET status=?, tags=?, content=?, metadata=?, errorMsg=NULL, updatedAt=CURRENT_TIMESTAMP WHERE url=?',
      ['crawled', JSON.stringify(tags), cleaned, JSON.stringify(metadata), url]
    );
    const row = await getAsync('SELECT id FROM knowledge WHERE url = ?', [url]);
    if (row) await syncFtsRow(row.id);

    return {
      success: true,
      tags,
      preview: cleaned.slice(0, 240),
      contentLength: cleaned.length,
      metadata: {
        title: metadata.title,
        socialLinks: metadata.socialLinks.length,
        emails: metadata.emails.length,
      },
    };
  } finally {
    await browser.close();
  }
}

router.post('/add', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    assertSafePublicUrl(url);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  try {
    const result = await runAsync('INSERT OR IGNORE INTO knowledge (url, status) VALUES (?, ?)', [
      url,
      'pending',
    ]);
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/crawl', crawlLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    const result = await crawlAndStore(url);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/all', async (_req, res) => {
  try {
    const rows = await allAsync('SELECT * FROM knowledge ORDER BY updatedAt DESC');
    res.json({ knowledge: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter' });

  const sanitizedQuery = q.toString().trim().slice(0, 200);
  if (sanitizedQuery.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters long' });
  }

  try {
    const ftsQuery = buildFtsQuery(sanitizedQuery);
    if (ftsQuery) {
      try {
        const rows = await allAsync(
          `SELECT k.*, bm25(knowledge_fts) AS rank
           FROM knowledge_fts
           JOIN knowledge k ON k.id = knowledge_fts.rowid
           WHERE knowledge_fts MATCH ? AND k.status = 'crawled'
           ORDER BY rank
           LIMIT 12`,
          [ftsQuery]
        );
        if (rows.length > 0) {
          return res.json({ results: rows, mode: 'fts' });
        }
      } catch (ftsErr) {
        console.warn('FTS search failed, using LIKE:', ftsErr.message);
      }
    }

    const queryWords = sanitizedQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);
    const query = `%${sanitizedQuery}%`;
    let sqlQuery;
    let params = [];

    if (queryWords.length > 1) {
      const allMatchConditions = [];
      const anyMatchConditions = [];
      queryWords.forEach((word) => {
        const wordPattern = `%${word}%`;
        allMatchConditions.push(
          '(LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(url) LIKE ? OR LOWER(metadata) LIKE ?)'
        );
        anyMatchConditions.push(
          '(LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(url) LIKE ? OR LOWER(metadata) LIKE ?)'
        );
        params.push(wordPattern, wordPattern, wordPattern, wordPattern);
      });
      queryWords.forEach((word) => {
        const wordPattern = `%${word}%`;
        params.push(wordPattern, wordPattern, wordPattern, wordPattern);
      });
      sqlQuery = `
        SELECT *,
          CASE WHEN (${allMatchConditions.join(' AND ')}) THEN 1 ELSE 2 END as priority
        FROM knowledge
        WHERE status = 'crawled' AND (${anyMatchConditions.join(' OR ')})
        ORDER BY priority ASC, length(content) DESC, updatedAt DESC
        LIMIT 12`;
    } else {
      sqlQuery =
        "SELECT * FROM knowledge WHERE status = 'crawled' AND (LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(url) LIKE ? OR LOWER(metadata) LIKE ?) ORDER BY length(content) DESC, updatedAt DESC LIMIT 10";
      params = [query, query, query, query];
    }

    const rows = await allAsync(sqlQuery, params);
    res.json({ results: rows, mode: 'like' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/remove', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    const row = await getAsync('SELECT id FROM knowledge WHERE url = ?', [url]);
    const result = await runAsync('DELETE FROM knowledge WHERE url = ?', [url]);
    if (row) {
      try {
        await runAsync('DELETE FROM knowledge_fts WHERE rowid = ?', [row.id]);
      } catch (_) {
        /* optional */
      }
    }
    res.json({ success: true, deleted: result.changes > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clear', async (_req, res) => {
  try {
    const result = await runAsync('DELETE FROM knowledge');
    try {
      await runAsync('DELETE FROM knowledge_fts');
    } catch (_) {
      /* optional */
    }
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Mark truncated / thin entries so Crawl All can refresh them with full text. */
router.post('/mark-thin-pending', async (_req, res) => {
  try {
    const result = await runAsync(
      `UPDATE knowledge
       SET status = 'pending', errorMsg = NULL
       WHERE status = 'crawled' AND (content IS NULL OR length(content) < 400)`
    );
    res.json({ success: true, marked: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rebuild-fts', async (_req, res) => {
  try {
    await rebuildFts();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/discover', discoverLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    assertSafePublicUrl(url);
    const baseUrl = new URL(url).origin;
    assertSafePublicUrl(baseUrl);

    const discoveredUrls = [];
    const sitemaps = await parseRobotsTxt(baseUrl);

    for (const sitemapUrl of sitemaps) {
      try {
        assertSafePublicUrl(sitemapUrl);
        const urls = await parseSitemap(sitemapUrl);
        discoveredUrls.push(...urls);
      } catch (_) {
        /* skip unsafe sitemap */
      }
    }

    const commonSitemaps = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap/sitemap.xml`,
    ];

    for (const sitemapUrl of commonSitemaps) {
      if (!sitemaps.includes(sitemapUrl)) {
        try {
          assertSafePublicUrl(sitemapUrl);
          const urls = await parseSitemap(sitemapUrl);
          discoveredUrls.push(...urls);
        } catch (_) {
          /* skip */
        }
      }
    }

    const keywords = /bitcoin|lightning|nostr|wallet|cashu|ecash|lnbits|fedimint|taproot/i;
    const uniqueUrls = [...new Set(discoveredUrls)]
      .filter((u) => {
        try {
          assertSafePublicUrl(u);
          return keywords.test(u);
        } catch {
          return false;
        }
      })
      .slice(0, 20);

    for (const discoveredUrl of uniqueUrls) {
      await runAsync('INSERT OR IGNORE INTO knowledge (url, status) VALUES (?, ?)', [
        discoveredUrl,
        'pending',
      ]);
    }

    res.json({
      success: true,
      discovered: uniqueUrls.length,
      urls: uniqueUrls,
      sitemaps,
    });
  } catch (error) {
    console.error('Error discovering URLs:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/bulk-crawl', crawlLimiter, async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'Missing urls array' });
  }
  if (urls.length > 25) {
    return res.status(400).json({ error: 'Max 25 URLs per bulk-crawl request' });
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const result = await crawlAndStore(url);
      results.push({ url, ...result });
    } catch (error) {
      errors.push({ url, error: error.message });
    }
  }

  res.json({
    success: true,
    total: urls.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors,
  });
});

module.exports = router;
