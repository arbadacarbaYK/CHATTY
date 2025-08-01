# Bitcoin Education Roleplay

<img width="1907" height="914" alt="Screenshot from 2025-07-28 23-59-31" src="https://github.com/user-attachments/assets/1f15500a-6820-469c-b96c-4f09f5aeb62d" />

An interactive web-based education platform featuring a 3D avatar (GLB model)  `<model-viewer>` to display GLB avatars (e.g. Ready Player Me)
- **AI-Powered Chat**: Bitcoin maximalist responses using local Ollama models
- **Specialized Avatars**: Different avatars for Bitcoin, Lightning, Nostr, and Cashu topics
- **Modern UI**: Beautiful, responsive design with glassmorphism effects
- **Voice Input & Output**: Use your microphone to ask questions and have responses read aloud (browser-based)
- **Educational Focus**: Comprehensive coverage of Bitcoin ecosystem topics
- **Completely Free**: Uses local Ollama AI models - no API costs, no external keys
- **Production Ready**: Health checks, error handling, configuration system
- **Mobile Responsive**: Works perfectly on desktop and mobile devices
- **Privacy First**: All conversations stay on your local machine
- **Multi-User Support**: Session management for multiple concurrent users
- **Knowledge Base**: Enhanced web crawling with unified API, intelligent tag detection, and protected wallet information

<img width="1222" height="773" alt="Screenshot from 2025-07-28 23-58-17" src="https://github.com/user-attachments/assets/eeea18c3-1940-4b29-a2ef-6ceb874bae03" />

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Avatar Technology**: `<model-viewer>` with GLB models (Ready Player Me or similar)
- **AI Integration**: Ollama with local models (completely free!)
- **Backend**: Node.js + Express with session management
- **Database**: SQLite for knowledge base storage
- **Build Tools**: npm/npx, Vite, PostCSS, Autoprefixer

## 🆕 **Latest Features**

### **Enhanced AI Responses**
- **Skill Level Adaptation**: Beginner (2-3 sentences), Intermediate (4-6 sentences), Advanced (6-8 sentences)
- **Specialist Avatar Referral**: AI suggests switching to specialist avatars for deeper technical insights
- **Improved Decision-Making**: AI asks clarifying questions instead of avoiding decisions
- **Better Context Management**: Smart conversation history selection

### **Intelligent Knowledge Base**
- **Ecosystem-Aware Tagging**: Automatically detects Bitcoin, Lightning, Nostr, and Cashu ecosystems
- **Semantic Search**: Enhanced search with intelligent scoring and ecosystem relevance
- **Protected Wallet Database**: 44 comprehensive LNURL wallets with detailed feature information
- **Hardware Building Guide**: LNbits hardware projects including hardware wallets, ATMs, POS terminals
- **21 Individual Hardware Projects**: Separate protected entries for each LNbits hardware project including Nostr Signing Device, Arcade Machine, Zap Lamp, Gerty, ATM, Coins Only, Big (FOSSA) ATM, The Bat-ATM 🦇, LNPoS Terminal, POS with NFC, Lightning Piggy, Hardware Wallet, Bitcoin Switch, Vending Machine, More Fun Projects, A watch - but cooler, Bolty, Nerdminer, Bitcoin Ticker, BTClock, and LoRa
- **Ereignishorizont Projects**: Additional hardware solutions including LNPoS terminals, Bitcoin switches, and ATM hardware
- **Smart Chat Responses**: AI uses general knowledge + knowledge base, shows context sources below chat bubbles, and provides optimistic references to available resources
- **Knowledge Source Display**: Chat bubbles now show relevant knowledge base sources below AI responses with clickable links
- **Improved Chat UI**: Left-aligned text in all chat bubbles, complete message display without cutoff
- **Bidirectional Normalization**: Handles NWC/Nostr Wallet Connect and eCash/Cashu variations
- **Wallet Comparison Resources**: Integrated comprehensive wallet comparison guides for informed decision-making
- **Environment-Based Security**: Production mode restricts admin functions while allowing user contributions

### **Enhanced UI/UX**
- **Improved Chat Interface**: Right-aligned timestamps, better user icon colors
- **Performance Monitoring**: Track response times and knowledge base hit rates
- **Better Error Handling**: Comprehensive error classification and retry logic
- **Environment-Based Controls**: Automatic UI adaptation based on deployment mode

