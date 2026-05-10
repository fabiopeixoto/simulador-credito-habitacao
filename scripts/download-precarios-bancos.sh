#!/usr/bin/env bash
# Descarrega os PDFs listados em reference/precarios-pdf/sources.json
# Uso: ./scripts/download-precarios-bancos.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/reference/precarios-pdf/sources.json"
OUT="$ROOT/reference/precarios-pdf/files"
UA="Mozilla/5.0 (compatible; simulador-ch-precarios/1.0)"

mkdir -p "$OUT"

if ! command -v jq >/dev/null 2>&1; then
  echo "Instale jq (ex.: apt install jq)." >&2
  exit 1
fi

jq -r '.info_pt' "$SRC" 2>/dev/null || true
echo "Destino: $OUT"
echo ""

n=0
ok=0
fail=0

while IFS= read -r row; do
  n=$((n + 1))
  bank=$(echo "$row" | jq -r '.bank')
  label=$(echo "$row" | jq -r '.label')
  saveAs=$(echo "$row" | jq -r '.saveAs')
  url=$(echo "$row" | jq -r '.url')
  referer=$(echo "$row" | jq -r '.referer // empty')
  note=$(echo "$row" | jq -r '.note // empty')

  dest="$OUT/$saveAs"
  echo "[$n] $bank — $label → $saveAs"
  if [[ -n "$note" ]]; then
    echo "    ℹ $note"
  fi

  args=(-fsSL -A "$UA" --connect-timeout 25 --retry 2 --retry-delay 2 -o "$dest" "$url")
  if [[ -n "$referer" ]]; then
    args=(-fsSL -A "$UA" -e "$referer" --connect-timeout 25 --retry 2 --retry-delay 2 -o "$dest" "$url")
  fi

  if curl "${args[@]}"; then
    if file "$dest" | grep -qi 'pdf'; then
      ok=$((ok + 1))
      echo "    ✓ OK ($(wc -c < "$dest" | tr -d ' ') bytes)"
    else
      fail=$((fail + 1))
      echo "    ✗ Ficheiro não parece PDF — verifique o URL." >&2
    fi
  else
    fail=$((fail + 1))
    echo "    ✗ Falha no download." >&2
  fi
  echo ""
done < <(jq -c '.items[]' "$SRC")

echo "Concluído: $ok OK, $fail falhas (total $n)."
