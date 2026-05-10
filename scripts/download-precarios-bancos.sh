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

if [[ ! -r "$SRC" ]]; then
  echo "Ficheiro em falta ou sem permissão de leitura: $SRC" >&2
  exit 1
fi

if ! jq empty "$SRC" 2>&1; then
  echo "sources.json não é JSON válido: $SRC" >&2
  exit 1
fi

if ! jq -e '.items | type == "array" and length > 0' "$SRC" >/dev/null; then
  echo "sources.json inválido: é necessário um array .items não vazio em $SRC" >&2
  exit 1
fi

if ! items_json=$(jq -c '.items[]' "$SRC"); then
  echo "Erro ao extrair .items[] de $SRC (jq falhou)." >&2
  exit 1
fi
if [[ -z "$items_json" ]]; then
  echo "Nenhum item obtido de .items em $SRC (lista inesperadamente vazia)." >&2
  exit 1
fi

jq -r '.info_pt // empty' "$SRC"
echo "Destino: $OUT"
echo ""

n=0
ok=0
fail=0

while IFS= read -r row || [[ -n "${row:-}" ]]; do
  [[ -z "${row// }" ]] && continue
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
done <<< "$items_json"

echo "Concluído: $ok OK, $fail falhas (total $n)."

if (( n == 0 )); then
  echo "Erro: nenhuma linha processada (verifique .items em $SRC)." >&2
  exit 1
fi

if (( fail > 0 )); then
  echo "Saída com erro: $fail download(s) falharam." >&2
  exit 1
fi
