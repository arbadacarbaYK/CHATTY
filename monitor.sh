#!/bin/bash

# Monitoring script for Bitcoin Education Roleplay
# Shows real-time monitoring of backend processes and LLM traffic

echo "🔍 Bitcoin Education Roleplay - Monitoring Dashboard"
echo "=================================================="
echo ""

# Function to show process status
show_processes() {
    echo "📊 PROCESS STATUS:"
    echo "=================="
    
    # Backend process
    if pgrep -f "node backend/bin/www" > /dev/null; then
        echo "✅ Backend (Node.js): RUNNING"
        ps aux | grep "node backend/bin/www" | grep -v grep | awk '{print "   PID:", $2, "CPU:", $3"%", "MEM:", $4"%"}'
    else
        echo "❌ Backend (Node.js): STOPPED"
    fi
    
    # Frontend process
    if pgrep -f "vite" > /dev/null; then
        echo "✅ Frontend (Vite): RUNNING"
        ps aux | grep "vite" | grep -v grep | awk '{print "   PID:", $2, "CPU:", $3"%", "MEM:", $4"%"}'
    else
        echo "❌ Frontend (Vite): STOPPED"
    fi
    
    # Ollama process
    if pgrep -f "ollama serve" > /dev/null; then
        echo "✅ Ollama Service: RUNNING"
        ps aux | grep "ollama serve" | grep -v grep | awk '{print "   PID:", $2, "CPU:", $3"%", "MEM:", $4"%"}'
    else
        echo "❌ Ollama Service: STOPPED"
    fi
    
    # Ollama runner
    if pgrep -f "ollama runner" > /dev/null; then
        echo "✅ Ollama Runner: RUNNING"
        ps aux | grep "ollama runner" | grep -v grep | awk '{print "   PID:", $2, "CPU:", $3"%", "MEM:", $4"%"}'
    else
        echo "⏳ Ollama Runner: IDLE (will start when needed)"
    fi
    
    echo ""
}

# Function to show recent logs
show_recent_logs() {
    echo "📝 RECENT BACKEND LOGS:"
    echo "======================="
    if [ -f "backend.log" ]; then
        tail -5 backend.log | while read line; do
            echo "   $line"
        done
    else
        echo "   No backend.log found"
    fi
    echo ""
}

# Function to show LLM traffic
show_llm_traffic() {
    echo "🤖 LLM TRAFFIC MONITOR:"
    echo "======================="
    
    # Check if Ollama is responding
    if curl -s "http://localhost:11434/api/tags" > /dev/null 2>&1; then
        echo "✅ Ollama API: RESPONDING"
        
        # Show model info
        MODEL_INFO=$(curl -s "http://localhost:11434/api/tags" 2>/dev/null | jq -r '.models[0].name // "Unknown"')
        echo "   Model: $MODEL_INFO"
        
        # Show recent requests (if any)
        echo "   Recent requests: Checking..."
        
    else
        echo "❌ Ollama API: NOT RESPONDING"
    fi
    
    echo ""
}

# Function to show system resources
show_resources() {
    echo "💻 SYSTEM RESOURCES:"
    echo "===================="
    
    # CPU usage
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    echo "   CPU Usage: ${CPU_USAGE}%"
    
    # Memory usage
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    echo "   Memory Usage: ${MEM_USAGE}%"
    
    # Disk usage
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    echo "   Disk Usage: ${DISK_USAGE}%"
    
    echo ""
}

# Function to show network status
show_network() {
    echo "🌐 NETWORK STATUS:"
    echo "=================="
    
    # Backend health
    if curl -s "http://localhost:3000/chat/health" > /dev/null 2>&1; then
        echo "✅ Backend API (3000): ONLINE"
    else
        echo "❌ Backend API (3000): OFFLINE"
    fi
    
    # Frontend health
    if curl -s "http://localhost:5173" > /dev/null 2>&1; then
        echo "✅ Frontend (5173): ONLINE"
    else
        echo "❌ Frontend (5173): OFFLINE"
    fi
    
    # Ollama health
    if curl -s "http://localhost:11434/api/tags" > /dev/null 2>&1; then
        echo "✅ Ollama API (11434): ONLINE"
    else
        echo "❌ Ollama API (11434): OFFLINE"
    fi
    
    echo ""
}

# Main monitoring loop
while true; do
    clear
    echo "🔍 Bitcoin Education Roleplay - Monitoring Dashboard"
    echo "=================================================="
    echo "Last updated: $(date)"
    echo ""
    
    show_processes
    show_network
    show_resources
    show_llm_traffic
    show_recent_logs
    
    echo "Press Ctrl+C to exit monitoring"
    echo "Refreshing in 5 seconds..."
    sleep 5
done 