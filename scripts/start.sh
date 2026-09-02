#!/usr/bin/env bash
set -e
# Wrapper — delegates to root start.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/../start.sh" "$@"
