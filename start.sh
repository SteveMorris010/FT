#!/usr/bin/env sh
# -----------------------------------------------------------------------------
# FoodTech Study - one-click local launcher (macOS / Linux)
#
# Run it from the project root:
#
#   ./start.sh
#
# It does every first-run setup step for you and then starts the app:
#   1. checks that Node.js and npm are installed
#   2. installs dependencies (only the first time)
#   3. creates your .env file from .env.example (only if missing)
#   4. creates/updates the local SQLite database
#   5. starts the dev server and prints the URL to open
#
# Every step is safe to run again, so you can just run ./start.sh each time.
# -----------------------------------------------------------------------------

set -e

# Always work from the directory this script lives in, so it does not matter
# where the user runs it from.
cd "$(dirname "$0")"

URL="http://localhost:3000"

# A friendly error helper: print a clear message and stop (no stack traces).
fail() {
  echo ""
  echo "  [X] $1"
  echo ""
  exit 1
}

echo ""
echo "  FoodTech Study - starting up..."
echo "  ---------------------------------"

# 1. Node.js and npm must be available.
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. Please install Node.js 22 or newer from https://nodejs.org/ and run this again."
fi
if ! command -v npm >/dev/null 2>&1; then
  fail "npm is not installed. It normally ships with Node.js. Please install Node.js 22+ from https://nodejs.org/ and run this again."
fi
echo "  [ok] Node.js $(node --version) found"

# 2. Install dependencies only when node_modules is missing (fast repeat runs).
if [ ! -d "node_modules" ]; then
  echo "  [..] Installing dependencies (first run only, this can take a minute)..."
  npm install || fail "npm install failed. Check your internet connection and try again."
else
  echo "  [ok] Dependencies already installed"
fi

# 3. Create .env from the example only if it does not exist yet.
#    Never overwrite an existing .env (it may hold your real secrets/API key).
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "  [ok] Created .env from .env.example"
  else
    fail ".env.example is missing, so .env could not be created. Please restore it from the repository."
  fi
else
  echo "  [ok] .env already exists (left untouched)"
fi

# 4. Make sure the SQLite database exists and the schema is applied.
#    If versioned migrations exist, apply them (deploy is idempotent).
#    Otherwise fall back to db push. Both are safe to run repeatedly.
echo "  [..] Setting up the local database..."
if [ -d "prisma/migrations" ]; then
  npx --yes prisma migrate deploy || fail "Database setup (prisma migrate deploy) failed. See the message above."
else
  npx --yes prisma db push || fail "Database setup (prisma db push) failed. See the message above."
fi
echo "  [ok] Database is ready"

# 5. Start the app.
#    We use the development server on purpose:
#      - it boots fast (no separate build step on every launch), and
#      - it allows the built-in development session secret, so you do NOT need
#        to set AUTH_SECRET just to try the app locally.
#    (For a real deployment, build with `npm run build`, set a real AUTH_SECRET,
#     and run `npm start` - see the README.)
echo ""
echo "  Everything is ready. Starting the server..."
echo ""
echo "  >>> Open ${URL} in your browser <<<"
echo ""
echo "  (AI features are optional and need a free Gemini key - see README.md."
echo "   Press Ctrl+C to stop the server.)"
echo ""

exec npm run dev
