#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PORT=3000
echo "Starting SpazaKhokha POS Admin Console (React + Vite + ShadCN) on http://localhost:$PORT..."
exec npx vite --port $PORT --host 0.0.0.0
