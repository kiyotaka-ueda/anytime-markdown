#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WEB_APP_DIR="$PROJECT_DIR/../web-app"

echo "==> Building static web app..."
cd "$WEB_APP_DIR"
npm run build:static

echo "==> Syncing with Capacitor..."
cd "$PROJECT_DIR"
npx cap sync

echo "==> Done!"
