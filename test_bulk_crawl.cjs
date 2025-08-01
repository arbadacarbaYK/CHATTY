#!/usr/bin/env node

/**
 * Comprehensive Bulk Crawling Test Script
 * Tests all knowledgebase crawling functionality with detailed analysis
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test URLs for different scenarios
const TEST_URLS = [
  // Bitcoin-related sites
  'https://greatbitcoin.news',
  'https://bitcoin.stackexchange.com',
  'https://bitcoinops.org',
  'https://lightning.network',
  'https://lightning.engineering',
  'https://lnbits.com',
  'https://nostr.com',
  'https://cashu.space',
  
  // GitHub repositories
  'https://github.com/bitcoin/bitcoin',
  'https://github.com/lightningnetwork/lnd',
  'https://github.com/lnbits/lnbits',
  
  // Social media (should fail gracefully)
  'https://twitter.com/bitcoin',
  'https://x.com/bitcoin',
  
  // Documentation sites
  'https://developer.greatbitcoin.news',
  'https://docs.lightning.engineering',
  
  // Invalid URLs (for error testing)
  'https://invalid-domain-that-does-not-exist-12345.com',
  'https://greatbitcoin.news/nonexistent-page-12345'
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logSubsection(title) {
  log(`\n${'-'.repeat(40)}`, 'yellow');
  log(`  ${title}`, 'yellow');
  log(`${'-'.repeat(40)}`, 'yellow');
}

async function testEndpoint(endpoint, method = 'GET', data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      timeout: 30000
    };
    
    if (data) {
      config.headers = { 'Content-Type': 'application/json' };
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

async function clearKnowledgeBase() {
  logSection('Clearing Knowledge Base');
  
  // WARNING: This will clear ALL knowledge base entries!
  // Only run this in test environments, never in production
  log(`${colors.yellow}⚠️  WARNING: This will delete ALL knowledge base entries!${colors.reset}`, 'yellow');
  log(`${colors.yellow}⚠️  Only run this in test environments, never in production!${colors.reset}`, 'yellow');
  
  // Check if we're in a safe environment (optional)
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    log(`${colors.red}❌ ABORTED: Cannot clear knowledge base in production environment!${colors.reset}`, 'red');
    return false;
  }
  
  const result = await testEndpoint('/knowledge/clear', 'DELETE');
  if (result.success) {
    log(`✅ Knowledge base cleared. Deleted ${result.data.deleted} entries.`, 'green');
    return true;
  } else {
    log(`❌ Failed to clear knowledge base: ${result.error}`, 'red');
    return false;
  }
}

async function addTestUrls() {
  logSection('Adding Test URLs');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const url of TEST_URLS) {
    const result = await testEndpoint('/knowledge/add', 'POST', { url });
    
    if (result.success) {
      log(`✅ Added: ${url}`, 'green');
      successCount++;
    } else {
      log(`❌ Failed to add ${url}: ${result.error}`, 'red');
      errorCount++;
    }
  }
  
  log(`\n📊 Summary: ${successCount} added successfully, ${errorCount} failed`, 'blue');
  return successCount;
}

async function testSingleCrawl() {
  logSection('Testing Single Entry Crawling');
  
  const testUrl = 'https://greatbitcoin.news';
  log(`Testing single crawl for: ${testUrl}`);
  
  const result = await testEndpoint('/knowledge/crawl-single', 'POST', { url: testUrl });
  
  if (result.success) {
    log(`✅ Single crawl successful!`, 'green');
    log(`   Tags: ${JSON.stringify(result.data.tags)}`, 'cyan');
    log(`   Preview: ${result.data.preview.substring(0, 100)}...`, 'cyan');
    log(`   Title: ${result.data.title}`, 'cyan');
  } else {
    log(`❌ Single crawl failed: ${result.error}`, 'red');
  }
  
  return result.success;
}

async function testCrawlAll() {
  logSection('Testing Crawl All (Pending/Failed)');
  
  const result = await testEndpoint('/knowledge/crawl-all', 'POST');
  
  if (result.success) {
    log(`✅ Crawl all completed!`, 'green');
    log(`   Message: ${result.data.message}`, 'cyan');
    
    if (result.data.summary) {
      const summary = result.data.summary;
      log(`   Total: ${summary.total}`, 'cyan');
      log(`   Success: ${summary.success}`, 'green');
      log(`   Errors: ${summary.errors}`, 'red');
      
      if (summary.errorBreakdown) {
        log(`   Error Breakdown:`, 'yellow');
        Object.entries(summary.errorBreakdown).forEach(([type, count]) => {
          log(`     ${type}: ${count}`, 'yellow');
        });
      }
    }
    
    if (result.data.results) {
      log(`\n📋 Detailed Results:`, 'blue');
      result.data.results.forEach((item, index) => {
        const status = item.status === 'success' ? '✅' : '❌';
        log(`   ${index + 1}. ${status} ${item.url}`, item.status === 'success' ? 'green' : 'red');
        if (item.error) {
          log(`      Error: ${item.error}`, 'red');
        }
      });
    }
  } else {
    log(`❌ Crawl all failed: ${result.error}`, 'red');
  }
  
  return result.success;
}

async function testRecrawlAll() {
  logSection('Testing Comprehensive Recrawl All');
  
  const result = await testEndpoint('/knowledge/recrawl-all', 'POST');
  
  if (result.success) {
    log(`✅ Recrawl all completed!`, 'green');
    log(`   Message: ${result.data.message}`, 'cyan');
    
    if (result.data.summary) {
      const summary = result.data.summary;
      log(`   Total: ${summary.total}`, 'cyan');
      log(`   Success: ${summary.success}`, 'green');
      log(`   Errors: ${summary.errors}`, 'red');
      log(`   Improvements: ${summary.improvements}`, 'magenta');
      
      if (summary.errorBreakdown) {
        log(`   Error Breakdown:`, 'yellow');
        Object.entries(summary.errorBreakdown).forEach(([type, count]) => {
          log(`     ${type}: ${count}`, 'yellow');
        });
      }
    }
    
    if (result.data.improvements && result.data.improvements.length > 0) {
      log(`\n🚀 Improvements Found:`, 'magenta');
      result.data.improvements.forEach((improvement, index) => {
        log(`   ${index + 1}. ${improvement.url}`, 'cyan');
        if (improvement.tagImprovement) {
          log(`      Tags: ${improvement.oldTags} → ${improvement.newTags}`, 'green');
        }
        if (improvement.contentImprovement) {
          log(`      Content: ${improvement.oldContentLength} → ${improvement.newContentLength} chars`, 'green');
        }
      });
    }
  } else {
    log(`❌ Recrawl all failed: ${result.error}`, 'red');
  }
  
  return result.success;
}

async function analyzeCurrentState() {
  logSection('Analyzing Current Knowledge Base State');
  
  const result = await testEndpoint('/knowledge/all', 'GET');
  
  if (result.success) {
    const entries = result.data.knowledge;
    log(`📊 Total entries: ${entries.length}`, 'blue');
    
    // Group by status
    const statusCounts = {};
    const errorTypes = {};
    
    entries.forEach(entry => {
      statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;
      
      if (entry.errorMsg) {
        // Simple error type classification
        const error = entry.errorMsg.toLowerCase();
        let errorType = 'UNKNOWN';
        
        if (error.includes('timeout')) errorType = 'TIMEOUT';
        else if (error.includes('connection')) errorType = 'CONNECTION';
        else if (error.includes('dns')) errorType = 'DNS';
        else if (error.includes('ssl')) errorType = 'SSL';
        else if (error.includes('blocked')) errorType = 'BLOCKED';
        
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      }
    });
    
    log(`\n📈 Status Distribution:`, 'cyan');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const color = status === 'crawled' ? 'green' : status === 'pending' ? 'yellow' : 'red';
      log(`   ${status}: ${count}`, color);
    });
    
    if (Object.keys(errorTypes).length > 0) {
      log(`\n❌ Error Types:`, 'red');
      Object.entries(errorTypes).forEach(([type, count]) => {
        log(`   ${type}: ${count}`, 'red');
      });
    }
    
    // Show some sample entries
    log(`\n📋 Sample Entries:`, 'blue');
    entries.slice(0, 5).forEach((entry, index) => {
      const status = entry.status === 'crawled' ? '✅' : entry.status === 'pending' ? '⏳' : '❌';
      log(`   ${index + 1}. ${status} ${entry.url}`, entry.status === 'crawled' ? 'green' : entry.status === 'pending' ? 'yellow' : 'red');
      if (entry.tags) {
        const tags = JSON.parse(entry.tags);
        log(`      Tags: ${tags.join(', ')}`, 'cyan');
      }
      if (entry.content) {
        log(`      Content: ${entry.content.substring(0, 80)}...`, 'cyan');
      }
    });
  } else {
    log(`❌ Failed to get knowledge base state: ${result.error}`, 'red');
  }
}

async function testSearch() {
  logSection('Testing Search Functionality');
  
  const searchTerms = ['bitcoin', 'lightning', 'nostr', 'wallet'];
  
  for (const term of searchTerms) {
    log(`Searching for: "${term}"`);
    const result = await testEndpoint(`/knowledge/search?q=${encodeURIComponent(term)}`, 'GET');
    
    if (result.success) {
      const count = result.data.results.length;
      log(`   Found ${count} results`, count > 0 ? 'green' : 'yellow');
      
      if (count > 0) {
        result.data.results.slice(0, 2).forEach((item, index) => {
          log(`     ${index + 1}. ${item.url}`, 'cyan');
        });
      }
    } else {
      log(`   ❌ Search failed: ${result.error}`, 'red');
    }
  }
}

async function performanceTest() {
  logSection('Performance Test - Multiple Concurrent Crawls');
  
  const testUrls = [
    'https://greatbitcoin.news',
    'https://lightning.network',
    'https://nostr.com'
  ];
  
  log(`Testing ${testUrls.length} concurrent single crawls...`);
  
  const startTime = Date.now();
  const promises = testUrls.map(url => 
    testEndpoint('/knowledge/crawl-single', 'POST', { url })
  );
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;
  
  log(`⏱️  Performance Results:`, 'blue');
  log(`   Duration: ${duration}ms`, 'cyan');
  log(`   Success: ${successCount}/${testUrls.length}`, successCount === testUrls.length ? 'green' : 'yellow');
  log(`   Errors: ${errorCount}`, errorCount === 0 ? 'green' : 'red');
  log(`   Average time per request: ${Math.round(duration / testUrls.length)}ms`, 'cyan');
}

async function runAllTests() {
  logSection('STARTING COMPREHENSIVE BULK CRAWLING TEST');
  
  try {
    // Step 1: Clear and prepare (with safety check)
    const cleared = await clearKnowledgeBase();
    if (!cleared) {
      log(`${colors.red}❌ Test aborted due to safety check!${colors.reset}`, 'red');
      return;
    }
    
    // Step 2: Add test URLs
    const addedCount = await addTestUrls();
    
    // Step 3: Analyze initial state
    await analyzeCurrentState();
    
    // Step 4: Test single crawl
    await testSingleCrawl();
    
    // Step 5: Test crawl all
    await testCrawlAll();
    
    // Step 6: Test comprehensive recrawl
    await testRecrawlAll();
    
    // Step 7: Test search functionality
    await testSearch();
    
    // Step 8: Performance test
    await performanceTest();
    
    // Step 9: Final analysis
    logSubsection('Final Analysis');
    await analyzeCurrentState();
    
    logSection('TEST COMPLETED SUCCESSFULLY');
    log(`✅ All tests completed! Check the results above for detailed analysis.`, 'green');
    
  } catch (error) {
    log(`❌ Test failed with error: ${error.message}`, 'red');
    console.error(error);
  }
}

// Main execution
if (require.main === module) {
  runAllTests().then(() => {
    process.exit(0);
  }).catch((error) => {
    log(`❌ Test suite failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = {
  testEndpoint,
  clearKnowledgeBase,
  addTestUrls,
  testSingleCrawl,
  testCrawlAll,
  testRecrawlAll,
  analyzeCurrentState,
  testSearch,
  performanceTest,
  runAllTests
}; 