#!/bin/bash

# Bitcoin Education Roleplay - Complete Startup Script
# This script manages all services with proper health checks and auto-restart
# 
# Optimal Configuration for 4-core systems:
# - Model: llama3.2:3b (3B parameters, fast inference ~2.6s)
# - Threads: 2 (optimal for 4-core systems)
# - Context: 1024 tokens (balanced performance/memory)
# - Response Length: 50 tokens (fast, concise responses)
# - Timeout: 30 seconds (prevents hanging)
#
# For servers with 8+ cores, consider using phi3:mini instead

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=3000
FRONTEND_PORT=5174
OLLAMA_PORT=11434
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
LOG_DIR="$PROJECT_DIR/logs"
PID_DIR="$PROJECT_DIR/pids"

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Function to log messages
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Function to check if a port is in use
is_port_in_use() {
    local port=$1
    lsof -i :$port >/dev/null 2>&1
}

# Function to kill process by PID file
kill_by_pid_file() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log "${YELLOW}Stopping $service_name (PID: $pid)...${NC}"
            kill "$pid" 2>/dev/null || true
            sleep 2
            if kill -0 "$pid" 2>/dev/null; then
                log "${RED}Force killing $service_name...${NC}"
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$pid_file"
    fi
}

# Function to check service health
check_service_health() {
    local url=$1
    local service_name=$2
    local timeout=${3:-5}
    
    if curl -s --max-time $timeout "$url" >/dev/null 2>&1; then
        echo "true"
    else
        echo "false"
    fi
}

# Function to start Ollama
start_ollama() {
    log "${GREEN}Starting Ollama...${NC}"
    
    # Check if Ollama is already running
    if is_port_in_use $OLLAMA_PORT; then
        log "${YELLOW}Ollama is already running on port $OLLAMA_PORT${NC}"
        return 0
    fi
    
    # Start Ollama in background
    nohup ollama serve > "$LOG_DIR/ollama.log" 2>&1 &
    local ollama_pid=$!
    echo $ollama_pid > "$PID_DIR/ollama.pid"
    
    # Wait for Ollama to start
    log "Waiting for Ollama to start..."
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if check_service_health "http://localhost:$OLLAMA_PORT/api/tags" "Ollama" 2; then
            log "${GREEN}Ollama started successfully (PID: $ollama_pid)${NC}"
            return 0
        fi
        sleep 1
        ((attempts++))
    done
    
    log "${RED}Failed to start Ollama${NC}"
    return 1
}

# Function to start Backend
start_backend() {
    log "${GREEN}Starting Backend...${NC}"
    
    # Kill existing backend if running
    kill_by_pid_file "$PID_DIR/backend.pid" "Backend"
    
    # Wait for port to be free
    while is_port_in_use $BACKEND_PORT; do
        log "${YELLOW}Waiting for port $BACKEND_PORT to be free...${NC}"
        sleep 1
    done
    
    # Start backend
    cd "$BACKEND_DIR"
    nohup npm start > "$LOG_DIR/backend.log" 2>&1 &
    local backend_pid=$!
    echo $backend_pid > "$PID_DIR/backend.pid"
    
    # Wait for backend to start
    log "Waiting for Backend to start..."
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if check_service_health "http://localhost:$BACKEND_PORT/knowledge/all" "Backend" 2; then
            log "${GREEN}Backend started successfully (PID: $backend_pid)${NC}"
            return 0
        fi
        sleep 1
        ((attempts++))
    done
    
    log "${RED}Failed to start Backend${NC}"
    return 1
}

# Function to start Frontend
start_frontend() {
    log "${GREEN}Starting Frontend...${NC}"
    
    # Kill existing frontend if running
    kill_by_pid_file "$PID_DIR/frontend.pid" "Frontend"
    
    # Wait for port to be free
    while is_port_in_use $FRONTEND_PORT; do
        log "${YELLOW}Waiting for port $FRONTEND_PORT to be free...${NC}"
        sleep 1
    done
    
    # Start frontend
    cd "$PROJECT_DIR"
    nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > "$PID_DIR/frontend.pid"
    
    # Wait for frontend to start
    log "Waiting for Frontend to start..."
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if check_service_health "http://localhost:$FRONTEND_PORT" "Frontend" 2; then
            log "${GREEN}Frontend started successfully (PID: $frontend_pid)${NC}"
            return 0
        fi
        sleep 1
        ((attempts++))
    done
    
    log "${RED}Failed to start Frontend${NC}"
    return 1
}

