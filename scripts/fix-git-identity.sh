#!/usr/bin/env bash
# fix-git-identity.sh
# Enforces correct git identity and optionally repairs the last commit.
# Usage: pnpm run fix-git-identity

set -euo pipefail

REQUIRED_NAME="fikrimamdouh"
REQUIRED_EMAIL="rorofikri@gmail.com"

echo "🔧  Fixing git identity..."
echo ""

# Apply global (always writable)
git config --global user.name  "$REQUIRED_NAME"
git config --global user.email "$REQUIRED_EMAIL"
echo "  ✅  global user.name  = $(git config --global user.name)"
echo "  ✅  global user.email = $(git config --global user.email)"

# Apply local (may be temporarily locked — skip gracefully)
if git config user.name  "$REQUIRED_NAME" 2>/dev/null && \
   git config user.email "$REQUIRED_EMAIL" 2>/dev/null; then
  echo "  ✅  local  user.name  = $(git config user.name)"
  echo "  ✅  local  user.email = $(git config user.email)"
else
  echo "  ⚠️   local .git/config locked — global config applies."
fi

echo ""

# Check last commit author
LAST_AUTHOR=$(git log -1 --pretty=format:'%ae' 2>/dev/null || echo "unknown")
echo "  Last commit author: $LAST_AUTHOR"

if echo "$LAST_AUTHOR" | grep -q "noreply.replit.com"; then
  echo "  ⚠️   Wrong author detected — amending last commit..."
  git commit --amend --reset-author --no-edit
  echo "  ✅  Last commit author fixed → $(git log -1 --pretty=format:'%ae')"
else
  echo "  ✅  Last commit author is correct."
fi

echo ""
echo "✅  Done. Future commits will use: $REQUIRED_EMAIL"
