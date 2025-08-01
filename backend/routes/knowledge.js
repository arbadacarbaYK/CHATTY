const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const keyword_extractor = require('keyword-extractor');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();
const puppeteer = require('puppeteer');



// SQLite DB setup
const db = new sqlite3.Database('./knowledge.db');
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

// Enhanced crawling function with better error handling and content extraction
async function crawlUrl(url, options = {}) {
  const {
    timeout = 20000,
    retries = 2,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  } = options;

  let browser;
  let page;
  
  try {
    browser = await puppeteer.launch({ 
      headless: 'new', 
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ] 
    });
    
    page = await browser.newPage();
    
    // Set user agent and viewport
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1280, height: 720 });
    
    // Set extra headers to avoid detection
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });

    // Navigate with enhanced timeout and error handling
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: timeout 
    });
    
    // Wait for body with fallback
    try {
      await page.waitForSelector('body', { timeout: 10000 });
    } catch (e) {
      console.log(`No body selector found for ${url}, continuing anyway`);
    }
    
    // Get page metadata
    const pageTitle = await page.title().catch(() => '');
    const metaDescription = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
    const metaKeywords = await page.$eval('meta[name="keywords"]', el => el.content).catch(() => '');
    
    // Extract visible text with enhanced handling for different site types
    let mainText = '';
    
    if (url.includes('github.com')) {
      mainText = await extractGitHubContent(page, pageTitle, metaDescription);
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      mainText = await extractTwitterContent(page, pageTitle, metaDescription);
    } else if (url.includes('groups.google.com')) {
      mainText = await extractGoogleGroupsContent(page, pageTitle, metaDescription);
    } else if (url.includes('bitcoin') || url.includes('lightning') || url.includes('nostr')) {
      mainText = await extractBitcoinContent(page, pageTitle, metaDescription);
    } else {
      mainText = await extractGeneralContent(page, pageTitle, metaDescription);
    }
    
    // Enhanced content processing
    mainText = processContent(mainText, url);
    
    await browser.close();
    
    return { success: true, content: mainText, title: pageTitle, description: metaDescription };
    
  } catch (e) {
    if (browser) await browser.close();
    
    // Enhanced error classification
    const errorType = classifyError(e.message, url);
    return { 
      success: false, 
      error: e.message, 
      errorType: errorType,
      retryable: isRetryableError(errorType)
    };
  }
}

