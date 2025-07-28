# Bitcoin Education Roleplay - Production Ready

## 🎉 Project Status: PRODUCTION READY

Your Bitcoin Education Roleplay project has been successfully built and enhanced to production standards. Here's what you now have:

## ✅ What's Been Built

### **Enhanced Features**
- **Production-Ready Chat System**: Robust error handling, health monitoring, and configuration management
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Health Monitoring**: Real-time AI service status with detailed error reporting
- **Configuration System**: Environment-based settings for easy deployment
- **Improved UI/UX**: Better user experience with timestamps, clear chat, and status indicators

### **Technical Improvements**
- **TypeScript Compliance**: Fixed all linting errors and type issues
- **Configuration Management**: Centralized settings with environment variable support
- **Error Handling**: Comprehensive error handling for all edge cases
- **Performance Optimization**: Efficient chat history management and health checks
- **Mobile Responsiveness**: Adaptive layout for different screen sizes

### **AI Integration**
- **Local Ollama Integration**: Uses local AI models (completely free)
- **Health Monitoring**: Real-time status of Ollama service and model availability
- **Smart Error Messages**: Helpful error messages with actionable solutions
- **Conversation Management**: Intelligent chat history with configurable limits

## 🚀 How to Use

### **Development Mode**
```bash
cd bitcoin-edu-roleplay
npm run dev
# Visit http://localhost:5173
```

### **Production Build**
```bash
npm run build
npm run preview
# Visit http://localhost:4173
```

### **Ollama Setup** (Required)
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Download the AI model
ollama pull llama3.2:3b

# Start Ollama service
ollama serve
```

## Unified Startup & Deployment (Ollama + Backend + Frontend)

### Prerequisites
- Node.js 18+ and npm
- Ollama (install from https://ollama.ai)

### First-Time Setup
```bash
# 1. Install Ollama and pull a model
ollama pull llama3.2:3b

# 2. Install frontend dependencies
cd bitcoin-edu-roleplay
npm install

# 3. Install backend dependencies
cd backend
npm install
```

### Starting Everything (Each Time)
```bash
# 1. Start Ollama (in a terminal)
ollama serve

# 2. Start the backend (in /backend)
npm start

# 3. Start the frontend (in /bitcoin-edu-roleplay)
npm run dev
```

### Optional: Unified Start Script
Create a file `start-all.sh` in your project root:
```bash
#!/bin/bash

# Start Ollama (if not already running)
if ! pgrep -f 'ollama serve' > /dev/null; then
  echo "Starting Ollama..."
  ollama serve &
else
  echo "Ollama already running."
fi

# Start backend
cd backend
if [ ! -f node_modules/.bin/express ]; then
  echo "Installing backend dependencies..."
  npm install
fi
echo "Starting backend..."
npm start &
cd ..

# Start frontend
if [ ! -f node_modules/.bin/vite ]; then
  echo "Installing frontend dependencies..."
  npm install
fi
echo "Starting frontend..."
npm run dev &

echo "All services started. Open http://localhost:5173 in your browser."
```
Make it executable: `chmod +x start-all.sh`

### What Runs Where
| Service   | Install Command         | Start Command         | Notes                        |
|-----------|------------------------|-----------------------|------------------------------|
| Ollama    | ollama pull llama3.2:3b| ollama serve          | Must be running for LLM      |
| Backend   | npm install (in /backend) | npm start (in /backend) | Handles knowledge/context    |
| Frontend  | npm install            | npm run dev           | User/admin interface         |

---

## 🔧 Configuration

Copy `env.example`

> **Project Structure Note:**
> All project files (frontend, backend, Ollama, database) are now inside the `bitcoin-edu-roleplay` folder. The backend is at `bitcoin-edu-roleplay/backend` and must be started from there. This makes local and server deployment easy and portable.
