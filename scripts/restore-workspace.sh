#!/usr/bin/env bash
# Restore the sandbox workspace after a snapshot recycle (local git history,
# node_modules, dist and the demo database are dropped; the remote is safe).
set -e
cd "$(dirname "$0")/.."
echo "== git =="
if [ "$(git rev-parse HEAD)" = "7f40d2f39d5637d771ee30f69df19c75a9d935e4" ] || [ "$(git log --oneline -1 --format=%s)" = "Initial commit" ]; then
  git fetch origin --tags --quiet
  git fetch origin refs/heads/arena/01a0a5c6-mvpmi:refs/remotes/origin/arena/01a0a5c6-mvpmi --quiet || true
  git reset --mixed origin/arena/01a0a5c6-mvpmi --quiet
fi
git log --oneline -1
git status --short | wc -l | xargs echo "uncommitted changes:"
echo "== dependencies =="
[ -d node_modules/playwright ] || npm ci --no-audit --no-fund >/dev/null 2>&1
echo "node_modules ready"
echo "== build =="
npm run build >/dev/null
echo "== demo data =="
[ -f data/community.sqlite ] || { mkdir -p data; node scripts/seed-demo.mjs 2>/dev/null | tail -1; }
echo "== done =="
