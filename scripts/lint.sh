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
  lib/open-sqlite.js \
  public/sw.js \
  public/admin.js \
  public/js/shared/sim-shared-constants.js \
  public/js/shared/inversa-bootstrap.js \
  public/js/shared/page-header.js \
  public/js/vendor/react-runtime.js \
  public/js/core/calc.js \
  public/js/core/constants.js \
  public/js/core/styles.js \
  public/js/components/slider-input.js \
  public/js/components/ref-badge.js \
  public/js/components/hist-modal.js \
  public/js/components/comments-modal.js \
  public/js/components/rating-widget.js \
  public/js/components/glossario-modal.js \
  public/js/components/bank-detail-modal.js \
  public/js/components/comp-table-mobile.js \
  public/js/components/comp-table-desktop.js \
  public/js/components/seg-table-mobile.js \
  public/js/components/cust-table-mobile.js \
  public/js/components/cen-table-mobile.js \
  public/js/components/transf-table-mobile.js \
  public/js/views/header-bar.js \
  public/js/views/params-panel.js \
  public/js/views/view-comp.js \
  public/js/views/view-seguros.js \
  public/js/views/view-custos.js \
  public/js/views/view-viabilidade.js \
  public/js/views/view-cenarios.js \
  public/js/views/view-amortizacao.js \
  public/js/pages/app.js \
  public/js/pages/index-mount.js \
  public/js/pages/inversa-mount.js \
  public/js/pages/transferencia-mount.js \
  public/js/pages/historico-mount.js \
  public/js/pages/reverse-calc-page.js \
  public/js/pages/transferencia-page.js \
  public/js/pages/historico-page.js \
  api/banks.js \
  api/spreads.js \
  api/comments.js \
  api/rating.js \
  api/stats.js \
  api/euribor.js \
  api/euribor-history.js
do
  lint_one "$f"
done
