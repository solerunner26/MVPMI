#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js LTS from https://nodejs.org first, then open this file again.'
  read -r answer
  exit 1
fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' || {
  echo 'Please update Node.js to version 22.13 or a newer LTS release.'
  exit 1
}
npm ci --omit=dev || exit 1
node scripts/start-test-server.mjs
