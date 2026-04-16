#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install root dependencies (main Tauri frontend)
if [ -f package.json ]; then
  npm install 2>/dev/null || true
fi

# Install landing page dependencies
if [ -f landing/package.json ]; then
  (cd landing && npm install 2>/dev/null || true)
fi

# Install SDK dependencies
if [ -f sdk/package.json ]; then
  (cd sdk && npm install 2>/dev/null || true)
fi
