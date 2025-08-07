const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const keyword_extractor = require('keyword-extractor');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();
const puppeteer = require('puppeteer');
const xml2js = require('xml2js');

// SECURITY: Rate limiting for crawler endpoints
const rateLimit = require('express-rate-limit');

const crawlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many crawl requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const discoverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 discovery requests per windowMs
  message: 'Too many discovery requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: parse robots.txt and extract sitemap URLs
async function parseRobotsTxt(baseUrl) {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const response = await fetch(robotsUrl, { timeout: 10000 });
    if (!response.ok) return [];
    
    const robotsText = await response.text();
    const sitemaps = [];
    
    // Extract sitemap URLs from robots.txt
    const lines = robotsText.split('\n');
    for (const line of lines) {
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

// Helper: parse sitemap XML and extract URLs
async function parseSitemap(sitemapUrl) {
  try {
    const response = await fetch(sitemapUrl, { timeout: 15000 });
    if (!response.ok) return [];
    
    const xmlText = await response.text();
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlText);
    
    const urls = [];
    
    // Handle sitemap index
    if (result.sitemapindex && result.sitemapindex.sitemap) {
      for (const sitemap of result.sitemapindex.sitemap) {
        if (sitemap.loc && sitemap.loc[0]) {
          urls.push(sitemap.loc[0]);
        }
      }
    }
    
    // Handle URL list
    if (result.urlset && result.urlset.url) {
      for (const url of result.urlset.url) {
        if (url.loc && url.loc[0]) {
          urls.push(url.loc[0]);
        }
      }
    }
    
    return urls;
  } catch (error) {
    console.log('Failed to parse sitemap:', error.message);
    return [];
  }
}

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
    metadata TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Helper: extract enhanced content and metadata
async function extractEnhancedContent(page, url) {
  const content = await page.evaluate(() => {
    // REFACTORED: Improved text extraction with better error handling
    function getVisibleText(element) {
      if (!element) return '';
      
      try {
        if (element.nodeType === Node.TEXT_NODE) {
          return element.textContent?.trim() || '';
        }
        
        if (element.nodeType !== Node.ELEMENT_NODE) return '';
        
        const style = window.getComputedStyle(element);
        if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return '';
        
        let text = '';
        for (const child of element.childNodes) {
          text += getVisibleText(child) + ' ';
        }
        return text.trim();
      } catch (error) {
        console.warn('Error extracting text from element:', error);
        return '';
      }
    }

    // Extract HTML comments
    const comments = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_COMMENT,
      null,
      false
    );
    let node;
    while (node = walker.nextNode()) {
      const comment = node.textContent.trim();
      if (comment.length > 5) {
        comments.push(comment);
      }
    }

    // Extract social media links
    const socialLinks = [];
    const socialSelectors = [
      'a[href*="twitter.com"]',
      'a[href*="github.com"]',
      'a[href*="discord.com"]',
      'a[href*="telegram.me"]',
      'a[href*="reddit.com"]',
      'a[href*="youtube.com"]',
      'a[href*="medium.com"]'
    ];
    socialSelectors.forEach(selector => {
      const links = document.querySelectorAll(selector);
      links.forEach(link => {
        if (link.href) socialLinks.push(link.href);
      });
    });

    // Extract emails
    const emails = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const textContent = document.body.textContent;
    const emailMatches = textContent.match(emailRegex);
    if (emailMatches) {
      emails.push(...emailMatches);
    }

    // Extract marketing tags
    const marketingTags = [];
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
      const content = script.textContent || script.src;
      if (content.includes('gtag') || content.includes('googletagmanager') || content.includes('google-analytics')) {
        marketingTags.push('google-analytics');
      }
      if (content.includes('facebook') || content.includes('fbq')) {
        marketingTags.push('facebook-pixel');
      }
    });

    return {
      visibleText: getVisibleText(document.body),
      comments: comments,
      socialLinks: socialLinks,
      emails: emails,
      marketingTags: marketingTags,
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.content || ''
    };
  });

  return content;
}

