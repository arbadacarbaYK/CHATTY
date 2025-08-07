const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const keyword_extractor = require('keyword-extractor');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();
const puppeteer = require('puppeteer');

// SQLite DB setup - Use the populated database from the root directory
const path = require('path');
const dbPath = path.join(__dirname, '..', '..', 'knowledge.db');
const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    status TEXT,
    tags TEXT,
    content TEXT,
    errorMsg TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Helper: extract tags from content
function extractTags(content, url) {
  const staticTags = ['bitcoin', 'lightning', 'nostr', 'hardware', 'software', 'cashu', 'wallet', 'node', 'api', 'extension', 'protocol'];
  
  // Find static tags first
  const foundStatic = staticTags.filter(tag => 
    content.toLowerCase().includes(tag) || url.toLowerCase().includes(tag)
  );
  
  // Extract meaningful words from the content
  const meaningfulWords = [];
  
  // Split content into words and filter meaningful ones
    const words = content.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
    .filter(word => 
      word.length >= 3 && 
      word.length <= 20 && 
      /^[a-z]+$/.test(word) &&
      !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'this', 'that', 'with', 'from', 'have', 'will', 'would', 'could', 'should', 'when', 'where', 'what', 'why', 'which', 'there', 'their', 'they', 'them', 'then', 'than', 'been', 'being', 'into', 'over', 'under', 'after', 'before', 'during', 'within', 'without', 'against', 'among', 'between', 'through', 'throughout', 'toward', 'towards', 'upon', 'concerning', 'regarding', 'about', 'like', 'such', 'very', 'much', 'many', 'few', 'some', 'any', 'each', 'every', 'either', 'neither', 'both', 'either', 'neither', 'none', 'all', 'most', 'least', 'more', 'less', 'fewer', 'several', 'various', 'different', 'same', 'similar', 'other', 'another', 'next', 'last', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(word)
    );
  
    meaningfulWords.push(...words);
  
  // Filter out common UI words but keep meaningful content
  const uiWords = [
    'menu', 'navigation', 'home', 'about', 'contact', 'login', 'register', 'sign', 
    'search', 'submit', 'button', 'link', 'click', 'here', 'read', 'more', 'less', 
    'show', 'hide', 'expand', 'collapse', 'toggle', 'open', 'close', 'next', 'previous', 
    'back', 'forward', 'up', 'down', 'left', 'right', 'top', 'bottom', 'header', 
    'footer', 'sidebar', 'main', 'content', 'page', 'site', 'web', 'website', 'skip', 
    'loading', 'error', 'success', 'warning', 'info', 'help', 'support', 'faq',
    'public', 'notifications', 'fork', 'star', 'code', 'issues', 'pull', 'requests',
    'actions', 'projects', 'security', 'sponsor'
  ];
  
  const filteredWords = meaningfulWords.filter(word => !uiWords.includes(word));
  
  // Get the most frequent meaningful words (up to 10)
  const wordCount = {};
  filteredWords.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  const sortedWords = Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
  
  // Combine static tags with extracted words
  const allTags = [...new Set([...foundStatic, ...sortedWords])];
  
  return allTags.slice(0, 15); // Limit to 15 tags max
}

