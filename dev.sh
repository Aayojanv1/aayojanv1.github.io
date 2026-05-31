#!/bin/bash
# Local staging — starts frontend + backend + Firebase emulators together

ROOT="$(cd "$(dirname "$0")" && pwd)"

start_backend() {
  cd "$ROOT/backend"
  source .venv/bin/activate
  uvicorn main:app --reload --port 8000
}

start_frontend() {
  cd "$ROOT/frontend"
  npm run dev
}

start_emulators() {
  cd "$ROOT"
  firebase emulators:start --only auth,firestore
}

export -f start_backend
export -f start_frontend
export -f start_emulators
export ROOT

echo ""
echo "  Aayojan LOCAL STAGING"
echo "  ─────────────────────────────────────"
echo "  Frontend        → http://localhost:5173"
echo "  Backend API     → http://localhost:8000"
echo "  API Docs        → http://localhost:8000/docs"
echo "  Firebase UI     → http://localhost:4000"
echo "  Auth Emulator   → http://localhost:9099"
echo "  Firestore Emu   → http://localhost:8080"
echo "  ─────────────────────────────────────"
echo "  AIR GAP: No production data will be touched."
echo ""

cd "$ROOT/frontend" && npx concurrently \
  --names "EMULATOR,BACKEND,FRONTEND" \
  --prefix-colors "bgYellow.bold,bgBlue.bold,bgGreen.bold" \
  --kill-others \
  "bash -c start_emulators" \
  "bash -c start_backend" \
  "bash -c start_frontend"
