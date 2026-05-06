#!/usr/bin/env bash
# trail-viewer performance baseline: local Lighthouse median across 5 runs.
# Prerequisite: dev server is running at http://localhost:3000.
set -euo pipefail

URL="${1:-http://localhost:3000/trail}"
OUT_DIR="/tmp/perf-lighthouse-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR"

if [[ -z "${CHROME_PATH:-}" ]]; then
  CHROME_PATH="$(find "${HOME}/.cache/ms-playwright" -path '*/chrome-linux*/chrome' -type f 2>/dev/null | sort | tail -1 || true)"
  export CHROME_PATH
fi

if [[ -z "${CHROME_PATH:-}" || ! -x "$CHROME_PATH" ]]; then
  echo "ERROR: CHROME_PATH must point to a Chrome/Chromium executable." >&2
  exit 1
fi

echo "Running Lighthouse 5 times against: $URL"
echo "Output dir: $OUT_DIR"
echo "Chrome: $CHROME_PATH"

for i in $(seq 1 5); do
  echo "Run $i/5..."
  npx lighthouse "$URL" \
    --output=json \
    --output=html \
    --output-path="$OUT_DIR/run-$i" \
    --chrome-flags="--headless --no-sandbox" \
    --only-categories=performance \
    --quiet
done

echo ""
echo "=== Median values (LCP / INP / CLS / TBT) ==="
node -e "
const fs = require('fs');
const path = require('path');
const dir = process.argv[1];
const metrics = [
  'largest-contentful-paint',
  'interaction-to-next-paint',
  'cumulative-layout-shift',
  'total-blocking-time',
];
const values = Object.fromEntries(metrics.map((m) => [m, []]));
for (let i = 1; i <= 5; i++) {
  const json = JSON.parse(fs.readFileSync(path.join(dir, \`run-\${i}.report.json\`), 'utf8'));
  for (const m of metrics) {
    const v = json.audits[m]?.numericValue;
    if (typeof v === 'number') values[m].push(v);
  }
}
function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
for (const m of metrics) {
  const med = median(values[m]);
  console.log(\`\${m}: median=\${med.toFixed(0)}ms (samples=\${values[m].map((v) => v.toFixed(0)).join(', ')})\`);
}
" "$OUT_DIR"
