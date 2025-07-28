# Bitcoin Education Roleplay

An interactive web-based education platform featuring a 3D avatar (GLB model) that teaches users about Bitcoin, Lightning Network, and Nostr through engaging conversations.

## Features

- **3D Avatar Rendering**: Uses `<model-viewer>` to display GLB avatars (e.g., Ready Player Me)
- **AI-Powered Chat**: Intelligent responses tailored to user skill levels using local Ollama models
- **Skill Level Adaptation**: Content adjusts based on beginner, intermediate, or advanced knowledge
- **Modern UI**: Beautiful, responsive design with glassmorphism effects
- **Voice Input & Output**: Use your microphone to ask questions and have responses read aloud (browser-based)
- **Educational Focus**: Comprehensive coverage of Bitcoin ecosystem topics (no real wallet/Nostr integration)
- **Completely Free**: Uses local Ollama AI models - no API costs, no external keys
- **Production Ready**: Health checks, error handling, configuration system
- **Mobile Responsive**: Works perfectly on desktop and mobile devices
- **Privacy First**: All conversations stay on your local machine

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Avatar Technology**: `<model-viewer>` with GLB models (Ready Player Me or similar)
- **AI Integration**: Ollama with local models (completely free!)
- **Build Tools**: npm/npx, Vite, PostCSS, Autoprefixer

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Ollama (install from https://ollama.ai)

### Installation
```bash
# Clone and install
git clone <repository-url>
cd bitcoin-edu-roleplay
npm install

# Install and setup Ollama
# 1. Install Ollama from https://ollama.ai
# 2. Pull the model: ollama pull llama3.2:3b
# 3. Start Ollama service: ollama serve

# Start development server
npm run dev
```

### Ollama Setup
1. **Install Ollama**: Download from https://ollama.ai
2. **Pull the Model**: `ollama pull llama3.2:3b` (faster on 4-core systems)
3. **Start Service**: `ollama serve`
4. **Verify**: Visit http://localhost:11434 to check if Ollama is running

## Unified Startup (Ollama + Backend + Frontend)

### Prerequisites
- Node.js 18+ and npm
- Ollama (install from https://ollama.ai)

### First-Time Setup
```bash
# 1. Install Ollama and pull the faster model
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
Use the provided `start.sh` script for easy management:
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

### What Runs Where
| Service   | Install Command         | Start Command         | Notes                        |
|-----------|------------------------|-----------------------|------------------------------|
| Ollama    | ollama pull phi3:mini  | ollama serve          | Optimized for 4-core systems |
| Backend   | npm install (in /backend) | npm start (in /backend) | Handles knowledge/context    |
| Frontend  | npm install            | npm run dev           | User/admin interface         |

---

## Configuration

The app supports environment-based configuration for both local development and server deployment. Copy `env.example` to `.env` and customize:

### Local Development (Default)
```bash
# No environment file needed - uses Vite proxies
# Ollama: /api → http://localhost:11434
# Backend: /knowledge → http://localhost:3000
```

### Server Deployment
```bash
# Same server deployment
VITE_OLLAMA_URL=http://localhost:11434
VITE_BACKEND_URL=http://localhost:3000

# Remote Ollama server
VITE_OLLAMA_URL=http://your-ollama-server.com:11434
VITE_BACKEND_URL=http://localhost:3000

# Docker deployment
VITE_OLLAMA_URL=http://ollama:11434
VITE_BACKEND_URL=http://backend:3000

# Cloud deployment
VITE_OLLAMA_URL=https://your-ollama-api.com
VITE_BACKEND_URL=https://your-backend-api.com
```

### Advanced Configuration
```bash
# Ollama Configuration (Optimized for 4-core systems)
VITE_OLLAMA_MODEL=llama3.2:3b
VITE_OLLAMA_TIMEOUT=120000

# Chat Configuration
VITE_CHAT_MAX_HISTORY=20
VITE_HEALTH_CHECK_INTERVAL=30000

# UI Configuration
VITE_MOBILE_BREAKPOINT=768
VITE_MAX_MESSAGE_LENGTH=1000
```

## Helper Scripts

The project includes several helper scripts for development and testing:

### Knowledge Base Management
- `add_knowledge_links.sh` - Add Bitcoin-related URLs to the knowledge base
- `crawl_all.sh` - Crawl all pending URLs in the knowledge base
- `recrawl_all.sh` - Recrawl all URLs to refresh content and tags

### Service Management
- `start.sh` - Unified startup script for all services (Ollama, Backend, Frontend)
  ```bash
  ./start.sh start    # Start all services
  ./start.sh status   # Check service status
  ./start.sh stop     # Stop all services
  ./start.sh logs     # View recent logs
  ```

### Optimal System Requirements

| Component | Minimum | Recommended | Notes |
|-----------|---------|-------------|-------|
| CPU | 2 cores | 4+ cores | llama3.2:3b optimized for 4-core systems |
| RAM | 4GB | 8GB+ | 39GB available for optimal performance |
| Storage | 2GB | 5GB+ | For models and knowledge base |
| OS | Linux/macOS/Windows | Linux | Best performance on Linux |

### Performance Optimization

The system is configured for optimal performance on 4-core systems:

- **Model**: `llama3.2:3b` (3B parameters, fast inference ~2.6s)
- **Threads**: 2 (optimal for 4-core systems)
- **Context**: 1024 tokens (balanced performance/memory)
- **Response Length**: 50 tokens (fast, concise responses)
- **Timeout**: 30 seconds (prevents hanging)

## Usage

1. **Select Skill Level**: Choose beginner, intermediate, or advanced
2. **Start Learning**: Click "Start Learning" to begin
3. **Chat with the Avatar**: Ask questions about Bitcoin, Lightning Network, or Nostr
4. **Use Voice Features**: Speak your questions or have answers read aloud
5. **Monitor AI Status**: Check the health indicator to ensure AI is ready

## Production Deployment

### Build for Production
```bash
npm run build
```

The `dist/` folder contains the production build ready for deployment.

### Production Requirements
- Web server (nginx, Apache, etc.)
- Ollama running on the server or accessible network
- Required model downloaded: `ollama pull llama3.2:3b` (4-core systems) or `ollama pull phi3:mini` (8+ core servers)
- Minimum 4GB RAM, 8GB+ recommended
- 4+ CPU cores for optimal performance

## Project Structure

```
src/
├── components/          # React components
│   ├── AvatarDisplay.tsx        # 3D avatar rendering with <model-viewer>
│   ├── ChatUI.tsx               # Chat interface with health monitoring
│   ├── AvatarSelector.tsx       # Avatar/skill selection
│   └── KnowledgeAdmin.tsx       # Knowledge base management interface
├── services/           # API services
│   ├── chatService.ts  # Ollama integration with health checks
│   └── knowledgeService.ts      # Knowledge base API client
├── config/             # Configuration management
│   └── appConfig.ts    # Environment-based configuration
├── App.tsx             # Main application with responsive design
└── main.tsx            # Application entry point

backend/
├── routes/
│   └── knowledge.js    # Knowledge base API endpoints
├── prisma/
│   └── dev.db          # SQLite database (knowledge storage)
├── bin/
│   └── www             # Express server startup
└── app.js              # Express application setup

public/
├── avatars/            # Avatar assets (GLB URLs)
└── ...
```

## Database

The application uses SQLite for knowledge storage:

- **Database Path**: `backend/prisma/dev.db`
- **Schema**: Knowledge base entries with URLs, content, tags, and status
- **Backup**: `backend/prisma/dev.db.backup` (automatic backup)

## API Endpoints

### Knowledge Base API (`/knowledge`)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/knowledge/all` | Get all knowledge entries | - | `{knowledge: [...]}` |
| `POST` | `/knowledge/add` | Add new URL to crawl | `{url: string}` | `{success: true, id: number}` |
| `POST` | `/knowledge/crawl` | Crawl and process URL | `{url: string}` | `{success: true, tags: [...], preview: string}` |
| `DELETE` | `/knowledge/remove` | Remove knowledge entry | `{url: string}` | `{success: true, deleted: boolean}` |

### Ollama API (External)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `POST` | `http://localhost:11434/api/generate` | Generate AI response | `{model: string, prompt: string, stream: false}` | `{response: string}` |

### Frontend Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Start page | Avatar selection and skill level choice |
| `/chat` | Main chat interface | AI conversation with avatar |
| `/input` | Knowledge Admin | Manage knowledge base entries |

## Knowledge Base Features

- **Web Crawling**: Automatically extracts content and tags from URLs
- **Smart Tagging**: Filters out UI/navigation words, focuses on meaningful content
- **Content Cleaning**: Removes HTML artifacts, duplicates, and whitespace
- **Recrawl Support**: Refresh content and tags for existing entries
- **Admin Interface**: Add, remove, and manage knowledge entries
- **Chat Integration**: Relevant knowledge is automatically injected into AI prompts

## Troubleshooting

### Ollama Not Working
- Make sure Ollama is installed: https://ollama.ai
- Check if service is running: `ollama serve`
- Verify model is downloaded: `ollama list`
- Pull the faster model: `ollama pull llama3.2:3b`
- Check the health indicator in the chat interface
- For 4-core systems, use `llama3.2:3b` for best performance

### Avatar Not Displaying
- Check browser console for WebGL errors
- Ensure GLB model URLs are correct and accessible

### Chat Not Working
- Ensure Ollama is running on http://localhost:11434
- Check if the model is downloaded and available
- Verify network connectivity to local Ollama service
- Look at the health status indicator for detailed error information

### Performance Issues
- Use the faster model: `ollama pull llama3.2:3b` (optimized for 4-core systems)
- Adjust timeout settings in configuration (30 seconds recommended)
- Check system resources (CPU, RAM)
- For servers with more cores, consider `phi3:mini` for longer responses

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section
- Review browser console for error messages
- Ensure all prerequisites are met
- Check Ollama documentation at https://ollama.ai
- Verify configuration settings in your `.env` file

> **Project Structure Note:**
> All project files (frontend, backend, Ollama, database) are now inside the `bitcoin-edu-roleplay` folder. The backend is at `bitcoin-edu-roleplay/backend` and must be started from there. This makes local and server deployment easy and portable.

## Text-to-Speech (TTS) Platform Support

| Platform         | Browser         | System TTS Install Needed? | Browser Uses System Voices? | Result in App         |
|------------------|----------------|---------------------------|----------------------------|-----------------------|
| Windows/macOS    | Any            | No                        | Yes                        | Natural voice         |
| iOS/Android      | Any            | No                        | Yes                        | Natural voice         |
| Linux            | Chrome/Brave   | No (doesn't help)         | No                         | None/robotic/none     |
| Linux            | Firefox        | No (doesn't help)         | No                         | None/robotic/none     |

The app always uses the best available voice for the user's platform. On Linux, browser-native TTS is limited by browser support, not by system packages.
