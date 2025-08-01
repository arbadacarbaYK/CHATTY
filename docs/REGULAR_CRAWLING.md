# Regular Knowledge Base Crawling

This guide explains how to set up automatic regular crawling of the knowledge base to keep it updated with fresh content and tags.

## 🚀 **Quick Setup**

### **1. Manual Regular Crawling**
```bash
# Crawl pending and failed entries
./cron_crawl.sh crawl

# Comprehensive recrawl of all entries
./cron_crawl.sh recrawl

# Check knowledge base stats
./cron_crawl.sh stats
```

### **2. Automated Cron Setup**

#### **Setup Cron Job**
```bash
# Edit crontab
crontab -e

# Add one of these lines:
# Crawl every hour
0 * * * * /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh crawl

# Crawl every 6 hours
0 */6 * * * /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh crawl

# Crawl daily at 2 AM
0 2 * * * /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh crawl

# Comprehensive recrawl weekly
0 3 * * 0 /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh recrawl
```

#### **Check Cron Status**
```bash
# List current cron jobs
crontab -l

# Check cron logs
tail -f /var/log/cron
```

## 📊 **Crawling Strategies**

### **Strategy 1: Regular Crawl (Recommended)**
- **Frequency**: Every 1-6 hours
- **Command**: `./cron_crawl.sh crawl`
- **What it does**: Crawls only pending and failed entries
- **Benefits**: Fast, efficient, keeps failed entries retrying
- **Use case**: Daily maintenance

### **Strategy 2: Comprehensive Recrawl**
- **Frequency**: Weekly or monthly
- **Command**: `./cron_crawl.sh recrawl`
- **What it does**: Recrawls ALL entries and tracks improvements
- **Benefits**: Updates content, finds new tags, improves quality
- **Use case**: Content refresh and quality improvement

### **Strategy 3: Hybrid Approach**
```bash
# Hourly: Regular crawl
0 * * * * /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh crawl

# Weekly: Comprehensive recrawl
0 3 * * 0 /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh recrawl
```

## 🔧 **Configuration**

### **Backend URL**
Edit `cron_crawl.sh` to change the backend URL:
```bash
BACKEND_URL="http://localhost:3000"  # Change if needed
```

### **Log File Location**
Logs are saved to:
```bash
/home/arbadacarba/Downloads/bitcoin-edu-roleplay/logs/cron_crawl.log
```

### **Monitoring**
```bash
# View recent logs
tail -f /home/arbadacarba/Downloads/bitcoin-edu-roleplay/logs/cron_crawl.log

# Check current stats
./cron_crawl.sh stats
```

## 📈 **Performance Monitoring**

### **Success Metrics**
- **Crawl Success Rate**: Should be >90%
- **Error Types**: Monitor for patterns (timeouts, DNS errors)
- **Improvements**: Track content and tag improvements
- **Response Time**: Should be <5 minutes for regular crawl

### **Common Issues**
- **Backend Not Running**: Script will skip crawling
- **Network Timeouts**: Some sites may timeout occasionally
- **Rate Limiting**: Some sites may block frequent requests

## 🛠️ **Troubleshooting**

### **Cron Not Running**
```bash
# Check if cron service is running
sudo systemctl status cron

# Start cron service
sudo systemctl start cron

# Enable cron on boot
sudo systemctl enable cron
```

### **Permission Issues**
```bash
# Make script executable
chmod +x cron_crawl.sh

# Check file permissions
ls -la cron_crawl.sh
```

### **Backend Issues**
```bash
# Check if backend is running
curl -s http://localhost:3000/knowledge/all

# Restart backend if needed
cd backend && npm start
```

## 📋 **Example Cron Jobs**

### **Development Setup**
```bash
# Crawl every 30 minutes during development
*/30 * * * * /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh crawl
```

### **Production Setup**
```bash
# Hourly regular crawl
0 * * * * /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh crawl

# Weekly comprehensive recrawl
0 3 * * 0 /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh recrawl

# Daily stats check
0 9 * * * /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh stats
```

### **High-Frequency Setup**
```bash
# Every 15 minutes
*/15 * * * * /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh crawl

# Every 6 hours comprehensive
0 */6 * * * /home/arbadacarba/Downloads/bitcoin-edu-roleplay/cron_crawl.sh recrawl
```

## 🎯 **Best Practices**

1. **Start Conservative**: Begin with hourly crawls, increase frequency as needed
2. **Monitor Logs**: Check logs regularly for errors and patterns
3. **Backup Database**: Regular backups of the knowledge base
4. **Test Changes**: Test new cron schedules before deploying
5. **Resource Monitoring**: Watch CPU/memory usage during crawls

## 📞 **Support**

If you encounter issues:
1. Check the log file: `tail -f logs/cron_crawl.log`
2. Verify backend is running: `curl http://localhost:3000/knowledge/all`
3. Test manually: `./cron_crawl.sh crawl`
4. Check cron logs: `tail -f /var/log/cron` 