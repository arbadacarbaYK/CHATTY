# CHATTY

Local Bitcoin / Lightning / Nostr / Cashu tutor. Chat runs on **Ollama on your machine**. Answers prefer your **curated link knowledge base** (crawled into SQLite). Nothing is meant to be exposed to the internet.

## What you need

- Node.js 18+
- [Ollama](https://ollama.com) + model `llama3.2:3b` (or set `VITE_OLLAMA_MODEL`)
- **Linux voice (spoken replies):** `espeak-ng` (`sudo apt install espeak-ng`) — browsers on Linux often have no TTS voices; CHATTY uses local espeak through the backend
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

## Voice (why it failed before)

Two separate bugs / limits:

1. **Mic mode turned itself off before the reply**, so spoken answers never fired.
2. **Chrome/Brave/Firefox on Linux often expose zero browser TTS voices** — installing system voices does not fix that. CHATTY now synthesizes WAV via **espeak-ng** on the backend (`POST /tts`).

Use **🎤** for talk-and-listen, or **🔊** for spoken replies after typed chat.

## Knowledge base — when it helps vs slows you down

The KB is **optional context**, not a mandatory detour:

- Chat **skips** the KB for short greetings and non-Bitcoin chit-chat.
- Search times out after **~1.2s** — if the backend is slow, chat continues without it.
- Only entries with **≥400 characters** of crawled text are injected (old 200-char teasers are ignored).
- At most **3** sources × ~700 chars — so it shouldn't balloon Ollama prompt time.

**Helpful when:** you ask about something in the seed list (Coldcard advisory, BIP-110 sides, Cashu/Nostr docs).  
**Not helpful when:** the DB is full of tiny GitHub homepage scraps — use **Refresh Thin Knowledge** or recrawl curated links via `./scripts/seed-and-crawl.sh`.

Curated seed file: [`knowledge-seed-links.txt`](knowledge-seed-links.txt).


## Tests

```bash
npm test
# runs backend unit tests (content cleaning / FTS query helpers)
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