// Enhanced GitHub content extraction
async function extractGitHubContent(page, pageTitle, metaDescription) {
      try {
        await page.waitForTimeout(3000);
        
        // Try multiple selectors for README content
        let readmeContent = '';
        const readmeSelectors = [
          '[data-testid="readme"] .markdown-body',
          '.markdown-body',
          '.readme .markdown-body',
          '.repository-content .markdown-body',
          '.js-repo-root .markdown-body',
          '#readme .markdown-body',
      '.Box-body .markdown-body',
      'article.markdown-body',
      '.repository-content article',
      '.js-repo-root article'
        ];
        
    // Wait for content to load
    await page.waitForTimeout(2000);
    
    // Try to find README content
        for (const selector of readmeSelectors) {
          try {
            readmeContent = await page.$eval(selector, el => el.textContent).catch(() => '');
            if (readmeContent && readmeContent.length > 100) break;
          } catch (e) {
            continue;
          }
        }
        
    // If no README found, try to get any markdown content
    if (!readmeContent || readmeContent.length < 100) {
      try {
        readmeContent = await page.evaluate(() => {
          const markdownElements = document.querySelectorAll('.markdown-body, article, [data-testid="readme"]');
          for (const el of markdownElements) {
            const text = el.textContent?.trim();
            if (text && text.length > 100) {
              return text;
            }
          }
          return '';
        });
      } catch (e) {
        // Ignore errors
      }
    }
        
        // Try to get repository description and name
        let repoDescription = '';
    let repoName = '';
    
        const descSelectors = [
          '.repository-content .description',
          '.js-repo-root .description', 
          '.repohead .description',
          '[data-testid="repository-description"]',
      '.repository-meta .description',
      '.repository-content [data-testid="repository-description"]',
      '.js-repo-root [data-testid="repository-description"]',
      '.repository-content .f4.mb-3',
      '.js-repo-root .f4.mb-3'
        ];
        
        for (const selector of descSelectors) {
          try {
            repoDescription = await page.$eval(selector, el => el.textContent).catch(() => '');
            if (repoDescription && repoDescription.length > 10) break;
          } catch (e) {
            continue;
          }
        }
        
        const nameSelectors = [
          '.repository-content h1',
          '.js-repo-root h1',
          '.repohead h1',
          '[data-testid="repository-name"]',
          '.repository-meta h1'
        ];
        
        for (const selector of nameSelectors) {
          try {
            repoName = await page.$eval(selector, el => el.textContent).catch(() => '');
            if (repoName && repoName.length > 5) break;
          } catch (e) {
            continue;
          }
        }
        
    // Get repository topics/tags
    let repoTopics = '';
    try {
      repoTopics = await page.evaluate(() => {
        const topics = Array.from(document.querySelectorAll('a[data-ga-click="Repository, go to topic, location:repo overview"], .topic-tag'))
          .map(el => el.textContent?.trim())
          .filter(Boolean)
          .join(', ');
        return topics;
      });
    } catch (e) {
      // Ignore if not found
    }
    
    // Get repository stats
    let repoStats = '';
    try {
      repoStats = await page.evaluate(() => {
        const stats = [];
        const starEl = document.querySelector('a[href*="/stargazers"]');
        const forkEl = document.querySelector('a[href*="/forks"]');
        const watchEl = document.querySelector('a[href*="/watchers"]');
        
        if (starEl) stats.push(`Stars: ${starEl.textContent?.trim()}`);
        if (forkEl) stats.push(`Forks: ${forkEl.textContent?.trim()}`);
        if (watchEl) stats.push(`Watchers: ${watchEl.textContent?.trim()}`);
        
        return stats.join(', ');
      });
    } catch (e) {
      // Ignore if not found
    }
    
        // Check if this is a GitHub profile page
    const isProfile = await page.evaluate(() => {
      return window.location.pathname.split('/').length === 2 && 
             !window.location.pathname.includes('/') && 
             document.querySelector('.profile-bio') !== null;
    });
    
    if (isProfile) {
      // Extract profile information
      const profileInfo = await page.evaluate(() => {
        const bio = document.querySelector('.profile-bio')?.textContent?.trim() || '';
        const name = document.querySelector('.vcard-names .p-name')?.textContent?.trim() || '';
        const username = document.querySelector('.vcard-names .p-nickname')?.textContent?.trim() || '';
        const location = document.querySelector('.vcard-details .p-label')?.textContent?.trim() || '';
        const company = document.querySelector('.vcard-details .p-org')?.textContent?.trim() || '';
        const website = document.querySelector('.vcard-details .Link--primary')?.textContent?.trim() || '';
        
        // Get pinned repositories
        const pinnedRepos = Array.from(document.querySelectorAll('.pinned-item-list-item'))
          .map(repo => {
            const name = repo.querySelector('.repo')?.textContent?.trim() || '';
            const desc = repo.querySelector('.pinned-item-desc')?.textContent?.trim() || '';
            return `${name}: ${desc}`;
          })
          .filter(Boolean)
          .join(', ');
        
        // Get recent repositories
        const recentRepos = Array.from(document.querySelectorAll('.repo-list-item'))
          .slice(0, 5)
          .map(repo => {
            const name = repo.querySelector('.repo')?.textContent?.trim() || '';
            const desc = repo.querySelector('.repo-list-description')?.textContent?.trim() || '';
            return `${name}: ${desc}`;
          })
          .filter(Boolean)
          .join(', ');
        
        return { bio, name, username, location, company, website, pinnedRepos, recentRepos };
      });
      
      const profileParts = [];
      if (profileInfo.name) profileParts.push(`Name: ${profileInfo.name}`);
      if (profileInfo.username) profileParts.push(`Username: ${profileInfo.username}`);
      if (profileInfo.bio) profileParts.push(`Bio: ${profileInfo.bio}`);
      if (profileInfo.location) profileParts.push(`Location: ${profileInfo.location}`);
      if (profileInfo.company) profileParts.push(`Company: ${profileInfo.company}`);
      if (profileInfo.website) profileParts.push(`Website: ${profileInfo.website}`);
      if (profileInfo.pinnedRepos) profileParts.push(`Pinned Repos: ${profileInfo.pinnedRepos}`);
      if (profileInfo.recentRepos) profileParts.push(`Recent Repos: ${profileInfo.recentRepos}`);
      
      return profileParts.join('. ');
    }
    
    // Build comprehensive content for repositories
    const parts = [];
    if (repoName) parts.push(repoName);
    if (repoDescription) parts.push(repoDescription);
    if (repoTopics) parts.push(`Topics: ${repoTopics}`);
    if (repoStats) parts.push(`Stats: ${repoStats}`);
        if (readmeContent && readmeContent.length > 100) {
      parts.push(`README: ${readmeContent.substring(0, 300)}...`);
    }
    
    const combinedContent = parts.join('. ');
    
    // Prioritize content: README > Combined > Description + Name > Main Content
    if (readmeContent && readmeContent.length > 100) {
      return readmeContent;
    } else if (combinedContent && combinedContent.length > 50) {
      return combinedContent;
        } else if (repoDescription && repoDescription.length > 20) {
      return `${repoDescription} ${repoName || ''}`.trim();
        } else {
      return await page.evaluate(() => {
            const main = document.querySelector('main') || document.querySelector('.repository-content') || document.querySelector('.js-repo-root');
            if (main) {
              return main.textContent || '';
            }
            return document.body.textContent || '';
          });
        }
      } catch (e) {
    return pageTitle;
  }
}

// Enhanced Twitter/X content extraction
async function extractTwitterContent(page, pageTitle, metaDescription) {
  try {
    // Twitter/X has heavy anti-bot protection, so we focus on meta data
    const metaData = await page.evaluate(() => {
      const meta = {};
      document.querySelectorAll('meta').forEach(el => {
        if (el.name && el.content) {
          meta[el.name] = el.content;
        }
      });
      return meta;
    });
    
    // Combine available metadata
    const content = [
      metaData.description,
      metaData['twitter:description'],
      metaData['og:description'],
      pageTitle
    ].filter(Boolean).join(' ');
    
    return content || 'Twitter/X profile - content not accessible via crawling';
  } catch (e) {
    return 'Twitter/X profile - content not accessible via crawling';
  }
}