<img width="1199" height="885" alt="Screenshot from 2025-07-28 23-59-45" src="https://github.com/user-attachments/assets/40d566ab-a242-4003-98a7-646b4e85b2a2" />

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Ollama (install from https://ollama.ai)

### Installation
```bash
# Clone and install
git clone gitHub.com/arbadacarbayk/CHATTY
cd bitcoin-edu-roleplay
npm install

# Install and setup Ollama
# 1. Install Ollama from https://ollama.ai
# 2. Pull the model: ollama pull llama3.2:1b (fastest) or llama3.2:3b (better quality)
# 3. Start Ollama service: ollama serve

# Start all services using the unified script
./start.sh
```

### Ollama Setup
1. **Install Ollama**: Download from https://ollama.ai
2. **Pull the Model**: 
   - `ollama pull llama3.2:1b` (default, 1.2B parameters, English language)
   - `ollama pull llama3.2:3b` (better quality, recommended)
   - `ollama pull tinyllama:1.1b` (lightweight, very fast)
3. **Start Service**: `ollama serve`
4. **Verify**: Visit http://localhost:11434 to check if Ollama is running

### AI Model Information
- **Default Model**: `llama3.2:1b` (1.2B parameters)
- **Language**: English
- **Context**: Bitcoin-focused education and technical discussions
- **Capabilities**: Knowledge base queries, web search suggestions, resource linking

### Starting the Application
```bash
# Start all services (Ollama + Backend + Frontend)
./start.sh

# Or manually:
ollama serve &
cd backend && npm start &
npm run dev
```

## Unified Startup (Ollama + Backend + Frontend)

### Prerequisites
- Node.js 18+ and npm
- Ollama (install from https://ollama.ai)

### First-Time Setup
```bash
# 1. Install Ollama and pull the model
ollama pull llama3.2:1b  # or llama3.2:3b for better quality

# 2. Install frontend dependencies
cd bitcoin-edu-roleplay
npm install

# 3. Install backend dependencies
cd backend
npm install
```

### Starting Everything (Each Time)
```bash
# Use the unified start script (recommended)
./start.sh

# Or manually:
# 1. Start Ollama (in a terminal)
ollama serve

# 2. Start the backend (in /backend)
npm start

# 3. Start the frontend (in /bitcoin-edu-roleplay)
npm run dev
```

### Start Script Management
```bash
# Start all services
./start.sh start

# Check status
./start.sh status

# Stop all services
./start.sh stop

# View logs
./start.sh logs
```

## 📚 **Knowledge Base API**

The platform includes a comprehensive **Knowledge Base API** with enhanced web crawling capabilities:

### **Features**
- **Unified Crawling Engine**: All endpoints use the same enhanced crawling logic
- **Smart Content Extraction**: Specialized handling for GitHub, Twitter/X, Bitcoin sites
- **Enhanced Error Classification**: Detailed error types and retry logic
- **Improved Tag Extraction**: Better keyword detection and filtering
- **Comprehensive Testing**: Full test suite with performance metrics
- **Multi-User Support**: Session management for concurrent users

### **Quick API Examples**
```bash
# Add a new URL to crawl
curl -X POST http://localhost:3000/knowledge/add \
  -H "Content-Type: application/json" \
  -d '{"url": "https://greatbitcoin.news"}'

# Crawl a single URL regardless of status
curl -X POST http://localhost:3000/knowledge/crawl-single \
  -H "Content-Type: application/json" \
  -d '{"url": "https://greatbitcoin.news"}'

# Crawl all pending/failed entries
curl -X POST http://localhost:3000/knowledge/crawl-all

# Comprehensive recrawl with improvements
curl -X POST http://localhost:3000/knowledge/recrawl-all

# Search knowledge base
curl -X GET "http://localhost:3000/knowledge/search?q=lightning"

# Get all knowledge entries
curl -X GET http://localhost:3000/knowledge/all

# Send chat message
curl -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Bitcoin?", "skillLevel": "beginner", "avatarName": "Satoshi"}'
```

### **📖 Full API Documentation**
See [KNOWLEDGE_API.md](./docs/KNOWLEDGE_API.md) for complete API documentation, including:
- All endpoints with examples
- Error handling and classification
- Performance characteristics
- Testing procedures
- Best practices

### **🔗 Available API Endpoints**

#### **Knowledge Base API** (`/knowledge`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/knowledge/all` | Get all knowledge entries |
| `GET` | `/knowledge/search?q=query` | Search knowledge base |
| `POST` | `/knowledge/add` | Add new URL to crawl |
| `POST` | `/knowledge/crawl` | Crawl specific URL |
| `POST` | `/knowledge/crawl-all` | Crawl all pending/failed entries |
| `POST` | `/knowledge/crawl-single` | Crawl single URL regardless of status |
| `POST` | `/knowledge/recrawl-all` | Recrawl all entries with improvements |
| `DELETE` | `/knowledge/remove` | Remove knowledge entry |
| `DELETE` | `/knowledge/clear` | Clear all knowledge entries |

#### **Chat API** (`/chat`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/chat/message` | Send message and get AI response |
| `GET` | `/chat/history` | Get conversation history |
| `GET` | `/chat/session-info` | Get session information |

## 🔧 **Configuration**

### **Environment Variables**
The application uses environment variables for configuration. Copy `.env.example` to `.env` and customize:

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### **Key Configuration Options**
- **Ollama Model**: `VITE_OLLAMA_MODEL=llama3.2:1b` (fastest) or `llama3.2:3b` (better quality)
- **Session Management**: Auto-generated session secrets for multi-user support
- **Knowledge Base**: SQLite database with enhanced crawling capabilities

### **Session Management**
- **Development**: Regular cookies, 1-hour sessions
- **Production**: Secure cookies, 24-hour sessions
- **Auto-Generated Secrets**: Secure session management for multiple users

## 🚀 **Deployment**

### **Local Development**
```bash
# Start all services (recommended)
./start.sh

# Or manually:
ollama serve &
cd backend && npm start &
npm run dev
```

### **Production Deployment**
```bash
# Set production environment
export NODE_ENV=production

# Start with production settings
./start.sh
```

## 📊 **Features**

### **AI Chat**
- **Local Models**: Uses Ollama for completely free AI chat
- **Bitcoin Maximalist Focus**: Specialized prompts for Bitcoin, Lightning, Nostr, and Cashu topics
- **Avatar Specialists**: Different avatars for different topics (Satoshi, Lightning, Nostr, Cashu)
- **Knowledge Integration**: Searches knowledge base for relevant information
- **Session Persistence**: Maintains conversation history per user

### **Knowledge Base**
- **Web Crawling**: Enhanced crawling of Bitcoin-related sites
- **Content Processing**: Smart content extraction and summarization
- **Tag Generation**: Automatic keyword extraction and categorization
- **Error Handling**: Comprehensive error classification and recovery
- **Regular Updates**: Automated crawling with cron scheduling
- **Protected Wallet Database**: 44 comprehensive LNURL wallets with detailed feature information
- **Environment-Based Security**: Production mode restricts admin functions while allowing user contributions

### **Avatar System**
- **3D Rendering**: Uses `<model-viewer>` for GLB model display
- **Multiple Avatars**: Support for different educational personas
- **Responsive Design**: Works on desktop and mobile devices

### **Multi-User Support**
- **Session Management**: Secure user sessions with auto-generated secrets
- **Concurrent Users**: Support for multiple simultaneous users
- **Privacy First**: All data stays local, no external tracking

### **Environment-Based Security**
- **Production Mode**: Users can add links but cannot crawl, recrawl, or delete entries
- **Development Mode**: Full administrative control including individual and bulk operations
- **Shared Database**: Both modes use the same database and logic
- **Protected Entries**: Wallet information is protected from deletion in both modes
- **Automatic UI Adaptation**: Interface adjusts based on deployment environment

## 🧪 **Testing**

### **Knowledge Base Testing**
```bash
# Run comprehensive test suite
node test_bulk_crawl.cjs

# Run focused crawl testing
node test_crawl_all.cjs
```

### **API Testing**
```bash
# Test knowledge base endpoints
curl -X GET http://localhost:3000/knowledge/all

# Test search functionality
curl -X GET "http://localhost:3000/knowledge/search?q=bitcoin"

# Test single crawl
curl -X POST http://localhost:3000/knowledge/crawl-single \
  -H "Content-Type: application/json" \
  -d '{"url": "https://greatbitcoin.news"}'

# Test chat functionality
curl -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Bitcoin?", "skillLevel": "beginner", "avatarName": "Satoshi"}'

# Test session info
curl -X GET http://localhost:3000/chat/session-info
```

## 📖 **Documentation**

- **[KNOWLEDGE_API.md](./docs/KNOWLEDGE_API.md)**: Complete API documentation
- **[SETUP_INSTRUCTIONS.md](./docs/SETUP_INSTRUCTIONS.md)**: Detailed setup guide
- **[PRODUCTION_READY.md](./docs/PRODUCTION_READY.md)**: Production deployment guide
- **[REGULAR_CRAWLING.md](./docs/REGULAR_CRAWLING.md)**: Automated crawling setup guide
- **[RESOURCE_MANAGEMENT.md](./docs/RESOURCE_MANAGEMENT.md)**: Resource management and optimization

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 **License**

This project is open source and available under the MIT License.
