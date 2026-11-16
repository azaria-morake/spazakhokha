#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PORT=3001
echo "Starting Spaza Uniti Marketplace React Frontend on http://localhost:$PORT..."
exec npx vite --port $PORT --host 0.0.0.0