// Enhanced Google Groups content extraction
async function extractGoogleGroupsContent(page, pageTitle, metaDescription) {
  try {
    // Wait longer for Google Groups to load
    await page.waitForTimeout(5000);
    
    // Wait for main content to appear
    try {
      await page.waitForSelector('main, .main-content, #content, h1', { timeout: 10000 });
    } catch (e) {
      console.log('No main content selector found, continuing anyway');
    }
    
    const groupsContent = await page.evaluate(() => {
      // Remove all UI elements that are not content
      const uiSelectors = [
        'nav', 'header', 'footer', '.gbar', '.gbh', '.gbq', '.gbqfb',
        '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
        '.search', '.menu', '.toolbar', '.sidebar', 'script', 'style',
        '.gbq', '.gbqfb', '.gbqfc', '.gbqfd', '.gbqfe', '.gbqff',
        '[data-testid*="navigation"]', '[data-testid*="header"]', '[data-testid*="footer"]'
      ];
      
      uiSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (el.parentNode) el.parentNode.removeChild(el);
        });
      });
      
      // Get group name and description
      const groupName = document.querySelector('h1')?.textContent?.trim() || 
                       document.querySelector('.group-name')?.textContent?.trim() || 
                       document.querySelector('title')?.textContent?.trim() || '';
      
      const groupDescription = document.querySelector('[data-testid="group-description"]')?.textContent?.trim() || 
                              document.querySelector('.group-description')?.textContent?.trim() ||
                              document.querySelector('.description')?.textContent?.trim() || '';
      
      // Get recent topics/discussions
      const topics = Array.from(document.querySelectorAll('[data-testid="topic-title"], .topic-title, .topic, .thread-title, .subject'))
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .slice(0, 10)
        .join(', ');
      
      // Get member count and activity
      const memberCount = document.querySelector('[data-testid="member-count"]')?.textContent?.trim() || 
                         document.querySelector('.member-count')?.textContent?.trim() || '';
      const activityInfo = document.querySelector('[data-testid="activity-info"]')?.textContent?.trim() || 
                          document.querySelector('.activity-info')?.textContent?.trim() || '';
      
      // Get recent messages (if available)
      const messages = Array.from(document.querySelectorAll('[data-testid="message-content"], .message-content, .message, .post-content, .content'))
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .slice(0, 5)
        .join(' ');
      
      // Get main content area
      const mainContent = document.querySelector('main')?.textContent?.trim() || 
                         document.querySelector('.main-content')?.textContent?.trim() ||
                         document.querySelector('#content')?.textContent?.trim() || '';
      
      // Clean up the content by removing JavaScript and UI elements
      let cleanContent = mainContent || document.body.textContent || '';
      cleanContent = cleanContent.replace(/wiz_progress&&window\./g, '')
                               .replace(/gbar_||{};/g, '')
                               .replace(/function\(_\){var window=this; try{ _\./g, '')
                               .replace(/Google apps Groups Conversations All groups and messages/g, '')
                               .replace(/Send feedback to Google Help Training Sign in Groups/g, '')
                               .replace(/\s+/g, ' ')
                               .trim();
      
      const parts = [];
      if (groupName) parts.push(`Group: ${groupName}`);
      if (groupDescription) parts.push(`Description: ${groupDescription}`);
      if (memberCount) parts.push(`Members: ${memberCount}`);
      if (activityInfo) parts.push(`Activity: ${activityInfo}`);
      if (topics) parts.push(`Recent Topics: ${topics}`);
      if (messages) parts.push(`Recent Messages: ${messages}`);
      if (cleanContent && cleanContent.length > 50) parts.push(`Content: ${cleanContent.substring(0, 500)}`);
      
      return parts.join('. ');
    });
    
    return groupsContent || `${pageTitle}. ${metaDescription}`;
  } catch (e) {
    console.log(`Google Groups extraction failed for ${page.url()}: ${e.message}`);
    return `${pageTitle}. ${metaDescription}`;
  }
}

// Enhanced Bitcoin-related content extraction
async function extractBitcoinContent(page, pageTitle, metaDescription) {
  try {
    // For Bitcoin-related sites, try to get main content first
    let mainText = await page.evaluate(() => {
      // Look for main content areas
      const selectors = [
        'main',
        '.main-content',
        '.content',
        '.post-content',
        '.article-content',
        '.entry-content',
        '#content',
        '#main'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.length > 100) {
          return element.textContent;
        }
      }
      
      // Fallback to body content
      return document.body.textContent || '';
    });
    
    if (!mainText || mainText.length < 100) {
      mainText = `${metaDescription} ${pageTitle}`.trim();
    }
    
    return mainText;
  } catch (e) {
    return `${metaDescription} ${pageTitle}`.trim();
  }
}

