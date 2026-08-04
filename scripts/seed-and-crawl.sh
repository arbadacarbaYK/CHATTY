#!/usr/bin/env bash
# Add + crawl curated links into the local knowledge DB (localhost backend).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED="${1:-$ROOT/knowledge-seed-links.txt}"
BASE="${CHATTY_BACKEND:-http://127.0.0.1:3000}"

if [[ ! -f "$SEED" ]]; then
  echo "Seed file not found: $SEED" >&2
  exit 1
fi

if ! curl -sf "$BASE/knowledge/all" >/dev/null; then
  echo "Backend not reachable at $BASE — start it with: cd backend && npm start" >&2
  exit 1
fi

mapfile -t URLS < <(grep -E '^https?://' "$SEED" | sed 's/[[:space:]]*$//')
echo "Seeding ${#URLS[@]} URLs from $SEED"

ok=0
fail=0
for url in "${URLS[@]}"; do
  echo ""
  echo "==> $url"
  curl -sf -X POST "$BASE/knowledge/add" \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"$url\"}" >/dev/null || true
  if body=$(curl -sS -X POST "$BASE/knowledge/crawl" \
      -H 'Content-Type: application/json' \
      -d "{\"url\":\"$url\"}"); then
    echo "$body" | head -c 280
    echo
    ok=$((ok + 1))
  else
    echo "crawl failed"
    fail=$((fail + 1))
  fi
  sleep 1
done

echo ""
echo "Done. ok=$ok fail=$fail"
curl -sf -X POST "$BASE/knowledge/rebuild-fts" >/dev/null || true
