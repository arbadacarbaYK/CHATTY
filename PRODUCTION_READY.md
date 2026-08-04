# Status note

CHATTY is a **local** education prototype. Prefer the root README for how to run it.

What “done enough for local use” means now:

- Knowledge crawler stores real page text (not 200-char teasers) + FTS search
- Chat prefers local knowledge and cites sources
- Spoken replies work on Linux via backend **espeak-ng** (`/tts`)
- Backend binds to localhost only

Still not a cloud product: no auth on admin routes (OK when localhost-only), Web Speech mic needs Chromium, and you should **Refresh Thin Knowledge** once after upgrading an old DB.