// Enhanced general content extraction
async function extractGeneralContent(page, pageTitle, metaDescription) {
  try {
    const mainText = await page.evaluate(() => {
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
        
        // Get text from body and clean it up
        let text = getVisibleText(document.body);
        
      // Skip if it's just CSS/styling content
        if (text.includes('body {') && text.includes('scrollbar') && text.includes('errorContainer')) {
        return 'Content not accessible via crawling';
      }
      
      // Clean up the text - preserve word boundaries and readability
      text = text.replace(/\s+/g, ' ')
                 .replace(/\s+([.,!?])/g, '$1')
                 .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
                 .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Add space between acronyms
                 .replace(/([a-z])([0-9])/g, '$1 $2') // Add space between letters and numbers
                 .replace(/([0-9])([a-z])/g, '$1 $2') // Add space between numbers and letters
                 .replace(/([A-Z])([0-9])/g, '$1 $2') // Add space between uppercase and numbers
                 .replace(/([0-9])([A-Z])/g, '$1 $2') // Add space between numbers and uppercase
                   .trim();
        
        return text;
      });
    
    return mainText;
  } catch (e) {
    return `${metaDescription} ${pageTitle}`.trim();
  }
}

// Enhanced content processing
function processContent(content, url) {
  if (!content || content.length < 10) {
    return 'Content not accessible via crawling';
    }
    
    // Extract first few meaningful sentences for a concise summary
  if (content && content.length > 50) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    content = sentences.slice(0, 3).join('. ').trim() + '.';
    
    // If still too long, truncate to first 300 characters
    if (content.length > 300) {
      content = content.substring(0, 300).replace(/\s+\w*$/, '') + '...';
    }
  }
  
    // Clean the content before storing - preserve readability
  return content
      .replace(/[\n\r\t]+/g, ' ')
      .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Add space between acronyms
    .replace(/([a-z])([0-9])/g, '$1 $2') // Add space between letters and numbers
    .replace(/([0-9])([a-z])/g, '$1 $2') // Add space between numbers and letters
    .replace(/([A-Z])([0-9])/g, '$1 $2') // Add space between uppercase and numbers
    .replace(/([0-9])([A-Z])/g, '$1 $2') // Add space between numbers and uppercase
    // Fix common acronyms that shouldn't be split
    .replace(/L Nbits/g, 'LNbits')
    .replace(/Git Hub/g, 'GitHub')
    .replace(/Nostr Wallet Connect/g, 'Nostr Wallet Connect')
    // Handle NWC = Nostr Wallet Connect (bidirectional)
    .replace(/\bNWC\b/g, 'Nostr Wallet Connect (NWC)')
    .replace(/\bNostr Wallet Connect\b/g, 'Nostr Wallet Connect (NWC)')
    // Handle Electronic Cash variations (bidirectional)
    .replace(/\beCash\b/g, 'Electronic Cash (eCash)')
    .replace(/\bCashu\b/g, 'Electronic Cash (eCash)')
    .replace(/\bElectronic Cash\b/g, 'Electronic Cash (eCash)')
      .trim();
}

// Enhanced error classification
function classifyError(errorMessage, url) {
  const error = errorMessage.toLowerCase();
  
  if (error.includes('timeout') || error.includes('navigation timeout')) {
    return 'TIMEOUT';
  } else if (error.includes('net::err_connection_refused') || error.includes('connection refused')) {
    return 'CONNECTION_REFUSED';
  } else if (error.includes('net::err_name_not_resolved') || error.includes('dns')) {
    return 'DNS_ERROR';
  } else if (error.includes('net::err_connection_timed_out')) {
    return 'CONNECTION_TIMEOUT';
  } else if (error.includes('net::err_ssl_protocol_error') || error.includes('ssl')) {
    return 'SSL_ERROR';
  } else if (error.includes('net::err_blocked_by_client') || error.includes('blocked')) {
    return 'BLOCKED';
  } else if (error.includes('net::err_invalid_url')) {
    return 'INVALID_URL';
  } else {
    return 'UNKNOWN';
  }
}

// Check if error is retryable
function isRetryableError(errorType) {
  const retryableErrors = ['TIMEOUT', 'CONNECTION_TIMEOUT', 'DNS_ERROR'];
  return retryableErrors.includes(errorType);
}

