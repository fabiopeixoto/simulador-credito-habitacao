#!/usr/bin/env sh
# Validação de sintaxe Node (equivalente ao script npm "lint").
# Usar no Jenkins sem depender de `npm` no PATH do contentor.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

lint_one() {
  node --check "$1"
}

for f in \
  server.js \
  sw.js \
  lib/open-sqlite.js \
  sim-shared-constants.js \
  js/core/calc.js \
  js/core/constants.js \
  js/core/styles.js \
  js/components/slider-input.js \
  app.js \
  inversa-bootstrap.js \
  page-header.js \
  comments-modal.js \
  glossario-modal.js \
  bank-detail-modal.js \
  reverse-calc-page.js \
  transferencia-page.js \
  historico-page.js \
  index-mount.js \
  inversa-mount.js \
  transferencia-mount.js \
  historico-mount.js \
  api/banks.js \
  api/spreads.js \
  api/comments.js \
  api/stats.js \
  api/euribor.js \
  api/euribor-history.js
do
  lint_one "$f"
done
