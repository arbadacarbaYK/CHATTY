# CHATTY

Local Bitcoin / Lightning / Nostr / Cashu tutor. Chat runs on **Ollama on your machine**. Answers prefer your **curated link knowledge base** (crawled into SQLite). Nothing is meant to be exposed to the internet.

<img width="800" alt="CHATTY avatar and chat UI" src="https://github.com/user-attachments/assets/5ef912ce-70e1-48e4-83a3-0fc7b345665e" />
<img width="800" alt="CHATTY learning session" src="https://github.com/user-attachments/assets/6aac62bc-5f7e-4068-a785-6540d97fe5cd" />

## What you need

- Node.js 18+
- [Ollama](https://ollama.com) + model `llama3.2:3b` (or set `VITE_OLLAMA_MODEL`)
- **Linux spoken replies:** `espeak-ng` (`sudo apt install espeak-ng`) — used by the backend when the browser has no TTS voices
- **Mic → text:** Chromium or Brave (Web Speech API). Firefox usually cannot do browser STT.

## Quick start

```bash
git clone https://github.com/arbadacarbaYK/CHATTY.git
cd CHATTY

# Frontend deps
npm install

# Backend deps (crawler + local TTS)
cd backend && npm install && cd ..

# Ollama
ollama pull llama3.2:3b
ollama serve   # leave running

# Optional spoken replies on Linux
sudo apt install espeak-ng

# Start everything
./start.sh start
# or manually:
#   cd backend && npm start          # http://127.0.0.1:3000
#   npm run dev                      # http://localhost:5173
```

Open **http://localhost:5173**. Backend binds to **127.0.0.1 only**.

<img width="800" alt="CHATTY start / skill selection" src="https://github.com/user-attachments/assets/9ae74ae9-11cf-48d8-a10d-26a7d8c400ee" />

## Voice

- **🎤** — talk-and-listen (mic + spoken reply)
- **🔊** — spoken replies after typed chat
- Spoken audio uses browser voices when available, otherwise local **espeak-ng** via `POST /tts`

## Models

- **Settings** (`/settings` or ⚙️): choose the **default** Ollama model (tutor, lab-coder, unfiltered lab aliases, or anything you have pulled).
- **Chat bar** (Cursor-style dropdown under the input): override the model **for this question** without changing the default.
- Models come from local Ollama (`/api/tags`). Lab USB kit aliases (`lab-coder`, `lab-smart`, …) show up automatically when installed.

## Knowledge base

Curated links are crawled into SQLite and searched with FTS. Chat pulls a few strong matches into the prompt when the question is on-topic.

- Skips short greetings and off-topic chit-chat
- Search gives up after ~1.2s so the reply is never blocked on a slow backend
- Injects at most **3** sources with enough body text (≥400 characters), ~700 chars each
- Seed / recrawl list: [`knowledge-seed-links.txt`](knowledge-seed-links.txt) · `./scripts/seed-and-crawl.sh`
- Admin UI at **/input** (add links, crawl, refresh thin entries)

## Tests

```bash
npm test
# backend unit tests (content cleaning / FTS query helpers)
```

## Config

Copy `env.example` → `.env` only if you need overrides. Defaults are local:

| Variable | Default (local) |
|----------|-----------------|
| `VITE_OLLAMA_URL` | `/api` (Vite → Ollama) |
| `VITE_OLLAMA_MODEL` | `llama3.2:3b` |
| `VITE_BACKEND_URL` | `/knowledge` (Vite → backend) |

## Project layout

```
CHATTY/
├── src/                 # React + Vite UI
├── backend/             # Express: knowledge crawl + /tts
│   ├── lib/content.js   # cleaning / FTS helpers
│   └── routes/
├── knowledge.db         # SQLite knowledge store
├── start.sh             # start/stop helper
└── README.md
```

## Privacy

Local-only by design: Ollama, knowledge DB, and TTS stay on your machine. Educational chat only — no real wallets, no keys, no financial advice.
