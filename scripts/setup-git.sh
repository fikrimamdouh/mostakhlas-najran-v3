#!/usr/bin/env bash
# setup-git.sh
# Run once (or on every Replit session start) to enforce correct git identity
# and install the pre-commit hook.
# Usage: pnpm run setup-git

set -euo pipefail

REQUIRED_NAME="fikrimamdouh"
REQUIRED_EMAIL="rorofikri@gmail.com"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "🔧  Setting up git identity..."

# Always apply global config (persists across sessions in this Replit)
git config --global user.name  "$REQUIRED_NAME"
git config --global user.email "$REQUIRED_EMAIL"
echo "  ✅  global user.name  = $(git config --global user.name)"
echo "  ✅  global user.email = $(git config --global user.email)"

# Apply local config — skip gracefully if .git/config is temporarily locked
if git config user.name  "$REQUIRED_NAME" 2>/dev/null && \
   git config user.email "$REQUIRED_EMAIL" 2>/dev/null; then
  echo "  ✅  local user.name  = $(git config user.name)"
  echo "  ✅  local user.email = $(git config user.email)"
else
  echo "  ⚠️   Could not write local .git/config (locked). Global config applies."
fi

# Install pre-commit hook from scripts/git-hooks/
HOOK_SRC="$REPO_ROOT/scripts/git-hooks/pre-commit"
HOOK_DST="$REPO_ROOT/.git/hooks/pre-commit"

if [ -f "$HOOK_SRC" ]; then
  cp "$HOOK_SRC" "$HOOK_DST"
  chmod +x "$HOOK_DST"
  echo "  ✅  pre-commit hook installed → $HOOK_DST"
else
  echo "  ⚠️   Hook source not found: $HOOK_SRC"
fi

echo ""
echo "✅  Git setup complete. All commits will use $REQUIRED_EMAIL"
