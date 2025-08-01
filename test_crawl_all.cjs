#!/usr/bin/env node

/**
 * Test Crawl All Functionality
 * Tests the enhanced crawl-all endpoint with better timeout handling
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

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

async function testCrawlAll() {
  log('Testing enhanced crawl-all functionality...', 'blue');
  
  try {
    // First, check current state
    const stateResponse = await axios.get(`${BASE_URL}/knowledge/all`, { timeout: 10000 });
    const entries = stateResponse.data.knowledge;
    
    const pendingCount = entries.filter(e => e.status === 'pending').length;
    const failedCount = entries.filter(e => e.status === 'failed').length;
    
    log(`Current state: ${pendingCount} pending, ${failedCount} failed`, 'cyan');
    
    if (pendingCount === 0 && failedCount === 0) {
      log('No pending or failed entries to crawl', 'yellow');
      return;
    }
    
    // Test crawl-all with increased timeout
    log('Starting crawl-all...', 'blue');
    const startTime = Date.now();
    
    const response = await axios.post(`${BASE_URL}/knowledge/crawl-all`, {}, {
      timeout: 120000 // 2 minutes timeout
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const data = response.data;
    
    log(`✅ Crawl-all completed in ${duration}ms`, 'green');
    log(`Message: ${data.message}`, 'cyan');
    
    if (data.summary) {
      const summary = data.summary;
      log(`📊 Summary:`, 'blue');
      log(`   Total: ${summary.total}`, 'cyan');
      log(`   Success: ${summary.success}`, 'green');
      log(`   Errors: ${summary.errors}`, summary.errors === 0 ? 'green' : 'red');
      
      if (summary.errorBreakdown && Object.keys(summary.errorBreakdown).length > 0) {
        log(`   Error Breakdown:`, 'yellow');
        Object.entries(summary.errorBreakdown).forEach(([type, count]) => {
          log(`     ${type}: ${count}`, 'yellow');
        });
      }
    }
    
    if (data.results) {
      log(`\n📋 Results:`, 'blue');
      data.results.forEach((item, index) => {
        const status = item.status === 'success' ? '✅' : '❌';
        log(`   ${index + 1}. ${status} ${item.url}`, item.status === 'success' ? 'green' : 'red');
        if (item.error) {
          log(`      Error: ${item.error}`, 'red');
        }
      });
    }
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      log('❌ Request timed out - crawl-all is taking too long', 'red');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
  }
}

async function testRecrawlAll() {
  log('\nTesting comprehensive recrawl-all...', 'blue');
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(`${BASE_URL}/knowledge/recrawl-all`, {}, {
      timeout: 180000 // 3 minutes timeout
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const data = response.data;
    
    log(`✅ Recrawl-all completed in ${duration}ms`, 'green');
    log(`Message: ${data.message}`, 'cyan');
    
    if (data.summary) {
      const summary = data.summary;
      log(`📊 Summary:`, 'blue');
      log(`   Total: ${summary.total}`, 'cyan');
      log(`   Success: ${summary.success}`, 'green');
      log(`   Errors: ${summary.errors}`, summary.errors === 0 ? 'green' : 'red');
      log(`   Improvements: ${summary.improvements}`, 'magenta');
      
      if (summary.errorBreakdown && Object.keys(summary.errorBreakdown).length > 0) {
        log(`   Error Breakdown:`, 'yellow');
        Object.entries(summary.errorBreakdown).forEach(([type, count]) => {
          log(`     ${type}: ${count}`, 'yellow');
        });
      }
    }
    
    if (data.improvements && data.improvements.length > 0) {
      log(`\n🚀 Improvements Found:`, 'magenta');
      data.improvements.forEach((improvement, index) => {
        log(`   ${index + 1}. ${improvement.url}`, 'cyan');
        if (improvement.tagImprovement) {
          log(`      Tags: ${improvement.oldTags} → ${improvement.newTags}`, 'green');
        }
        if (improvement.contentImprovement) {
          log(`      Content: ${improvement.oldContentLength} → ${improvement.newContentLength} chars`, 'green');
        }
      });
    }
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      log('❌ Request timed out - recrawl-all is taking too long', 'red');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
  }
}

async function main() {
  log('========================================', 'cyan');
  log('  Enhanced Crawl Testing', 'bright');
  log('========================================', 'cyan');
  
  await testCrawlAll();
  await testRecrawlAll();
  
  log('\n========================================', 'cyan');
  log('  Test Complete', 'bright');
  log('========================================', 'cyan');
}

if (require.main === module) {
  main().catch(console.error);
} 