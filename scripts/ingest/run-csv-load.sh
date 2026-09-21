#!/bin/bash
# Durable full-catalog load: resume from checkpoint, retry on crash, then connections.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export MET_CSV_CONCURRENCY="${MET_CSV_CONCURRENCY:-1}"
export MET_CSV_GAP_MS="${MET_CSV_GAP_MS:-500}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

LOG="$ROOT/data/met/csv-load.log"
PIDFILE="$ROOT/data/met/csv-load.pid"
TSX="$ROOT/node_modules/.bin/tsx"
echo $$ > "$PIDFILE"

log() { echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) $* ===" | tee -a "$LOG"; }

log "catalog load supervisor start pid=$$ concurrency=$MET_CSV_CONCURRENCY gap=${MET_CSV_GAP_MS}ms"

while true; do
  if "$TSX" scripts/ingest/load-csv.ts 2>&1 | tee -a "$LOG"; then
    log "ingest ok"
    break
  fi
  log "ingest failed; retry in 45s"
  sleep 45
done

if "$TSX" scripts/ingest/compute-connections.ts 2>&1 | tee -a "$LOG"; then
  log "connections ok — full catalog load finished"
else
  log "connections failed — rerun: npm run ingest:connections"
  exit 1
fi

rm -f "$PIDFILE"
