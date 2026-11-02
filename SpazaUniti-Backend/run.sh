#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PORT="${PORT:-8001}"
HOST="${HOST:-0.0.0.0}"

# Find virtualenv in Backend/venv or local venv
if [ -f "$DIR/../Backend/venv/bin/uvicorn" ]; then
    UVICORN_BIN="$DIR/../Backend/venv/bin/uvicorn"
elif [ -f "$DIR/venv/bin/uvicorn" ]; then
    UVICORN_BIN="$DIR/venv/bin/uvicorn"
else
    UVICORN_BIN="uvicorn"
fi

echo "=========================================================="
echo " Starting Spaza Uniti Customer & Open Payments Backend"
echo " Host: http://$HOST:$PORT"
echo " Discovery Endpoint: http://$HOST:$PORT/{username}"
echo " Customer Register:  http://$HOST:$PORT/api/customers/register"
echo " Interactive Grants: http://$HOST:$PORT/consent/{grant_id}"
echo "=========================================================="

cd "$DIR"
exec "$UVICORN_BIN" app.main:app --host "$HOST" --port "$PORT" --reload
