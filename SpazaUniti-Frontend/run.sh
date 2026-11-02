#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PORT=3001
echo "Starting Spaza Uniti Customer Portal on http://localhost:$PORT..."
exec python3 -m http.server $PORT
