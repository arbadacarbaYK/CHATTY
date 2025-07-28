#!/bin/bash

# Recrawl all knowledge base entries with improved quality
echo "Starting recrawl of all knowledge base entries..."

# Get all URLs from the knowledge base
URLS=$(curl -s http://localhost:3000/knowledge/all | jq -r '.knowledge[] | .url')

# Counter for progress
TOTAL=$(echo "$URLS" | wc -l)
CURRENT=0

echo "Found $TOTAL entries to recrawl"

# Process each URL
echo "$URLS" | while read -r url; do
    if [ -n "$url" ]; then
        CURRENT=$((CURRENT + 1))
        echo "[$CURRENT/$TOTAL] Recrawling: $url"
        
        # Recrawl the URL
        response=$(curl -s -X POST http://localhost:3000/knowledge/crawl \
            -H "Content-Type: application/json" \
            -d "{\"url\": \"$url\"}")
        
        # Check if successful
        if echo "$response" | jq -e '.success' > /dev/null; then
            echo "  ✅ Success"
        else
            error=$(echo "$response" | jq -r '.error // "Unknown error"')
            echo "  ❌ Failed: $error"
        fi
        
        # Small delay to avoid overwhelming the server
        sleep 1
    fi
done

echo "Recrawl completed!"
echo "Checking final quality..."

# Show some sample results
echo ""
echo "Sample of improved entries:"
curl -s http://localhost:3000/knowledge/all | jq '.knowledge[0:5] | .[] | {url: .url, content: (.content | .[0:100] + "..."), tags: .tags}' 