#!/usr/bin/env bash
set -e
# Bump VERSION (patch by default) and create git tag
# Usage: ./scripts/bump-version.sh [major|minor|patch]
# Default: patch
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MODE="${1:-patch}"
CUR=$(cat VERSION 2>/dev/null | tr -d '[:space:]' || echo "0.1.0")
IFS='.' read -r MAJ MIN PAT <<< "$CUR"
MAJ=${MAJ:-0}; MIN=${MIN:-1}; PAT=${PAT:-0}
case "$MODE" in
  major) MAJ=$((MAJ+1)); MIN=0; PAT=0 ;;
  minor) MIN=$((MIN+1)); PAT=0 ;;
  patch) PAT=$((PAT+1)) ;;
  *) echo "Unknown mode $MODE (use major|minor|patch)"; exit 1 ;;
esac
NEW="$MAJ.$MIN.$PAT"
echo "$NEW" > VERSION
echo "Bumped $CUR → $NEW ($MODE)"
# Update frontend/backend version if present
if [ -f "frontend/package.json" ]; then
  # update version in package.json quietly
  python3 -c "import json; p='frontend/package.json'; d=json.load(open(p)); d['version']='$NEW'; open(p,'w').write(json.dumps(d, indent=2)+'\n')" 2>/dev/null || true
fi
echo "New VERSION: v$NEW"
