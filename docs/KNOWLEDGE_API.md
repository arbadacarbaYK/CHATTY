# Knowledge Base API Documentation

## Overview

The Knowledge Base API provides comprehensive web crawling functionality for Bitcoin-related content. All crawling operations use a **unified crawling engine** that provides consistent, high-quality results regardless of the endpoint used.

## 🎯 **Unified Crawling Logic**

**All endpoints use the same enhanced `crawlUrl()` function**, ensuring consistent results:

- **Single crawl** (`/crawl-single`)
- **Batch crawl** (`/crawl-all`) 
- **Comprehensive recrawl** (`/recrawl-all`)

This means you get the same great results with enhanced error handling, improved tag extraction, and specialized content processing regardless of how you trigger the crawl.

## 🔧 **Enhanced Features**

### **Smart Content Extraction**
- **GitHub**: Specialized README and repository content extraction
- **Twitter/X**: Graceful handling with metadata focus
- **Bitcoin Sites**: Optimized for Bitcoin-related content
- **General Sites**: Improved text extraction with better cleaning

### **Intelligent Tag Detection**
- **Ecosystem-Aware**: Automatically detects Bitcoin, Lightning, Nostr, and Cashu ecosystems
- **Search Word Mapping**: Maps technical terms to appropriate ecosystem tags
- **Cross-Ecosystem Recognition**: Lightning wallets get both `lightning` and `bitcoin` tags
- **Bidirectional Normalization**: Handles NWC/Nostr Wallet Connect and eCash/Cashu variations

### **Protected Wallet Information**
- **LNURL Wallet Database**: Comprehensive wallet information with LNURL feature lists
- **Protected Status**: Wallet entries use `status: "protected"` to prevent deletion by regular crawls
- **Detailed Feature Lists**: Each wallet includes specific LNURL protocols it supports
- **Easy Management**: Add new wallets via API without affecting regular crawling
- **Wallet Comparison Guides**: Includes comprehensive wallet comparison resources like Darthcoin's Lightning Wallets Comparison guide
- **44 Protected Wallets**: Complete LNURL LUDS overview with all wallet implementations
- **Hardware Projects**: LNbits hardware building guide with detailed project instructions
- **21 Individual Hardware Projects**: Separate protected entries for each LNbits hardware project including Nostr Signing Device, Arcade Machine, Zap Lamp, Gerty, ATM, Coins Only, Big (FOSSA) ATM, The Bat-ATM 🦇, LNPoS Terminal, POS with NFC, Lightning Piggy, Hardware Wallet, Bitcoin Switch, Vending Machine, More Fun Projects, A watch - but cooler, Bolty, Nerdminer, Bitcoin Ticker, BTClock, and LoRa
- **Ereignishorizont Hardware**: Additional hardware projects including LNPoS terminals, Bitcoin switches, and ATM hardware
- **Enhanced Google Groups Crawling**: Improved content extraction for Google Groups with better UI element filtering
- **Context-Aware Chat**: AI uses general knowledge + knowledge base sources, displays context links below chat bubbles

### **Semantic Search Enhancement**
- **Intelligent Scoring**: Prioritizes results based on ecosystem relevance and keyword overlap
- **Better Findability**: Improves content discovery for complex queries
- **Ecosystem-Specific Scoring**: Bonus points for ecosystem-relevant content

### **Enhanced Error Classification**
- **TIMEOUT**: Navigation or connection timeouts
- **DNS_ERROR**: Domain resolution failures  
- **CONNECTION_REFUSED**: Server connection issues
- **SSL_ERROR**: Certificate problems
- **BLOCKED**: Anti-bot protection
- **INVALID_URL**: Malformed URLs

### **Environment-Based Security Controls**
- **Production Mode**: Users can add links but cannot crawl, recrawl, or delete entries
- **Development Mode**: Full administrative control including individual and bulk operations
- **Shared Database**: Both modes use the same database and logic
- **Protected Entries**: Wallet information is protected from deletion in both modes
- **Environment Detection**: Automatic UI adaptation based on `NODE_ENV` setting

