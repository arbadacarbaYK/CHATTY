# Status note

CHATTY is a **local** Bitcoin-ecosystem tutor (Ollama + SQLite knowledge + optional espeak TTS).

- Knowledge crawler stores full page text and serves FTS search
- Chat prefers local knowledge and cites sources
- Spoken replies work via browser TTS or backend **espeak-ng** (`/tts`)
- Backend binds to localhost only

Admin/crawl routes are unauthenticated on purpose for a single-user local setup. Mic dictation needs Chromium/Brave.