// Enhanced tag extraction with better keyword detection
function extractTags(content, url) {
  const staticTags = [
    'bitcoin', 'lightning', 'nostr', 'hardware', 'software', 'cashu', 'wallet', 
    'node', 'api', 'extension', 'protocol', 'blockchain', 'cryptocurrency',
    'mining', 'wallet', 'exchange', 'defi', 'smart contract', 'layer2',
    'scaling', 'privacy', 'security', 'development', 'documentation'
  ];
  
  // Normalize content for better tag detection
  let normalizedContent = content.toLowerCase();
  
  // Handle NWC = Nostr Wallet Connect (bidirectional)
  if (normalizedContent.includes('nwc') || normalizedContent.includes('nostr wallet connect')) {
    normalizedContent = normalizedContent.replace(/\bnwc\b/g, 'nostr wallet connect (nwc)');
    normalizedContent = normalizedContent.replace(/\bnostr wallet connect\b/g, 'nostr wallet connect (nwc)');
  }
  
  // Handle Electronic Cash variations (bidirectional)
  if (normalizedContent.includes('cashu') || normalizedContent.includes('ecash') || normalizedContent.includes('electronic cash')) {
    // Check if it's likely referring to the modern Cashu protocol
    const cashuIndicators = ['cashu', 'ecash', 'electronic cash', 'mint', 'proof', 'blinded'];
    const hasCashuIndicators = cashuIndicators.some(indicator => normalizedContent.includes(indicator));
    
    if (hasCashuIndicators) {
      normalizedContent = normalizedContent.replace(/\becash\b/g, 'electronic cash (ecash)');
      normalizedContent = normalizedContent.replace(/\bcashu\b/g, 'electronic cash (ecash)');
      normalizedContent = normalizedContent.replace(/\belectronic cash\b/g, 'electronic cash (ecash)');
    }
  }
  
  // Special handling for different content types
  if (content === 'Content not accessible via crawling' || 
      content === 'Twitter/X profile - content not accessible via crawling') {
    return ['social', 'profile'];
  }
  
  // Find static tags first
  const foundStatic = staticTags.filter(tag => 
    normalizedContent.includes(tag) || url.toLowerCase().includes(tag)
  );
  
  // Extract meaningful words from the content
  const meaningfulWords = [];
  
  // Clean up normalized content first - preserve word boundaries
  let cleanedContent = normalizedContent
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split content into words and filter meaningful ones
  const words = cleanedContent.split(' ')
    .filter(word => 
      word.length >= 3 && 
      word.length <= 20 && 
      /^[a-z]+$/.test(word) &&
      !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'this', 'that', 'with', 'from', 'have', 'will', 'would', 'could', 'should', 'when', 'where', 'what', 'why', 'which', 'there', 'their', 'they', 'them', 'then', 'than', 'been', 'being', 'into', 'over', 'under', 'after', 'before', 'during', 'within', 'without', 'against', 'among', 'between', 'through', 'throughout', 'toward', 'towards', 'upon', 'concerning', 'regarding', 'about', 'like', 'such', 'very', 'much', 'many', 'few', 'some', 'any', 'each', 'every', 'either', 'neither', 'both', 'either', 'neither', 'none', 'all', 'most', 'least', 'more', 'less', 'fewer', 'several', 'various', 'different', 'same', 'similar', 'other', 'another', 'next', 'last', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'electronic', 'cash'].includes(word)
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
  let allTags = [...new Set([...foundStatic, ...sortedWords])];
  
  // Intelligent tag detection based on search words
  const searchWordMappings = {
    // Bitcoin ecosystem
    'btc': 'bitcoin',
    'satoshi': 'bitcoin',
    'blockchain': 'bitcoin',
    'mining': 'bitcoin',
    'node': 'bitcoin',
    'wallet': 'bitcoin',
    'electrum': 'bitcoin',
    'hardware': 'bitcoin',
    'multisig': 'bitcoin',
    'private': 'bitcoin',
    'keys': 'bitcoin',
    'address': 'bitcoin',
    'transaction': 'bitcoin',
    'fee': 'bitcoin',
    'mempool': 'bitcoin',
    'block': 'bitcoin',
    
    // Lightning Network
    'lightning': 'lightning',
    'channel': 'lightning',
    'payment': 'lightning',
    'invoice': 'lightning',
    'lnurl': 'lightning',
    'lnbits': 'lightning',
    'btcpay': 'lightning',
    'routing': 'lightning',
    'node': 'lightning',
    'peer': 'lightning',
    'sat': 'lightning',
    'sats': 'lightning',
    'millisat': 'lightning',
    'msat': 'lightning',
    
    // Nostr ecosystem
    'nostr': 'nostr',
    'relay': 'nostr',
    'npub': 'nostr',
    'nsec': 'nostr',
    'note': 'nostr',
    'event': 'nostr',
    'client': 'nostr',
    'pubkey': 'nostr',
    'signature': 'nostr',
    'nip': 'nostr',
    'zap': 'nostr',
    'reaction': 'nostr',
    'dm': 'nostr',
    'direct': 'nostr',
    'message': 'nostr',
    
    // Cashu/eCash ecosystem
    'cashu': 'cashu',
    'ecash': 'cashu',
    'mint': 'cashu',
    'proof': 'cashu',
    'blinded': 'cashu',
    'token': 'cashu',
    'melt': 'cashu',
    'mint': 'cashu',
    'split': 'cashu',
    'join': 'cashu',
    'electronic': 'cashu',
    'cash': 'cashu'
  };
  
  // Check for search words and add corresponding ecosystem tags
  const detectedEcosystems = new Set();
  for (const [searchWord, ecosystem] of Object.entries(searchWordMappings)) {
    if (normalizedContent.includes(searchWord) || url.toLowerCase().includes(searchWord)) {
      detectedEcosystems.add(ecosystem);
    }
  }
  
  // Add detected ecosystem tags
  detectedEcosystems.forEach(ecosystem => {
    if (!allTags.includes(ecosystem)) {
      allTags.push(ecosystem);
    }
  });
  
  // Add special normalized tags
  if (normalizedContent.includes('nostr wallet connect')) {
    allTags.push('nostr-wallet-connect');
    allTags.push('nwc');
  }
  
  if (normalizedContent.includes('electronic cash')) {
    allTags.push('electronic-cash');
    allTags.push('ecash');
    allTags.push('cashu');
  }
  
  return allTags.slice(0, 15); // Limit to 15 tags max
}

