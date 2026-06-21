# Documentação de Desenvolvimento

Referência interna: APIs, variáveis de ambiente, CI/CD, convenções de código e base de dados.

---

## Stack técnica

| Componente | Detalhe |
|------------|---------|
| Runtime | Node.js 20 |
| Servidor | `server.js` — `http.createServer`, ficheiros estáticos servidos de `public/`, **Brotli/Gzip** |
| Base de dados | SQLite em `data/` via `better-sqlite3` |
| Frontend | React servido em ficheiros separados e cacheados — sem build step |
| Container | `Dockerfile` — `node:20-slim`, toolchain para `better-sqlite3`, `npm ci --omit=dev` |

---

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `PORT` | Porta HTTP (defeito **3000**) |
| `GEMINI_API_KEY` | Activa `POST /api/spreads` (Gemini + URL context tool) |
| `ADMIN_TOKEN` | Autentica operações admin (bancos, spreads, comentários, estatísticas) |
| `SPREADS_AUTO_APPLY` | `=1` publica resultado da AI sem revisão manual |
| `GEMINI_MODEL` | Modelo Gemini a usar (defeito `gemini-2.5-pro`) |
| `DEBUG_SECRET` | Endpoint de diagnóstico dos comentários |

---

## APIs HTTP

Todas as rotas JSON usam UTF-8.

### `GET /api/banks`

Público. Devolve `{ banks, euribor }`. Suporta ETag (`If-None-Match`) — devolve `304` quando nada mudou.

Query opcional: `?history=CA` — últimas entradas de spreads do banco.

### `POST /api/banks`

Requer `x-admin-token`. Corpo: `{ bank, spreads }` — cria ou actualiza banco e insere linha de spreads.

### `DELETE /api/banks?code=XX`

Requer `x-admin-token`. Desactiva o banco.

---

### `GET /api/euribor-history`

Público. Devolve `{ "3m": [{date, value}], "6m": […], "12m": […] }`. Cache SQLite com TTL 6 h.

---

### `POST /api/spreads`

Requer `x-admin-token`. Dispara actualização via Google Gemini (lê preçários PDF) + Euribor BCE em background.

Fluxo:
1. Responde imediatamente `202 {status:"refreshing"}`.
2. `GET /api/spreads` devolve estado do refresh.
3. Resultado fica em revisão até aprovação:
   - `x-spreads-action: approve` — publica (aceita `x-spreads-codes` para aprovação parcial por banco).
   - `x-spreads-action: reject` — descarta.

Seed fallbacks: campos de seguros (`vRef`, `mAno`, `insV`, `insM`) e `capMax` mantêm o valor curado da BD em vez da estimativa do modelo.

---

### `/api/comments`

| Método | Auth | Descrição |
|--------|------|-----------|
| `GET` | — | Lista até 100 comentários com respostas. Cache 30 s. |
| `POST` | — | Novo comentário ou resposta (`parentId`). Texto 5–500 caracteres. |
| `DELETE` | `x-admin-token` | Apaga por `?id=` (inclui respostas). |

---

### `GET /api/stats`

Requer `x-admin-token`. Devolve visitas totais, por dia, localização dos visitantes e contagem de comentários.

### `DELETE /api/stats`

Requer `x-admin-token`. Apaga todas as estatísticas e regista timestamp de reset.

---

## Ficheiros SQLite (`data/`)

| Ficheiro | Conteúdo |
|----------|----------|
| `banks.sqlite` | Bancos, histórico de spreads, cache Euribor + histórico BCE |
| `spreads.sqlite` | Cache do resultado Gemini pendente de aprovação |
| `comments.sqlite` | Comentários e respostas |
| `stats.sqlite` | Visitas diárias, totais, localização por cidade, configuração de resets |

---

## Convenções de código

### Mobile/desktop

- `IS_MOBILE` vem de `window._SIM_SHARED.isMobileDevice` (definido em `sim-shared-constants.js`). Cada ficheiro lê-o localmente — nunca passa por props.
- Se o markup mobile divergir estruturalmente, divide-se em `*-mobile.js` / `*-desktop.js` com branch `IS_MOBILE ? A : B` no pai. Se só mudam estilos, fica um ficheiro com ternários.

### Cache busting

Ao alterar qualquer `.js` servido:
1. Incrementar `?v=N` no(s) HTML correspondentes.
2. Actualizar o mesmo path no `PRECACHE` de `public/sw.js`.
3. Subir a constante `CACHE` (`simulador-vNNN`).
4. Adicionar ficheiros novos a `scripts/lint.sh`.

---

## CI/CD (Jenkins)

O `Jenkinsfile` executa 3 fases:
1. **Validate** — `node --check` em todos os ficheiros JS.
2. **Actualizar Spreads** — cron automático (só em schedule).
3. **Build and Deploy** — build Docker + restart do contentor com volume persistente.

Notificações de build via Discord webhook.

---

## Scripts

- `npm run lint` — validação de sintaxe de todos os ficheiros JS.
- `npm run audit:urls` — verifica URLs de preçários configurados em `api/spreads.js`. Requer `GEMINI_API_KEY`.
- `scripts/download-precarios-bancos.sh` — descarrega PDFs de preçários. Requer `jq`.
- `scripts/apply-overrides.js` — aplica overrides manuais via API admin (uso pontual).
