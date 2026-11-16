#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
source "$DIR/venv/bin/activate"

echo "Starting SpazaKhokha FastAPI backend on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