// POST /knowledge/add { url, content?, tags? }
router.post('/add', (req, res) => {
  const { url, content, tags } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  
  if (content) {
    // If content is provided, save it directly
    const extractedTags = tags || extractTags(content, url);
    const tagString = JSON.stringify(extractedTags);
    
    db.run('INSERT OR REPLACE INTO knowledge (url, status, content, tags) VALUES (?, ?, ?, ?)', 
      [url, 'crawled', content, tagString], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
  } else {
    // If no content, just save URL for crawling
    db.run('INSERT OR IGNORE INTO knowledge (url, status) VALUES (?, ?)', [url, 'pending'], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
  }
});

// POST /knowledge/crawl { url }
router.post('/crawl', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  
  // First, ensure the URL exists in the database
  db.run('INSERT OR IGNORE INTO knowledge (url, status) VALUES (?, ?)', [url, 'pending']);
  
  try {
    const result = await crawlUrl(url);
    
    if (result.success) {
      const tags = extractTags(result.content, url);
      db.run('UPDATE knowledge SET status=?, tags=?, content=?, errorMsg=NULL, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
        'crawled',
        JSON.stringify(tags),
        result.content.slice(0, 300),
        url
      ], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, tags, preview: result.content.slice(0, 300) });
      });
    } else {
      db.run('UPDATE knowledge SET status=?, errorMsg=?, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
        'failed',
        result.error,
        url
      ], () => {
        res.status(500).json({ error: result.error, errorType: result.errorType });
      });
    }
  } catch (e) {
    db.run('UPDATE knowledge SET status=?, errorMsg=?, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
      'failed',
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
  
  const query = `%${q}%`;
  db.all(
    'SELECT * FROM knowledge WHERE content LIKE ? OR tags LIKE ? OR url LIKE ? ORDER BY updatedAt DESC LIMIT 10',
    [query, query, query],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ results: rows });
    }
  );
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

// POST /knowledge/crawl-all - Enhanced crawl all pending and failed entries
router.post('/crawl-all', async (req, res) => {
  try {
    // Get all pending and failed entries
    db.all('SELECT url FROM knowledge WHERE status = ? OR status = ?', ['pending', 'failed'], async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (rows.length === 0) {
        return res.json({ success: true, message: 'No pending or failed entries to crawl' });
      }
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      const errorTypes = {};
      
      // Crawl each pending/failed entry using enhanced function
      for (const row of rows) {
        try {
          console.log(`Crawling: ${row.url}`);
          const result = await crawlUrl(row.url);
          
          if (result.success) {
            const tags = extractTags(result.content, row.url);
            
            // Update the database
            db.run('UPDATE knowledge SET status=?, tags=?, content=?, errorMsg=NULL, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
              'crawled',
              JSON.stringify(tags),
              result.content.slice(0, 300),
              row.url
            ]);
            
            successCount++;
            results.push({ url: row.url, status: 'success' });
          } else {
            errorCount++;
            const errorType = result.errorType || 'UNKNOWN';
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
            
            results.push({ url: row.url, status: 'error', error: result.error, errorType: errorType });
            
            // Update the database with error status
            db.run('UPDATE knowledge SET status=?, errorMsg=?, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
              'failed',
              result.error,
              row.url
            ]);
          }
        } catch (error) {
          errorCount++;
          results.push({ url: row.url, status: 'error', error: error.message });
          
          // Update the database with error status
          db.run('UPDATE knowledge SET status=?, errorMsg=?, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
            'failed',
            error.message,
            row.url
          ]);
        }
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      res.json({ 
        success: true, 
        message: `Crawled ${successCount} entries successfully, ${errorCount} errors`,
        results,
        errorTypes,
        summary: {
          total: rows.length,
          success: successCount,
          errors: errorCount,
          errorBreakdown: errorTypes
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /knowledge/crawl-single - Enhanced single entry crawl
router.post('/crawl-single', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  
  try {
    // First, ensure the URL exists in the database
    db.run('INSERT OR IGNORE INTO knowledge (url, status) VALUES (?, ?)', [url, 'pending']);
    
    console.log(`Crawling single entry: ${url}`);
    const result = await crawlUrl(url);
    
    if (result.success) {
      const tags = extractTags(result.content, url);
      db.run('UPDATE knowledge SET status=?, tags=?, content=?, errorMsg=NULL, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
        'crawled',
        JSON.stringify(tags),
        result.content.slice(0, 300),
        url
      ], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
          success: true, 
          tags, 
          preview: result.content.slice(0, 300),
          title: result.title,
          description: result.description
        });
      });
    } else {
      db.run('UPDATE knowledge SET status=?, errorMsg=?, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
        'failed',
        result.error,
        url
      ], () => {
        res.status(500).json({ 
          error: result.error, 
          errorType: result.errorType,
          retryable: result.retryable
        });
      });
    }
  } catch (e) {
    db.run('UPDATE knowledge SET status=?, errorMsg=?, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
      'failed',
      e.message,
      url
    ], () => {
      res.status(500).json({ error: e.message });
    });
  }
});

