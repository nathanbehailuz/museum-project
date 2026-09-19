#!/bin/bash
set -euo pipefail
cd /Users/nathanbehailu/Desktop/museum-exhibition
export MET_CSV_CONCURRENCY="${MET_CSV_CONCURRENCY:-1}"
export MET_CSV_GAP_MS="${MET_CSV_GAP_MS:-500}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/nathanbehailu/.nvm/versions/node/v22.9.0/bin:/usr/bin:/bin"
exec /opt/homebrew/bin/node --import tsx scripts/ingest/load-csv.ts
