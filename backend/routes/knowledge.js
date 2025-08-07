const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const keyword_extractor = require('keyword-extractor');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();
const puppeteer = require('puppeteer');
const xml2js = require('xml2js');

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
    // Extract visible text
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
router.post('/crawl', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  
  // First, ensure the URL exists in the database
  db.run('INSERT OR IGNORE INTO knowledge (url, status) VALUES (?, ?)', [url, 'crawling']);
  
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Extract enhanced content and metadata
    const enhancedContent = await extractEnhancedContent(page, url);
    
    // Special handling for different website types
    let mainText = enhancedContent.visibleText;
    
    // GitHub repository handling
    if (url.includes('github.com')) {
      try {
        await page.waitForTimeout(2000);
        
        const repoDescription = await page.$eval('.repository-content .description, .js-repo-root .description, .repohead .description', el => el.textContent).catch(() => '');
        const readmeContent = await page.$eval('.markdown-body, .readme, [data-testid="readme"]', el => el.textContent).catch(() => '');
        const repoName = await page.$eval('.repository-content h1, .js-repo-root h1, .repohead h1', el => el.textContent).catch(() => '');
        
        if (readmeContent && readmeContent.length > 100) {
          mainText = readmeContent;
        } else if (repoDescription && repoDescription.length > 20) {
          mainText = `${repoDescription} ${repoName || enhancedContent.title}`;
        } else {
          const mainContent = await page.$eval('main, .repository-content, .js-repo-root', el => el.textContent).catch(() => '');
          if (mainContent && mainContent.length > 50) {
            mainText = mainContent;
          } else {
            mainText = enhancedContent.title;
          }
        }
      } catch (e) {
        mainText = enhancedContent.title;
      }
    }
    // Bitcoin-related sites
    else if (url.includes('bitcoin') || url.includes('lightning') || url.includes('nostr')) {
      if (!mainText || mainText.length < 100) {
        mainText = `${enhancedContent.metaDescription} ${enhancedContent.title}`.trim();
      }
    }
    // General fallback
    else if (!mainText || mainText.length < 100) {
      mainText = `${enhancedContent.metaDescription} ${enhancedContent.title}`.trim();
    }
    
    // Extract first few meaningful sentences for a concise summary
    if (mainText && mainText.length > 50) {
      const sentences = mainText.split(/[.!?]+/).filter(s => s.trim().length > 10);
      mainText = sentences.slice(0, 2).join('. ').trim() + '.';
      
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
    
    // Prepare metadata for storage
    const metadata = {
      socialLinks: enhancedContent.socialLinks,
      emails: enhancedContent.emails,
      marketingTags: enhancedContent.marketingTags,
      comments: enhancedContent.comments.slice(0, 5), // Limit comments
      title: enhancedContent.title,
      metaDescription: enhancedContent.metaDescription
    };
    
    const tags = extractTags(cleanedContent, url, metadata);
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

// POST /knowledge/discover - Discover URLs from robots.txt and sitemaps
router.post('/discover', async (req, res) => {
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

module.exports = router; 