# Developer setup — CHATTY

Local Bitcoin-ecosystem tutor (Ollama + SQLite knowledge + optional espeak TTS).

## Prerequisites

- Node.js 18+
- npm 8+
- Ollama ([ollama.com](https://ollama.com))
- Linux spoken replies: `espeak-ng`
- Mic dictation: Chromium/Brave

## Install

```bash
cd CHATTY
npm install
cd backend && npm install && cd ..
ollama pull llama3.2:3b
sudo apt install espeak-ng   # Linux TTS
```

## Run

```bash
ollama serve                 # terminal 1
cd backend && npm start      # terminal 2 — http://127.0.0.1:3000
npm run dev                  # terminal 3 — http://localhost:5173
```

Or `./start.sh start` / `status` / `stop` / `logs`.

Backend listens on **127.0.0.1** only (`HOST` / `PORT` env supported).

## Vite proxies

| Browser path | Target |
|--------------|--------|
| `/api/*` | Ollama `http://127.0.0.1:11434` |
| `/knowledge/*` | Backend knowledge API |
| `/tts` | Backend local TTS (espeak) |

## Knowledge API (local)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/knowledge/all` | List entries |
| GET | `/knowledge/search?q=` | FTS5 then LIKE |
| POST | `/knowledge/add` | Queue URL |
| POST | `/knowledge/crawl` | Crawl + store full text |
| POST | `/knowledge/mark-thin-pending` | Re-queue short/old teasers |
| POST | `/knowledge/rebuild-fts` | Rebuild FTS index |
| POST | `/tts` | `{ text }` → `audio/wav` |
| GET | `/tts/status` | Whether espeak is available |

DB: `../knowledge.db` from backend (repo root). No Prisma.

## Tests

```bash
npm test
```

## Voice notes for developers

- `speakAfterReplyRef` must stay true across mic-mode teardown or replies never speak.
- Prefer browser `speechSynthesis` when voices exist; else `POST /tts`.
- Web Speech STT is Chromium-only and may use cloud ASR — say so in UI copy.

## Env

See `env.example`. Leave empty for local Vite proxies.