// POST /knowledge/add { url }
router.post('/add', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  db.run('INSERT OR IGNORE INTO knowledge (url, status) VALUES (?, ?)', [url, 'pending'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
});

// POST /knowledge/crawl { url }
router.post('/crawl', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  
  // First, ensure the URL exists in the database
  db.run('INSERT OR IGNORE INTO knowledge (url, status) VALUES (?, ?)', [url, 'crawling']);
  
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // Wait for main content or body to be visible
    await page.waitForSelector('body', { timeout: 10000 });
    // Extract visible text
    const visibleText = await page.evaluate(() => {
      function getVisibleText(element) {
        if (!element) return '';
        if (element.nodeType === Node.TEXT_NODE) {
          return element.textContent.trim();
        }
        if (element.nodeType !== Node.ELEMENT_NODE) return '';
        const style = window.getComputedStyle(element);
        if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return '';
        let text = '';
        for (const child of element.childNodes) {
          text += getVisibleText(child) + ' ';
        }
        return text.trim();
      }
      return getVisibleText(document.body);
    });
    
    // Get page title and meta description for better context
    const pageTitle = await page.title();
    const metaDescription = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
    
    // Special handling for different website types
    let mainText = visibleText;
    
    // GitHub repository handling
    if (url.includes('github.com')) {
      try {
        // Wait for content to load
        await page.waitForTimeout(2000);
        
        // Try to get repository description and README content
        const repoDescription = await page.$eval('.repository-content .description, .js-repo-root .description, .repohead .description', el => el.textContent).catch(() => '');
        const readmeContent = await page.$eval('.markdown-body, .readme, [data-testid="readme"]', el => el.textContent).catch(() => '');
        const repoName = await page.$eval('.repository-content h1, .js-repo-root h1, .repohead h1', el => el.textContent).catch(() => '');
        
        if (readmeContent && readmeContent.length > 100) {
          mainText = readmeContent;
        } else if (repoDescription && repoDescription.length > 20) {
          mainText = `${repoDescription} ${repoName || pageTitle}`;
        } else {
          // Try to get any meaningful content from the page
          const mainContent = await page.$eval('main, .repository-content, .js-repo-root', el => el.textContent).catch(() => '');
          if (mainContent && mainContent.length > 50) {
            mainText = mainContent;
          } else {
            mainText = pageTitle;
          }
        }
      } catch (e) {
        mainText = pageTitle;
      }
    }
    // Bitcoin-related sites
    else if (url.includes('bitcoin') || url.includes('lightning') || url.includes('nostr')) {
      // For Bitcoin-related sites, prioritize main content
      if (!mainText || mainText.length < 100) {
        mainText = `${metaDescription} ${pageTitle}`.trim();
      }
    }
    // General fallback
    else if (!mainText || mainText.length < 100) {
      mainText = `${metaDescription} ${pageTitle}`.trim();
    }
    
    // Extract first few meaningful sentences for a concise summary
    if (mainText && mainText.length > 50) {
      const sentences = mainText.split(/[.!?]+/).filter(s => s.trim().length > 10);
      mainText = sentences.slice(0, 2).join('. ').trim() + '.';
      
      // If still too long, truncate to first 200 characters
      if (mainText.length > 200) {
        mainText = mainText.substring(0, 200).replace(/\s+\w*$/, '') + '...';
      }
    }
    await browser.close();
    
    // Clean the content before storing
    const cleanedContent = mainText
      .replace(/[\n\r\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const tags = extractTags(cleanedContent, url);
    db.run('UPDATE knowledge SET status=?, tags=?, content=?, errorMsg=NULL, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
      'crawled',
      JSON.stringify(tags),
      cleanedContent.slice(0, 200), // Ensure content is limited to 200 characters
      url
    ], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, tags, preview: cleanedContent.slice(0, 200) });
    });
  } catch (e) {
    db.run('UPDATE knowledge SET status=?, errorMsg=?, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
      'error',
      e.message,
      url
    ], () => {
      res.status(500).json({ error: e.message });
    });
  }
});

// GET /knowledge/all
router.get('/all', (req, res) => {
  db.all('SELECT * FROM knowledge ORDER BY updatedAt DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ knowledge: rows });
  });
});

// GET /knowledge/search?q=query
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter' });
  
  // Split query into words for more flexible matching
  const queryWords = q.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const query = `%${q}%`;
  
  // Build a more intelligent query that prioritizes entries matching all words
  let sqlQuery = '';
  let params = [];
  
  if (queryWords.length > 1) {
    // Multiple words - first get entries that match ALL words (higher priority)
    const allMatchConditions = [];
    queryWords.forEach(word => {
      const wordPattern = `%${word}%`;
      allMatchConditions.push('(LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(url) LIKE ?)');
      params.push(wordPattern, wordPattern, wordPattern);
    });
    
    // Then get entries that match ANY word (lower priority)
    const anyMatchConditions = [];
    queryWords.forEach(word => {
      const wordPattern = `%${word}%`;
      anyMatchConditions.push('(LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(url) LIKE ?)');
      params.push(wordPattern, wordPattern, wordPattern);
    });
    
    sqlQuery = `
      SELECT *, 
        CASE 
          WHEN (${allMatchConditions.join(' AND ')}) THEN 1
          ELSE 2
        END as priority
      FROM knowledge 
      WHERE (${anyMatchConditions.join(' OR ')})
      ORDER BY priority ASC, updatedAt DESC 
      LIMIT 15
    `;
  } else {
    // Single word - use original pattern
    sqlQuery = 'SELECT * FROM knowledge WHERE LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(url) LIKE ? ORDER BY updatedAt DESC LIMIT 10';
    params.push(query, query, query);
  }
  
  db.all(sqlQuery, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ results: rows });
  });
});

// DELETE /knowledge/remove { url }
router.delete('/remove', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  db.run('DELETE FROM knowledge WHERE url = ?', [url], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes > 0 });
  });
});

// DELETE /knowledge/clear - Clear all knowledge
router.delete('/clear', (req, res) => {
  db.run('DELETE FROM knowledge', [], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

module.exports = router; 