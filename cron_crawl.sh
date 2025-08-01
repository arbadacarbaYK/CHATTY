#!/bin/bash

# Bitcoin Education Roleplay - Regular Knowledge Base Crawling
# This script can be run via cron for regular crawling of pending/failed entries
# Documentation: ./docs/REGULAR_CRAWLING.md

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:3000"
LOG_FILE="/home/arbadacarba/Downloads/bitcoin-edu-roleplay/logs/cron_crawl.log"
PID_FILE="/home/arbadacarba/Downloads/bitcoin-edu-roleplay/pids/cron_crawl.pid"

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$PID_FILE")"

# Function to log messages
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if backend is running
check_backend() {
    if ! curl -s "$BACKEND_URL/knowledge/all" > /dev/null; then
        log "${RED}Backend is not running. Skipping crawl.${NC}"
        return 1
    fi
    return 0
}

# Crawl pending and failed entries
crawl_pending_failed() {
    log "${GREEN}Starting regular crawl of pending/failed entries...${NC}"
    
    response=$(curl -s -X POST "$BACKEND_URL/knowledge/crawl-all")
    
    if [ $? -eq 0 ]; then
        success=$(echo "$response" | jq -r '.summary.success // 0')
        errors=$(echo "$response" | jq -r '.summary.errors // 0')
        total=$(echo "$response" | jq -r '.summary.total // 0')
        
        log "${GREEN}✅ Crawl completed: $success successful, $errors errors (total: $total)${NC}"
        
        # Log error breakdown if any
        if [ "$errors" -gt 0 ]; then
            error_types=$(echo "$response" | jq -r '.errorTypes // {}' | jq -r 'to_entries | map("\(.key): \(.value)") | join(", ")')
            log "${YELLOW}⚠️  Error breakdown: $error_types${NC}"
        fi
    else
        log "${RED}❌ Crawl failed: Backend error${NC}"
        return 1
    fi
}

# Recrawl all entries (for comprehensive updates)
recrawl_all() {
    log "${GREEN}Starting comprehensive recrawl of all entries...${NC}"
    
    response=$(curl -s -X POST "$BACKEND_URL/knowledge/recrawl-all")
    
    if [ $? -eq 0 ]; then
        success=$(echo "$response" | jq -r '.summary.success // 0')
        errors=$(echo "$response" | jq -r '.summary.errors // 0')
        total=$(echo "$response" | jq -r '.summary.total // 0')
        improvements=$(echo "$response" | jq -r '.summary.improvements // 0')
        
        log "${GREEN}✅ Recrawl completed: $success successful, $errors errors, $improvements improvements (total: $total)${NC}"
        
        # Log improvements if any
        if [ "$improvements" -gt 0 ]; then
            log "${GREEN}🎉 $improvements entries had content/tag improvements!${NC}"
        fi
    else
        log "${RED}❌ Recrawl failed: Backend error${NC}"
        return 1
    fi
}

# Get current knowledge base stats
get_stats() {
    response=$(curl -s "$BACKEND_URL/knowledge/all")
    
    if [ $? -eq 0 ]; then
        total=$(echo "$response" | jq -r '.knowledge | length')
        pending=$(echo "$response" | jq -r '.knowledge[] | select(.status == "pending") | .url' | wc -l)
        failed=$(echo "$response" | jq -r '.knowledge[] | select(.status == "failed") | .url' | wc -l)
        crawled=$(echo "$response" | jq -r '.knowledge[] | select(.status == "crawled") | .url' | wc -l)
        
        log "${BLUE}📊 Knowledge Base Stats:${NC}"
        log "   Total entries: $total"
        log "   Pending: $pending"
        log "   Failed: $failed"
        log "   Crawled: $crawled"
    else
        log "${RED}❌ Failed to get stats${NC}"
    fi
}

# Main execution
main() {
    log "${BLUE}=== Regular Knowledge Base Crawl Started ===${NC}"
    
    # Check if backend is running
    if ! check_backend; then
        exit 1
    fi
    
    # Get current stats
    get_stats
    
    # Crawl pending and failed entries
    if crawl_pending_failed; then
        log "${GREEN}✅ Regular crawl completed successfully${NC}"
    else
        log "${RED}❌ Regular crawl failed${NC}"
        exit 1
    fi
    
    # Optional: Run comprehensive recrawl (uncomment if needed)
    # if recrawl_all; then
    #     log "${GREEN}✅ Comprehensive recrawl completed successfully${NC}"
    # else
    #     log "${RED}❌ Comprehensive recrawl failed${NC}"
    # fi
    
    log "${BLUE}=== Regular Knowledge Base Crawl Completed ===${NC}"
}

# Handle command line arguments
case "${1:-crawl}" in
    crawl)
        main
        ;;
    recrawl)
        if check_backend; then
            recrawl_all
        fi
        ;;
    stats)
        if check_backend; then
            get_stats
        fi
        ;;
    *)
        echo "Usage: $0 {crawl|recrawl|stats}"
        echo "  crawl   - Crawl pending and failed entries (default)"
        echo "  recrawl - Comprehensive recrawl of all entries"
        echo "  stats   - Show knowledge base statistics"
        exit 1
        ;;
esac 