# Function to monitor services
monitor_services() {
    log "${GREEN}Starting service monitor...${NC}"
    
    while true; do
        # Check Ollama
        if [ -f "$PID_DIR/ollama.pid" ]; then
            local ollama_pid=$(cat "$PID_DIR/ollama.pid")
            if ! kill -0 "$ollama_pid" 2>/dev/null || ! check_service_health "http://localhost:$OLLAMA_PORT/api/tags" "Ollama" 2; then
                log "${YELLOW}Ollama health check failed, restarting...${NC}"
                start_ollama
            fi
        fi
        
        # Check Backend
        if [ -f "$PID_DIR/backend.pid" ]; then
            local backend_pid=$(cat "$PID_DIR/backend.pid")
            if ! kill -0 "$backend_pid" 2>/dev/null || ! check_service_health "http://localhost:$BACKEND_PORT/knowledge/all" "Backend" 2; then
                log "${YELLOW}Backend health check failed, restarting...${NC}"
                start_backend
            fi
        fi
        
        # Check Frontend
        if [ -f "$PID_DIR/frontend.pid" ]; then
            local frontend_pid=$(cat "$PID_DIR/frontend.pid")
            if ! kill -0 "$frontend_pid" 2>/dev/null || ! check_service_health "http://localhost:$FRONTEND_PORT" "Frontend" 2; then
                log "${YELLOW}Frontend health check failed, restarting...${NC}"
                start_frontend
            fi
        fi
        
        sleep 30
    done
}

# Function to stop all services
stop_all() {
    log "${YELLOW}Stopping all services...${NC}"
    
    kill_by_pid_file "$PID_DIR/ollama.pid" "Ollama"
    kill_by_pid_file "$PID_DIR/backend.pid" "Backend"
    kill_by_pid_file "$PID_DIR/frontend.pid" "Frontend"
    kill_by_pid_file "$PID_DIR/monitor.pid" "Monitor"
    
    log "${GREEN}All services stopped${NC}"
}

# Function to show status
show_status() {
    echo -e "\n${BLUE}=== Service Status ===${NC}"
    
    # Ollama
    if [ -f "$PID_DIR/ollama.pid" ]; then
        local pid=$(cat "$PID_DIR/ollama.pid")
        if kill -0 "$pid" 2>/dev/null; then
            if check_service_health "http://localhost:$OLLAMA_PORT/api/tags" "Ollama" 2; then
                echo -e "${GREEN}✓ Ollama: Running (PID: $pid)${NC}"
            else
                echo -e "${YELLOW}⚠ Ollama: Running but unhealthy (PID: $pid)${NC}"
            fi
        else
            echo -e "${RED}✗ Ollama: Not running${NC}"
        fi
    else
        echo -e "${RED}✗ Ollama: Not running${NC}"
    fi
    
    # Backend
    if [ -f "$PID_DIR/backend.pid" ]; then
        local pid=$(cat "$PID_DIR/backend.pid")
        if kill -0 "$pid" 2>/dev/null; then
            if check_service_health "http://localhost:$BACKEND_PORT/knowledge/all" "Backend" 2; then
                echo -e "${GREEN}✓ Backend: Running (PID: $pid)${NC}"
            else
                echo -e "${YELLOW}⚠ Backend: Running but unhealthy (PID: $pid)${NC}"
            fi
        else
            echo -e "${RED}✗ Backend: Not running${NC}"
        fi
    else
        echo -e "${RED}✗ Backend: Not running${NC}"
    fi
    
    # Frontend
    if [ -f "$PID_DIR/frontend.pid" ]; then
        local pid=$(cat "$PID_DIR/frontend.pid")
        if kill -0 "$pid" 2>/dev/null; then
            if check_service_health "http://localhost:$FRONTEND_PORT" "Frontend" 2; then
                echo -e "${GREEN}✓ Frontend: Running (PID: $pid)${NC}"
            else
                echo -e "${YELLOW}⚠ Frontend: Running but unhealthy (PID: $pid)${NC}"
            fi
        else
            echo -e "${RED}✗ Frontend: Not running${NC}"
        fi
    else
        echo -e "${RED}✗ Frontend: Not running${NC}"
    fi
    
    echo -e "\n${BLUE}=== URLs ===${NC}"
    echo -e "Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}"
    echo -e "Ollama:   ${GREEN}http://localhost:$OLLAMA_PORT${NC}"
}

# Main script logic
case "${1:-start}" in
    start)
        log "${GREEN}Starting Bitcoin Education Roleplay...${NC}"
        
        # Stop any existing services first
        stop_all
        
        # Start services
        start_ollama || exit 1
        start_backend || exit 1
        start_frontend || exit 1
        
        # Start monitor in background
        monitor_services &
        echo $! > "$PID_DIR/monitor.pid"
        
        log "${GREEN}All services started successfully!${NC}"
        show_status
        
        # Keep script running
        log "${BLUE}Press Ctrl+C to stop all services${NC}"
        trap stop_all EXIT
        wait
        ;;
    stop)
        stop_all
        ;;
    restart)
        log "${GREEN}Restarting all services...${NC}"
        stop_all
        sleep 2
        $0 start
        ;;
    status)
        show_status
        ;;
    logs)
        echo -e "\n${BLUE}=== Recent Logs ===${NC}"
        echo -e "\n${GREEN}Frontend Log:${NC}"
        tail -20 "$LOG_DIR/frontend.log" 2>/dev/null || echo "No frontend log found"
        echo -e "\n${GREEN}Backend Log:${NC}"
        tail -20 "$LOG_DIR/backend.log" 2>/dev/null || echo "No backend log found"
        echo -e "\n${GREEN}Ollama Log:${NC}"
        tail -20 "$LOG_DIR/ollama.log" 2>/dev/null || echo "No ollama log found"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo "  start   - Start all services"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  status  - Show service status"
        echo "  logs    - Show recent logs"
        exit 1
        ;;
esac 