// POST /knowledge/recrawl-all - Comprehensive recrawl with error analysis
router.post('/recrawl-all', async (req, res) => {
  try {
    // Get all entries regardless of status
    db.all('SELECT * FROM knowledge ORDER BY updatedAt DESC', async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (rows.length === 0) {
        return res.json({ success: true, message: 'No entries to recrawl' });
      }
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      const errorTypes = {};
      const improvements = [];
      
      console.log(`Starting comprehensive recrawl of ${rows.length} entries...`);
      
      // Recrawl each entry
      for (const row of rows) {
        try {
          console.log(`Recrawling: ${row.url} (current status: ${row.status})`);
          const result = await crawlUrl(row.url);
          
          if (result.success) {
            const newTags = extractTags(result.content, row.url);
            const oldTags = row.tags ? JSON.parse(row.tags) : [];
            
            // Check for improvements
            const tagImprovement = newTags.length > oldTags.length;
            const contentImprovement = result.content.length > (row.content ? row.content.length : 0);
            
            if (tagImprovement || contentImprovement) {
              improvements.push({
                url: row.url,
                tagImprovement,
                contentImprovement,
                oldTags: oldTags.length,
                newTags: newTags.length,
                oldContentLength: row.content ? row.content.length : 0,
                newContentLength: result.content.length
              });
            }
            
            // Update the database
            db.run('UPDATE knowledge SET status=?, tags=?, content=?, errorMsg=NULL, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
              'crawled',
              JSON.stringify(newTags),
              result.content.slice(0, 300),
              row.url
            ]);
            
            successCount++;
            results.push({ 
              url: row.url, 
              status: 'success',
              improvements: { tagImprovement, contentImprovement }
            });
          } else {
            errorCount++;
            const errorType = result.errorType || 'UNKNOWN';
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
            
            results.push({ url: row.url, status: 'error', error: result.error, errorType: errorType });
            
            // Update the database with error status
            db.run('UPDATE knowledge SET status=?, errorMsg=?, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
              'failed',
              result.error,
              row.url
            ]);
          }
        } catch (error) {
          errorCount++;
          results.push({ url: row.url, status: 'error', error: error.message });
          
          // Update the database with error status
          db.run('UPDATE knowledge SET status=?, errorMsg=?, updatedAt=CURRENT_TIMESTAMP WHERE url=?', [
            'failed',
            error.message,
            row.url
          ]);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      res.json({ 
        success: true, 
        message: `Recrawled ${successCount} entries successfully, ${errorCount} errors`,
        results,
        errorTypes,
        improvements,
        summary: {
          total: rows.length,
          success: successCount,
          errors: errorCount,
          improvements: improvements.length,
          errorBreakdown: errorTypes
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /knowledge/clear - Clear all knowledge
router.delete('/clear', (req, res) => {
  db.run('DELETE FROM knowledge', [], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// Recrawl management - user-controlled sources
const RECRAWL_SOURCES = {
  'bitcoinops.org': {
    name: 'Bitcoin Optech Newsletter',
    url: 'https://bitcoinops.org',
    description: 'Technical Bitcoin newsletter and updates',
    enabled: true,
    lastCrawl: null
  },
  'groups.google.com/g/bitcoin-list': {
    name: 'Bitcoin Mailing List',
    url: 'https://groups.google.com/g/bitcoin-list',
    description: 'Official Bitcoin developer discussions',
    enabled: true,
    lastCrawl: null
  },
  'lightning.engineering': {
    name: 'Lightning Labs Blog',
    url: 'https://lightning.engineering',
    description: 'Lightning Network development updates',
    enabled: true,
    lastCrawl: null
  },
  'lnbits.com': {
    name: 'LNbits Documentation',
    url: 'https://lnbits.com',
    description: 'Lightning Network tools and guides',
    enabled: true,
    lastCrawl: null
  },
  'cashu.space': {
    name: 'Cashu Protocol',
    url: 'https://cashu.space',
    description: 'Ecash protocol documentation',
    enabled: true,
    lastCrawl: null
  },
  'nostr.com': {
    name: 'Nostr Protocol',
    url: 'https://nostr.com',
    description: 'Decentralized social media protocol',
    enabled: true,
    lastCrawl: null
  }
};

// GET /knowledge/recrawl-sources - Get available recrawl sources
router.get('/recrawl-sources', (req, res) => {
  res.json({
    success: true,
    sources: RECRAWL_SOURCES
  });
});

// POST /knowledge/recrawl-sources - Update recrawl source settings
router.post('/recrawl-sources', (req, res) => {
  const { sources } = req.body;
  
  if (!sources || !Array.isArray(sources)) {
    return res.status(400).json({ error: 'Invalid sources array' });
  }
  
  // Update enabled status for each source
  sources.forEach(source => {
    if (RECRAWL_SOURCES[source.url]) {
      RECRAWL_SOURCES[source.url].enabled = source.enabled;
      if (source.enabled) {
        RECRAWL_SOURCES[source.url].lastCrawl = new Date().toISOString();
      }
    }
  });
  
  res.json({
    success: true,
    message: 'Recrawl sources updated',
    sources: RECRAWL_SOURCES
  });
});

// POST /knowledge/recrawl-all - Recrawl all enabled sources
router.post('/recrawl-all', async (req, res) => {
  try {
    const enabledSources = Object.entries(RECRAWL_SOURCES)
      .filter(([key, source]) => source.enabled)
      .map(([key, source]) => source);
    
    const results = [];
    
    for (const source of enabledSources) {
      try {
        console.log(`Recrawling: ${source.name} (${source.url})`);
        
        // Add to knowledge base for crawling (skip if protected)
        db.get('SELECT status FROM knowledge WHERE url = ?', [source.url], (err, row) => {
          if (err) {
            console.error(`Failed to check ${source.url}:`, err);
            results.push({ url: source.url, success: false, error: err.message });
            return;
          }
          
          // Skip if entry is protected
          if (row && row.status === 'protected') {
            console.log(`Skipping protected entry: ${source.url}`);
            results.push({ url: source.url, success: true, skipped: true, reason: 'protected' });
            return;
          }
          
          // Add or update non-protected entry
        db.run('INSERT OR REPLACE INTO knowledge (url, status) VALUES (?, ?)', 
          [source.url, 'pending'], function(err) {
          if (err) {
            console.error(`Failed to add ${source.url}:`, err);
            results.push({ url: source.url, success: false, error: err.message });
          } else {
            results.push({ url: source.url, success: true, id: this.lastID });
          }
          });
        });
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error recrawling ${source.url}:`, error);
        results.push({ url: source.url, success: false, error: error.message });
      }
    }
    
    res.json({
      success: true,
      message: `Recrawled ${enabledSources.length} sources`,
      results: results
    });
    
  } catch (error) {
    console.error('Recrawl all error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to recrawl sources' 
    });
  }
});

// POST /knowledge/add-source - Add new recrawl source
router.post('/add-source', (req, res) => {
  const { url, name, description } = req.body;
  
  if (!url || !name) {
    return res.status(400).json({ error: 'Missing url or name' });
  }
  
  // Add to recrawl sources
  RECRAWL_SOURCES[url] = {
    name: name,
    url: url,
    description: description || 'User-added source',
    enabled: true,
    lastCrawl: new Date().toISOString()
  };
  
  res.json({
    success: true,
    message: 'Source added successfully',
    source: RECRAWL_SOURCES[url]
  });
});

// GET /knowledge/semantic-search - Enhanced semantic search
router.get('/semantic-search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Get all entries for semantic analysis
    const rows = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, url, content, tags, status FROM knowledge WHERE status = "crawled" AND content IS NOT NULL AND content != "" ORDER BY updatedAt DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Simple semantic scoring based on keyword overlap and relevance
    const scoredResults = rows.map(entry => {
      const content = entry.content.toLowerCase();
      const tags = JSON.parse(entry.tags || '[]');
      const query = q.toLowerCase();
      
      let score = 0;
      
      // Direct keyword matches
      const queryWords = query.split(' ').filter(word => word.length > 2);
      queryWords.forEach(word => {
        if (content.includes(word)) score += 10;
        if (tags.some(tag => tag.includes(word))) score += 15;
      });
      
      // Ecosystem-specific scoring
      const ecosystems = {
        'bitcoin': ['btc', 'satoshi', 'blockchain', 'wallet', 'mining', 'node'],
        'lightning': ['lightning', 'channel', 'payment', 'invoice', 'lnurl', 'lnbits'],
        'nostr': ['nostr', 'relay', 'npub', 'nsec', 'note', 'event', 'client'],
        'cashu': ['cashu', 'ecash', 'mint', 'proof', 'blinded', 'token']
      };
      
      Object.entries(ecosystems).forEach(([ecosystem, keywords]) => {
        if (queryWords.some(word => keywords.includes(word))) {
          if (content.includes(ecosystem) || tags.includes(ecosystem)) {
            score += 20; // Bonus for ecosystem relevance
          }
        }
      });
      
      // URL relevance
      if (entry.url.toLowerCase().includes(query)) score += 5;
      
      return { ...entry, score };
    });

    // Sort by score and return top results
    const topResults = scoredResults
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    res.json({
      success: true,
      results: topResults,
      query: q
    });

  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to perform semantic search' 
    });
  }
});

// POST /knowledge/add-wallet-info - Add wallet information manually (protected from crawls)
router.post('/add-wallet-info', async (req, res) => {
  try {
    const { walletName, lnurlFeatures, description, url, tags } = req.body;
    
    if (!walletName || !lnurlFeatures) {
      return res.status(400).json({ error: 'Wallet name and LNURL features are required' });
    }

    // Create content with LNURL feature information
    const content = `${walletName} - ${description || 'Bitcoin wallet'}

LNURL Features Supported:
${lnurlFeatures.map((feature, index) => `${index + 1}. ${feature}`).join('\n')}

This wallet supports various LNURL protocols for enhanced Lightning Network functionality.`;

    // Insert into database with special status to prevent deletion
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO knowledge (url, status, tags, content, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [
          url || `https://github.com/search?q=${encodeURIComponent(walletName)}`,
          'protected', // Special status to prevent deletion
          JSON.stringify(tags || [walletName.toLowerCase(), 'wallet', 'lightning', 'lnurl']),
          content
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ insertId: this.lastID });
        }
      );
    });

    res.json({
      success: true,
      message: `Added ${walletName} wallet information`,
      id: result.insertId
    });

  } catch (error) {
    console.error('Add wallet info error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to add wallet information' 
    });
  }
});

// GET /knowledge/wallets - Get all wallet information
router.get('/wallets', async (req, res) => {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM knowledge WHERE status = "protected" AND content LIKE "%LNURL Features Supported%" ORDER BY updatedAt DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json({
      success: true,
      wallets: rows
    });

  } catch (error) {
    console.error('Get wallets error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get wallet information' 
    });
  }
});

module.exports = router; 