// Helper: extract tags from content with enhanced metadata
function extractTags(content, url, metadata = {}) {
  // SECURITY: Handle undefined content
  if (!content || typeof content !== 'string') {
    content = '';
  }
  
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
  
  // Add metadata-based tags
  const metadataTags = [];
  if (metadata.socialLinks && metadata.socialLinks.length > 0) {
    metadataTags.push('social');
  }
  if (metadata.emails && metadata.emails.length > 0) {
    metadataTags.push('contact');
  }
  if (metadata.marketingTags && metadata.marketingTags.length > 0) {
    metadataTags.push('analytics');
  }
  
  // Combine static tags with extracted words and metadata tags
  const allTags = [...new Set([...foundStatic, ...sortedWords, ...metadataTags])];
  
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
router.post('/crawl', crawlLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  
  // SECURITY: Validate URL format and protocol
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return res.status(400).json({ error: 'Invalid URL protocol. Only HTTP and HTTPS are allowed.' });
    }
    
    // SECURITY: Prevent SSRF attacks by blocking internal/localhost URLs
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || 
        hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      return res.status(400).json({ error: 'Local/internal URLs are not allowed for security reasons.' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  
  // First, ensure the URL exists in the database and set status to crawling
  db.run('INSERT OR REPLACE INTO knowledge (url, status) VALUES (?, ?)', [url, 'crawling']);
  
  try {
    // SECURITY: Enhanced Puppeteer security settings
    const browser = await puppeteer.launch({ 
      headless: 'new', 
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ] 
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Extract enhanced content and metadata
    const enhancedContent = await extractEnhancedContent(page, url);
    const content = enhancedContent.visibleText || '';
    const metadata = {
      comments: enhancedContent.comments || [],
      socialLinks: enhancedContent.socialLinks || [],
      emails: enhancedContent.emails || [],
      marketingTags: enhancedContent.marketingTags || [],
      title: enhancedContent.title || '',
      metaDescription: enhancedContent.metaDescription || ''
    };
    
    await browser.close();
    
    // Clean the content before storing
    const cleanedContent = content
      .replace(/[\n\r\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const tags = await extractTags(cleanedContent, url, metadata);
    db.run('UPDATE knowledge SET status=?, tags=?, content=?, metadata=?, errorMsg=NULL, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
      'crawled',
      JSON.stringify(tags),
      cleanedContent.slice(0, 200),
      JSON.stringify(metadata),
      url
    ], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        success: true, 
        tags, 
        preview: cleanedContent.slice(0, 200),
        metadata: {
          socialLinks: metadata.socialLinks.length,
          emails: metadata.emails.length,
          marketingTags: metadata.marketingTags.length
        }
      });
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
  
  // SECURITY: Sanitize and validate search query
  const sanitizedQuery = q.toString().trim().slice(0, 100); // Limit query length
  if (!sanitizedQuery || sanitizedQuery.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters long' });
  }
  
  // Split query into words for more flexible matching
  const queryWords = sanitizedQuery.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const query = `%${sanitizedQuery}%`;
  
  // Build a more intelligent query that prioritizes entries matching all words
  let sqlQuery = '';
  let params = [];
  
  if (queryWords.length > 1) {
    // Multiple words - first get entries that match ALL words (higher priority)
    const allMatchConditions = [];
    queryWords.forEach(word => {
      const wordPattern = `%${word}%`;
      allMatchConditions.push('(LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(url) LIKE ? OR LOWER(metadata) LIKE ?)');
      params.push(wordPattern, wordPattern, wordPattern, wordPattern);
    });
    
    // Then get entries that match ANY word (lower priority)
    const anyMatchConditions = [];
    queryWords.forEach(word => {
      const wordPattern = `%${word}%`;
      anyMatchConditions.push('(LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(url) LIKE ? OR LOWER(metadata) LIKE ?)');
      params.push(wordPattern, wordPattern, wordPattern, wordPattern);
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
    sqlQuery = 'SELECT * FROM knowledge WHERE LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(url) LIKE ? OR LOWER(metadata) LIKE ? ORDER BY updatedAt DESC LIMIT 10';
    params.push(query, query, query, query);
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

// POST /knowledge/discover - Discover URLs from robots.txt and sitemaps
router.post('/discover', discoverLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  
  try {
    const baseUrl = new URL(url).origin;
    const discoveredUrls = [];
    
    // Parse robots.txt for sitemaps
    const sitemaps = await parseRobotsTxt(baseUrl);
    console.log(`Found ${sitemaps.length} sitemaps in robots.txt`);
    
    // Parse each sitemap
    for (const sitemapUrl of sitemaps) {
      const urls = await parseSitemap(sitemapUrl);
      discoveredUrls.push(...urls);
      console.log(`Found ${urls.length} URLs in sitemap: ${sitemapUrl}`);
    }
    
    // Also try common sitemap locations
    const commonSitemaps = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap/sitemap.xml`
    ];
    
    for (const sitemapUrl of commonSitemaps) {
      if (!sitemaps.includes(sitemapUrl)) {
        const urls = await parseSitemap(sitemapUrl);
        discoveredUrls.push(...urls);
        console.log(`Found ${urls.length} URLs in common sitemap: ${sitemapUrl}`);
      }
    }
    
    // Filter and deduplicate URLs
    const uniqueUrls = [...new Set(discoveredUrls)]
      .filter(url => url.includes('bitcoin') || url.includes('lightning') || url.includes('nostr') || url.includes('wallet'))
      .slice(0, 20); // Limit to 20 most relevant URLs
    
    // Add discovered URLs to database
    for (const discoveredUrl of uniqueUrls) {
      db.run('INSERT OR IGNORE INTO knowledge (url, status) VALUES (?, ?)', [discoveredUrl, 'pending']);
    }
    
    res.json({ 
      success: true, 
      discovered: uniqueUrls.length,
      urls: uniqueUrls,
      sitemaps: sitemaps
    });
  } catch (error) {
    console.error('Error discovering URLs:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /knowledge/bulk-crawl - Bulk crawl operation (no rate limiting for admin operations)
router.post('/bulk-crawl', async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'Missing urls array' });
  }
  
  const results = [];
  const errors = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    
    // Add delay between requests to avoid overwhelming the system
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
    }
    
    try {
      // SECURITY: Validate each URL
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push({ url, error: 'Invalid URL protocol' });
        continue;
      }
      
      const hostname = urlObj.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || 
          hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
        errors.push({ url, error: 'Local/internal URLs not allowed' });
        continue;
      }
      
      // Use the existing crawl logic by calling the crawl function directly
      const browser = await puppeteer.launch({ 
        headless: 'new', 
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ] 
      });
      
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        const enhancedContent = await extractEnhancedContent(page, url);
        const content = enhancedContent.visibleText || '';
        const metadata = {
          comments: enhancedContent.comments || [],
          socialLinks: enhancedContent.socialLinks || [],
          emails: enhancedContent.emails || [],
          marketingTags: enhancedContent.marketingTags || [],
          title: enhancedContent.title || '',
          metaDescription: enhancedContent.metaDescription || ''
        };
        
        const tags = await extractTags(content, url, metadata);
        
        // Update the database
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO knowledge (url, status, tags, content, metadata, updatedAt) 
          VALUES (?, 'success', ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(url, JSON.stringify(tags), content, JSON.stringify(metadata));
        stmt.finalize();
        
        results.push({ url, success: true, tags, preview: content.substring(0, 100) });
        
      } catch (pageError) {
        console.error(`Error processing page ${url}:`, pageError.message);
        errors.push({ url, error: pageError.message });
        
        // Update database with error
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO knowledge (url, status, errorMsg, updatedAt) 
          VALUES (?, 'error', ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(url, pageError.message);
        stmt.finalize();
      } finally {
        await browser.close();
      }
      
    } catch (error) {
      console.error(`Error crawling ${url}:`, error.message);
      errors.push({ url, error: error.message });
      
      // Update database with error
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO knowledge (url, status, errorMsg, updatedAt) 
        VALUES (?, 'error', ?, CURRENT_TIMESTAMP)
      `);
      stmt.run(url, error.message);
      stmt.finalize();
    }
  }
  
  res.json({
    success: true,
    total: urls.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors
  });
});

module.exports = router; 