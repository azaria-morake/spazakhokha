#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "=========================================================="
echo " Starting UbuOne Unit & RBAC Portal on http://localhost:3000"
echo " Engine API: http://localhost:8001"
echo "=========================================================="
npm run dev