### **Improved Tag Extraction**
- **Expanded Keywords**: Bitcoin, Lightning, Nostr, blockchain, cryptocurrency, defi, etc.
- **Better Filtering**: Improved word filtering and meaningful content detection
- **Context-Aware**: Different handling for social media vs. documentation sites

## 📋 **API Endpoints**

### **1. Add URL for Crawling**
```http
POST /knowledge/add
Content-Type: application/json

{
  "url": "https://greatbitcoin.news",
  "content": "optional content",
  "tags": ["optional", "tags"]
}
```

**Response:**
```json
{
  "success": true,
  "id": 1
}
```

### **2. Crawl Single Entry**
```http
POST /knowledge/crawl-single
Content-Type: application/json

{
  "url": "https://lnbits.com
}
```

**Response:**
```json
{
  "success": true,
  "tags": ["lightning", "wallet", "lnbits", "bitcoin", "api", "extension"],
  "preview": "LNbits is a free and open-source Lightning wallet and accounts system...",
  "title": "LNbits - Lightning Network Bitcoin wallet",
  "description": "LNbits is a free and open-source Lightning wallet and accounts system"
}
```

### **3. Crawl All Pending & Failed Entries**
```http
POST /knowledge/crawl-all
```

**Response:**
```json
{
  "success": true,
  "message": "Crawled 16 entries successfully, 1 errors",
  "results": [
    {
      "url": "https://greatbitcoin.news",
      "status": "success"
    },
    {
      "url": "https://invalid-domain.com",
      "status": "error",
      "error": "net::ERR_NAME_NOT_RESOLVED",
      "errorType": "DNS_ERROR"
    }
  ],
  "errorTypes": {
    "DNS_ERROR": 1
  },
  "summary": {
    "total": 17,
    "success": 16,
    "errors": 1,
    "errorBreakdown": {
      "DNS_ERROR": 1
    }
  }
}
```

### **4. Comprehensive Recrawl All Entries**
```http
POST /knowledge/recrawl-all
```

**Response:**
```json
{
  "success": true,
  "message": "Recrawled 16 entries successfully, 1 errors",
  "results": [
    {
      "url": "https://greatbitcoin.news",
      "status": "success",
      "improvements": {
        "tagImprovement": true,
        "contentImprovement": false
      }
    }
  ],
  "improvements": [
    {
      "url": "https://docs.lightning.engineering",
      "tagImprovement": true,
      "contentImprovement": true,
      "oldTags": 3,
      "newTags": 8,
      "oldContentLength": 300,
      "newContentLength": 302
    }
  ],
  "summary": {
    "total": 17,
    "success": 16,
    "errors": 1,
    "improvements": 1,
    "errorBreakdown": {
      "DNS_ERROR": 1
    }
  }
}
```

### **5. Get All Knowledge Entries**
```http
GET /knowledge/all
```

**Response:**
```json
{
  "knowledge": [
    {
      "id": 1,
      "url": "https://lnbits.com",
      "status": "crawled",
      "tags": "[\"lightning\",\"wallet\",\"lnbits\",\"bitcoin\",\"api\",\"extension\"]",
      "content": "LNbits is a free and open-source Lightning wallet and accounts system...",
      "errorMsg": null,
      "updatedAt": "2025-08-01 15:30:45"
    }
  ]
}
```

### **6. Search Knowledge Base**
```http
GET /knowledge/search?q=lightning
```

**Response:**
```json
{
  "results": [
    {
      "id": 1,
      "url": "https://lnbits.com",
      "status": "crawled",
      "tags": "[\"lightning\",\"wallet\",\"lnbits\",\"bitcoin\"]",
      "content": "LNbits is a free and open-source Lightning wallet...",
      "updatedAt": "2025-08-01 15:30:45"
    }
  ]
}
```

