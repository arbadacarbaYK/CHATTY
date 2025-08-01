# Resource Management for Regular Crawling

This document explains how the knowledge base crawling system manages resources efficiently to avoid overwhelming your local machine or web server.

## 🎯 **Resource Management Strategy**

### **1. Sequential Processing**
- **No Concurrent Crawls**: All crawls are processed sequentially, not in parallel
- **1-Second Delays**: Each crawl waits 1 second between requests
- **Memory Efficient**: Only one browser instance at a time
- **CPU Friendly**: Prevents overwhelming the system

### **2. Smart Browser Management**
```javascript
// Browser settings for efficiency
const browser = await puppeteer.launch({
  headless: true,                    // No GUI needed
  args: [
    '--no-sandbox',                  // Faster startup
    '--disable-setuid-sandbox',      // Security bypass for speed
    '--disable-dev-shm-usage',       // Use system memory efficiently
    '--disable-accelerated-2d-canvas', // Reduce GPU usage
    '--no-first-run',                // Skip first-run setup
    '--no-zygote',                   // Faster process creation
    '--disable-gpu'                  // No GPU acceleration needed
  ]
});
```

### **3. Timeout Management**
- **Navigation Timeout**: 20 seconds per page
- **Body Selector Timeout**: 10 seconds for content extraction
- **Overall Request Timeout**: 30 seconds maximum
- **Automatic Cleanup**: Browser instances are closed after each crawl

## 📊 **Resource Usage Patterns**

### **Local Development (4-core system)**
```
Memory Usage: ~150-200MB per crawl
CPU Usage: ~15-25% during crawl
Duration: ~3-5 seconds per URL
Concurrent: 1 browser instance
```

### **Web Server (8+ core system)**
```
Memory Usage: ~200-300MB per crawl
CPU Usage: ~10-20% during crawl
Duration: ~2-4 seconds per URL
Concurrent: 1 browser instance
```

## ⚡ **Optimization Features**

### **1. Content Length Limits**
- **Max Content**: 300 characters per entry
- **Sentence Limit**: 3 meaningful sentences
- **Tag Limit**: 15 tags maximum
- **Smart Truncation**: Preserves readability

### **2. Error Handling**
- **Quick Failures**: Timeout after 20 seconds
- **Error Classification**: Prevents retry loops
- **Graceful Degradation**: Continues with next URL on error

### **3. Memory Management**
- **Browser Cleanup**: Each browser instance is properly closed
- **Garbage Collection**: Automatic memory cleanup
- **No Memory Leaks**: Proper resource disposal

## 🔄 **Regular Crawling Strategies**

### **Strategy 1: Lightweight Regular Crawl**
```bash
# Runs every hour - minimal resource usage
./cron_crawl.sh crawl

# Resource Impact:
# - Duration: 2-5 minutes
# - Memory: ~200MB peak
# - CPU: ~20% peak
# - Network: ~50-100 requests
```

### **Strategy 2: Comprehensive Recrawl**
```bash
# Runs weekly - moderate resource usage
./cron_crawl.sh recrawl

# Resource Impact:
# - Duration: 10-30 minutes
# - Memory: ~300MB peak
# - CPU: ~25% peak
# - Network: ~100-200 requests
```

### **Strategy 3: Hybrid Approach**
```bash
# Hourly: Lightweight crawl
0 * * * * /path/to/cron_crawl.sh crawl

# Weekly: Comprehensive recrawl
0 3 * * 0 /path/to/cron_crawl.sh recrawl
```

## 🛡️ **Protection Mechanisms**

### **1. Backend Health Check**
```bash
# Script checks if backend is running before crawling
if ! curl -s "$BACKEND_URL/knowledge/all" > /dev/null; then
    log "Backend not running, skipping crawl"
    exit 1
fi
```

### **2. Resource Monitoring**
- **Process Monitoring**: Checks if processes are still alive
- **Memory Monitoring**: Tracks memory usage
- **Timeout Protection**: Prevents hanging processes
- **Auto-Restart**: Restarts failed processes

### **3. Error Recovery**
- **Retry Logic**: Only for transient errors (timeout, DNS)
- **Skip Failed**: Permanent failures are skipped
- **Logging**: All errors are logged for analysis
- **Graceful Degradation**: Continues with remaining URLs

## 📈 **Performance Monitoring**

### **Success Metrics**
```
Target Success Rate: >90%
Target Duration: <5 minutes for regular crawl
Target Memory: <300MB peak
Target CPU: <25% peak
```

### **Monitoring Commands**
```bash
# Check current resource usage
./cron_crawl.sh stats

# Monitor logs
tail -f logs/cron_crawl.log

# Check system resources
htop
free -h
```

## 🎛️ **Configuration Options**

### **Adjustable Timeouts**
```bash
# In knowledge.js - modify these values:
const NAVIGATION_TIMEOUT = 20000;  // 20 seconds
const BODY_TIMEOUT = 10000;        // 10 seconds
const DELAY_BETWEEN_CRAWLS = 1000; // 1 second
```

### **Memory Optimization**
```bash
# Browser launch arguments for lower memory usage:
'--disable-dev-shm-usage'     // Use system memory
'--disable-accelerated-2d-canvas' // Reduce GPU memory
'--no-zygote'                 // Faster process creation
```

### **CPU Optimization**
```bash
# Reduce CPU usage:
'--disable-gpu'               // No GPU acceleration
'--no-sandbox'                // Faster startup
'--disable-setuid-sandbox'    // Security bypass for speed
```

## 🚨 **Troubleshooting Resource Issues**

### **High Memory Usage**
```bash
# Check memory usage
free -h

# Restart services if needed
./start.sh restart

# Monitor browser processes
ps aux | grep chrome
```

### **High CPU Usage**
```bash
# Check CPU usage
htop

# Reduce crawl frequency
# Change from hourly to every 6 hours
0 */6 * * * /path/to/cron_crawl.sh crawl
```

### **Network Issues**
```bash
# Check network connectivity
curl -s http://localhost:3000/knowledge/all

# Reduce timeout values in knowledge.js
# NAVIGATION_TIMEOUT = 15000  // 15 seconds
```

## 📋 **Best Practices**

### **1. Start Conservative**
- Begin with hourly crawls
- Monitor resource usage
- Increase frequency gradually
- Watch for patterns in errors

### **2. Monitor Regularly**
- Check logs daily
- Monitor system resources
- Track success rates
- Analyze error patterns

### **3. Scale Appropriately**
- **Development**: Every 6 hours
- **Production**: Every hour
- **High-Traffic**: Every 30 minutes
- **Critical**: Every 15 minutes

### **4. Backup Strategy**
- Regular database backups
- Log rotation
- Error monitoring
- Performance tracking

## 🔧 **Advanced Configuration**

### **Custom Resource Limits**
```bash
# Set memory limits for Node.js
export NODE_OPTIONS="--max-old-space-size=512"

# Set CPU limits
# Use nice command for lower priority
nice -n 10 ./cron_crawl.sh crawl
```

### **Load Balancing**
```bash
# For high-traffic servers, consider:
# - Multiple backend instances
# - Load balancer
# - Database clustering
# - CDN for static content
```

The system is designed to be resource-efficient while maintaining high-quality crawling results. The sequential processing and smart timeout management ensure that your system won't be overwhelmed, even with regular automated crawling. 