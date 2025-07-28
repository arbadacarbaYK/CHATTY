#!/bin/bash

# Crawl all knowledge base URLs with improved logic
echo "Crawling all knowledge base URLs..."

# Get all URLs from the knowledge base
urls=$(curl -s http://localhost:3000/knowledge/all | grep -o '"url":"[^"]*"' | cut -d'"' -f4)

# Counter for progress
count=0
total=$(echo "$urls" | wc -l)

echo "Found $total URLs to crawl"

# Crawl each URL
for url in $urls; do
    ((count++))
    echo "[$count/$total] Crawling: $url"
    
    # Crawl the URL
    response=$(curl -X POST http://localhost:3000/knowledge/crawl -H "Content-Type: application/json" -d "{\"url\": \"$url\"}" -s --max-time 60)
    
    # Check if successful
    if echo "$response" | grep -q '"success":true'; then
        echo "  ✅ Success"
    else
        echo "  ❌ Failed: $(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)"
    fi
    
    # Small delay to avoid overwhelming the server
    sleep 1
done

echo "Crawling completed!"
echo "Check results with: curl -s http://localhost:3000/knowledge/all | grep -o '\"content\":\"[^\"]*\"' | head -5" 