### **7. Remove Entry**
```http
DELETE /knowledge/remove
Content-Type: application/json

{
  "url": "https://lnbits.com"
}
```

**Response:**
```json
{
  "success": true,
  "deleted": true
}
```

### **8. Clear All Knowledge**
```http
DELETE /knowledge/clear
```

**Response:**
```json
{
  "success": true,
  "deleted": 17
}
```

### **9. Semantic Search (Enhanced)**
```http
GET /knowledge/semantic-search?q=wallet
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": 1,
      "url": "https://github.com/lnbits/lnbits",
      "score": 50,
      "tags": "[\"lightning\",\"wallet\",\"lnbits\",\"bitcoin\",\"api\"]",
      "content": "LNbits - Free and open-source Lightning wallet and accounts system...",
      "status": "crawled"
    }
  ],
  "query": "wallet"
}
```

### **10. Add Wallet Information (Protected)**
```http
POST /knowledge/add-wallet-info
Content-Type: application/json

{
  "walletName": "LNbits",
  "lnurlFeatures": [
    "Base LNURL encoding and decoding",
    "Withdraw request",
    "Auth",
    "Pay request",
    "Success action field"
  ],
  "description": "Free and open-source Lightning wallet and accounts system",
  "url": "https://github.com/lnbits/lnbits",
  "tags": ["lnbits", "wallet", "lightning", "lnurl", "bitcoin", "api"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Added Blixt wallet information",
  "id": 1
}
```

### **11. Get All Wallet Information**
```http
GET /knowledge/wallets
```

**Response:**
```json
{
  "success": true,
  "wallets": [
    {
      "id": 1,
      "url": "https://github.com/lnbits/lnbits",
      "status": "protected",
      "tags": "[\"lnbits\",\"wallet\",\"lightning\",\"lnurl\",\"bitcoin\",\"api\"]",
      "content": "LNbits - Free and open-source Lightning wallet and accounts system\n\nLNURL Features Supported:\n1. Base LNURL encoding and decoding\n2. Withdraw request\n3. Auth\n4. Pay request\n5. Success action field\n\nThis wallet supports various LNURL protocols for enhanced Lightning Network functionality.",
      "updatedAt": "2025-08-01 15:30:45"
    }
  ]
}
```

## 🚀 **Usage Examples**

### **Quick Single Crawl**
```bash
curl -X POST http://localhost:3000/knowledge/crawl-single \
  -H "Content-Type: application/json" \
  -d '{"url": "https://lnbits.com"}'
```

### **Batch Crawl All Pending/Failed**
```bash
curl -X POST http://localhost:3000/knowledge/crawl-all
```

### **Comprehensive Recrawl with Improvements**
```bash
curl -X POST http://localhost:3000/knowledge/recrawl-all
```

### **Search for Lightning Content**
```bash
curl -X GET "http://localhost:3000/knowledge/search?q=lightning"
```

### **Semantic Search for Wallets**
```bash
curl -X GET "http://localhost:3000/knowledge/semantic-search?q=wallet"
```

### **Add Protected Wallet Information**
```bash
curl -X POST http://localhost:3000/knowledge/add-wallet-info \
  -H "Content-Type: application/json" \
  -d '{
    "walletName": "LNbits",
    "lnurlFeatures": ["Base LNURL encoding", "Withdraw request", "Pay request"],
    "description": "Free and open-source Lightning wallet",
    "url": "https://github.com/lnbits/lnbits",
    "tags": ["lnbits", "wallet", "lightning", "lnurl", "bitcoin", "api"]
  }'
```

### **Get All Wallet Information**
```bash
curl -X GET "http://localhost:3000/knowledge/wallets"
```

## 📊 **Status Types**

- **`pending`**: New entries waiting to be crawled
- **`crawled`**: Successfully crawled entries with content and tags
- **`failed`**: Entries that failed to crawl (with error message)

## 🔍 **Error Types**

- **`TIMEOUT`**: Navigation or connection timeouts
- **`DNS_ERROR`**: Domain resolution failures
- **`CONNECTION_REFUSED`**: Server connection issues
- **`SSL_ERROR`**: Certificate problems
- **`BLOCKED`**: Anti-bot protection
- **`INVALID_URL`**: Malformed URLs

## ⚡ **Performance Characteristics**

### **Single Crawl Performance**
- **Average Time**: ~3.6 seconds per URL
- **Success Rate**: ~94% (varies by site type)
- **Error Handling**: Comprehensive error classification

### **Batch Crawl Performance**
- **Concurrent Processing**: Sequential with 1-second delays
- **Timeout**: 2 minutes for crawl-all, 3 minutes for recrawl-all
- **Memory Usage**: Optimized browser instances

### **Content Quality**
- **Tag Extraction**: 2-3 tags → 10-11 tags (improved)
- **Content Length**: 300 character limit with smart truncation
- **Specialized Handling**: GitHub, Twitter/X, Bitcoin sites

## 🧪 **Testing**

### **Comprehensive Test Suite**
```bash
node test_bulk_crawl.cjs
```

### **Focused Crawl Testing**
```bash
node test_crawl_all.cjs
```

## 🔧 **Configuration**

### **Browser Settings**
- **Headless Mode**: Enabled for server environments
- **User Agent**: Realistic Chrome browser
- **Viewport**: 1280x720 for consistent rendering
- **Headers**: Anti-detection headers included

### **Timeout Settings**
- **Navigation Timeout**: 20 seconds default
- **Body Selector Timeout**: 10 seconds
- **GitHub Wait Time**: 3 seconds for dynamic content

### **Content Processing**
- **Max Content Length**: 300 characters
- **Sentence Limit**: 3 meaningful sentences
- **Tag Limit**: 15 tags maximum
- **Word Filtering**: Enhanced stop word removal

## 📈 **Monitoring & Analytics**

### **Success Metrics**
- **Crawl Success Rate**: Tracked per endpoint
- **Error Breakdown**: Detailed error type analysis
- **Performance Timing**: Request duration tracking
- **Improvement Tracking**: Tag and content enhancement metrics

### **Quality Metrics**
- **Tag Quality**: Number and relevance of extracted tags
- **Content Quality**: Length and meaningfulness of content
- **Error Recovery**: Retry logic for transient failures

## 🎯 **Best Practices**

1. **Use Single Crawl** for immediate results
2. **Use Crawl-All** for batch processing of pending/failed entries
3. **Use Recrawl-All** for comprehensive updates and improvements
4. **Monitor Error Types** to identify systematic issues
5. **Check Improvements** to track content quality enhancements

## 🔄 **Unified Logic Guarantee**

**All crawling operations use the same enhanced engine**, ensuring:

✅ **Consistent Results**: Same quality regardless of endpoint  
✅ **Enhanced Error Handling**: Proper classification and retry logic  
✅ **Improved Tag Extraction**: Better keyword detection  
✅ **Specialized Content Processing**: Site-specific optimizations  
✅ **Robust Browser Handling**: Anti-detection measures  

This means you get the same great results whether you crawl one URL or a thousand!

## 🌐 **Environment Endpoints**

### **Get Environment Information**
```http
GET /api/environment
```

**Response:**
```json
{
  "environment": "development"
}
```

**Purpose**: Frontend uses this to determine which UI controls to show:
- **Production**: Only "Add Links" functionality
- **Development**: Full admin controls (crawl, recrawl, delete)

## 📅 **Regular Crawling & Automation**

For automated knowledge base maintenance, see **[REGULAR_CRAWLING.md](./REGULAR_CRAWLING.md)** for:

- **Cron Job Setup**: Automated scheduling options
- **Resource Management**: Efficient crawling strategies
- **Monitoring**: Log files and performance tracking
- **Troubleshooting**: Common issues and solutions

The regular crawling system is designed to keep your knowledge base updated without overwhelming resources. 