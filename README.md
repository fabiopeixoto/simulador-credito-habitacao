# Simulador Crédito Habitação Portugal

Aplicação web para **simular e comparar** crédito habitação em Portugal: prestação, TAEG, MTIC, DSTI, cenários de Euribor, amortizações, custos iniciais e comentários da comunidade. O frontend é uma **SPA React** servida como ficheiros estáticos separados (sem build step); o backend é um servidor HTTP minimalista em Node.js com APIs REST e **SQLite** (`better-sqlite3`).

> Simulação meramente **indicativa**. Confirmar sempre as condições na **FINE** e na proposta do banco.

---

## Funcionalidades (utilizador)

- Comparação entre **12 bancos** (dados editáveis na base com valores seed).
- Modos **crédito normal** e **crédito jovem** (regras BdP, LTV, finalidade HPP / 2.ª habitação / arrendamento).
- Taxa **variável, mista ou fixa**; vários indexantes Euribor onde aplicável.
- **Euribor** (3m / 6m / 12m) com origem na **API do BCE** (CSV); a página pública lê o valor **da base de dados** (`GET /api/banks`) — o BCE só é consultado no refresh do admin. O histórico (`/historico.html`) usa `GET /api/euribor-history`.
- **Spreads e comissões** lidos da API `GET /api/banks` com fallback local em caso de falha de rede. O botão **Actualizar** da página inicial relê os valores da BD (não chama APIs externas).
- Gráficos e tabelas (cenários Euribor, barras de prestação, amortização, seguros, etc.).
- **Partilha por URL**, histórico local (localStorage), secção de **comentários** com respostas.
- **Calculadora inversa** (`/quanto-posso-pedir.html`): capital máximo dado rendimento, DSTI e taxa.
- **Transferência de crédito** (`/transferencia.html`): compara bancos para transferir um crédito existente (poupança ao trocar de banco).
- **Histórico** (`/historico.html`): gráfico da Euribor BCE (3m/6m/12m) e evolução de spreads por banco.
- **Glossário** e **detalhe por banco** em modais; **política de privacidade** (`/privacidade.html`).
- **PWA**: `manifest.json`, `icon.svg`, Service Worker (`sw.js`) com precache de assets; pedidos `GET /api/*` **não** são cacheados pelo SW.

---

## Stack técnica

| Componente | Detalhe |
|------------|---------|
| Runtime | Node.js 20 |
| Servidor | `server.js` — `http.createServer`, ficheiros estáticos, **Brotli/Gzip** quando o cliente aceita |
| Base de dados | SQLite em `data/` (vários ficheiros; ver abaixo) |
| Frontend | React servido em ficheiros separados e cacheados (`react-runtime.js`, `app.js`, etc.) — sem build step |
| Container | `Dockerfile` — `node:20-slim`, toolchain para `better-sqlite3`, `npm ci --omit=dev`, `CMD node server.js` |

---

## Estrutura do repositório

```text
├── index.html               # Página inicial — carrega react-runtime + app + index-mount
├── quanto-posso-pedir.html  # Calculadora inversa (capital máximo por rendimento)
├── transferencia.html       # Transferência de crédito habitação (comparar bancos p/ trocar)
├── historico.html           # Histórico Euribor BCE + spreads por banco
├── privacidade.html         # Política de privacidade
├── admin.html               # Painel admin (bancos, spreads, comentários, estatísticas)
├── server.js                # Encaminhamento estático + APIs
├── sw.js                    # Service Worker (precache de assets)
├── manifest.json            # PWA
├── icon.svg, og-image.svg
│
├── react-runtime.js         # React + ReactDOM (imutável, partilhado entre páginas)
├── recharts-polyfill.js     # Polyfill SVG Recharts (imutável)
├── app.js                   # Componente App (estado, derivados, orquestração das vistas)
├── index-mount.js           # Mount do App na página inicial + registo SW
├── inversa-bootstrap.js     # Globals partilhados (_SIM): cores, LTV_BRACKETS, BANK_DOMAINS
├── page-header.js           # NavHeader partilhado (Euribor badges + tabs de navegação)
├── reverse-calc-page.js     # Componente da calculadora inversa
├── inversa-mount.js         # Mount da calculadora inversa
├── transferencia-page.js    # Componente da página de transferência de crédito
├── transferencia-mount.js   # Mount da página de transferência
├── historico-page.js        # Componente da página de histórico
├── historico-mount.js       # Mount da página de histórico
├── comments-modal.js        # Modal de comentários (partilhado entre páginas)
├── glossario-modal.js       # Modal de glossário (termos de crédito habitação)
├── bank-detail-modal.js     # Modal de detalhe por banco (spreads, comissões, origem)
├── admin.css, admin.js      # Estilos e lógica do painel admin (extraídos de admin.html)
│
├── js/
│   ├── core/                # Lógica pura, sem React — registada em window._SIM
│   │   ├── calc.js          # calcP, calcTAEG, calcMTIC, sTot, calcIMT, simA, getLTVAddon, fE/fP…
│   │   ├── constants.js     # FINALIDADE_ADDON, FINALIDADE_MAX_LTV, NAV
│   │   └── styles.js        # Estilos de tabela (thS, tdB…) e helpers de cor (ecC, ecL, rbg)
│   ├── components/          # Componentes React partilhados
│   │   ├── slider-input.js  # SliderInput único (todas as páginas)
│   │   ├── ref-badge.js     # Etiqueta do indexante Euribor
│   │   └── hist-modal.js    # Modal de simulações guardadas
│   └── views/               # Uma vista por tab do simulador (props in / JSX out, sem hooks)
│       ├── header-bar.js    # Barra superior (chips Euribor, botões)
│       ├── params-panel.js  # Parâmetros Globais + Titulares (acordeões mobile vivem aqui)
│       ├── view-comp.js     # Comparação — IS_MOBILE ? CompTableMobile : CompTableDesktop
│       └── view-{seguros,custos,viabilidade,cenarios,amortizacao}.js
│
├── comp-table-mobile.js     # Tabela de comparação compacta (só mobile)
├── comp-table-desktop.js    # Tabela de comparação completa (23 colunas, desktop)
│
├── api/
│   ├── banks.js             # CRUD bancos/spreads, Euribor (servida da BD), seed SQLite; ETag em GET
│   ├── spreads.js           # POST (só admin): Gemini + BCE, revisão/aprovação, seed fallbacks
│   ├── euribor.js           # Fetch Euribor (3m/6m/12m) da API do BCE (usado no refresh do admin)
│   ├── comments.js          # Comentários + respostas (SQLite, cache 30s, UUID)
│   ├── stats.js             # Estatísticas de visitas + localização por cidade
│   └── euribor-history.js   # Histórico BCE (3m/6m/12m) com cache SQLite
│
├── data/                    # Criado em runtime — SQLite (persistente em Docker volume)
├── scripts/
│   └── download-precarios-bancos.sh   # Descarrega PDFs listados em reference/
├── reference/precarios-pdf/           # Metadados JSON + PDFs locais (opcional / manual)
├── Jenkinsfile              # CI/CD Docker + deploy + Discord
├── Dockerfile
├── AUDITORIA.md             # Template para validar resultados vs simuladores oficiais
└── README.md
```

### Convenções mobile/desktop

- `IS_MOBILE` vem de `window._SIM_SHARED.isMobileDevice` (user-agent, definido **apenas** em `sim-shared-constants.js`). Cada vista lê-o no topo do próprio ficheiro — nunca passa por props.
- Se o markup mobile divergir estruturalmente do desktop, divide-se em `*-mobile.js` / `*-desktop.js` com um único branch `IS_MOBILE ? A : B` no pai (exemplo: `comp-table-mobile.js` / `comp-table-desktop.js`, ramificados em `js/views/view-comp.js`). Se só mudam valores de estilo, fica um ficheiro com ternários.
- A UI de parâmetros mobile (acordeões) vive em `js/views/params-panel.js` — alterações mobile a esta zona tocam só nesse ficheiro.
- Ao alterar qualquer `.js` servido: incrementar o `?v=` no(s) HTML **e** no `PRECACHE` do `sw.js` (strings iguais), e subir a constante `CACHE` (`simulador-vNNN`) — caso contrário os clientes ficam presos na versão antiga (cache immutable de 1 ano). Ficheiros novos entram também em `scripts/lint.sh`.

---

## APIs HTTP

Todas as rotas JSON usam UTF-8. CORS permissivo nas APIs (`Access-Control-Allow-Origin: *`).

### `GET /api/banks`

Público. Devolve `{ banks, euribor }`:

- **`banks`**: lista de bancos activos com `spreads` mais recentes por banco.
- **`euribor`**: objecto servido **da base de dados** (sem rede no carregamento público). A actualização a partir do BCE acontece apenas no refresh do admin (`POST /api/spreads`).
- Suporta **ETag** (`If-None-Match`) baseado nos timestamps de spreads, Euribor e metadados de bancos — devolve `304` quando nada mudou.

Query opcional:

- `GET /api/banks?history=CA` — últimas entradas de spreads do banco (útil para admin).

### `POST /api/banks`

Requer cabeçalho **`x-admin-token`** igual a `ADMIN_TOKEN`.

Corpo JSON típico: `{ bank: { … }, spreads: { … } }` — cria ou actualiza banco e insere linha de spreads (manual).

### `DELETE /api/banks?code=XX`

Requer **`x-admin-token`**. Desactiva o banco (`active = 0`).

---

### `GET /api/euribor-history`

Público. Devolve `{ "3m": [{date, value}], "6m": […], "12m": […] }` — série histórica desde 2015 obtida da **API do BCE**.

Cache em memória + persistência em `banks.sqlite` (`kv_store`) com TTL 6 h. Após o primeiro fetch bem-sucedido, respostas a cold-starts são imediatas.

---

### `POST /api/spreads`

Actualização massiva via **Google Gemini** (modelo `gemini-2.5-pro` com a *URL context tool* a ler directamente os preçários oficiais em PDF — extrai texto e tabelas — resposta validada por JSON schema) + Euribor BCE.

**Só o admin** pode disparar a extração: `POST /api/spreads` **requer `x-admin-token`** (sem token → `403`). Não há limite diário nem rate limiter — o gatilho é manual e exclusivo do painel admin. A página pública nunca chama o Gemini nem o BCE (lê tudo da BD via `GET /api/banks`).

A chamada corre em background (lotes de `generateContent` repartidos pelo limite de 20 URLs/pedido, ~1–3 min; bancos com falha transitória de URL são re-tentados individualmente). Fluxo:

1. `POST /api/spreads` (admin) **inicia o refresh em background** e responde de imediato (`202 {status:"refreshing"}`, ou `200 {status:"already-running"}`).
2. **`GET /api/spreads`** (público) devolve o estado do refresh (`{running, error, updatedAt, pending:{bancos, fetchedAt, spreads}}`).
3. O resultado fica **em revisão** — não substitui os dados servidos até ser aprovado:
   - `POST /api/spreads` com `x-admin-token` + `x-spreads-action: approve` → publica. Aceita `x-spreads-codes` (lista separada por vírgulas) para **aprovação parcial** por banco.
   - `… x-spreads-action: reject` → descarta.
   - Define **`SPREADS_AUTO_APPLY=1`** para auto-publicar sem revisão (comportamento antigo).

**Seed fallbacks** (aplicados antes da validação): campos que não constam dos preçários — prémios de seguros (`vRef`, `mAno`, seguradoras `insV`/`insM`) e `capMax` — mantêm o valor curado/manual da BD em vez da estimativa do modelo. As taxas mista/fixa (`mCom`/`mSem`/`fCom`/`fSem`) são **opcionais**: quando o modelo devolve `null`, mantém-se o último valor conhecido da BD.

Persistência: ao aprovar grava spreads em `banks.sqlite` via `bulkInsertSpreads`; a Euribor obtida no refresh é persistida em `banks.js` (`setEuribor`).

Variável obrigatória no servidor: **`GEMINI_API_KEY`**. Opcional: **`SPREADS_AUTO_APPLY`**, **`GEMINI_MODEL`**.

#### Origem dos dados de spreads

O refresh lê os **preçários oficiais em PDF** de cada banco (taxas §18.1 + comissões §18.2) configurados em `BANK_SOURCES` (`api/spreads.js`). A *URL context tool* do Gemini busca os PDFs do lado dos servidores Google, evitando bloqueios de IP; bancos cujo site bloqueia o fetcher (ex.: ABANCA) usam o preçário combinado do **Portal do Cliente Bancário (BdP)**.

Cada banco é classificado por **origem** (mostrada no admin e no detalhe por banco):

| Badge | Origem |
|-------|--------|
| 📄 Preçário (API) | lido do preçário oficial via Gemini |
| ≈ Estimativa | o modelo não conseguiu ler o valor (URL falhou ou campo ausente) e estimou |
| ✍ Manual | inserido manualmente no admin |
| ◆ Canónico | valor do seed (ainda sem extração) |

O *prompt* instrui o modelo a só marcar **Estimativa** quando os **spreads/TAN ou as comissões** forem estimados — nunca por causa dos campos de seguros/`capMax` (que vêm sempre dos seed fallbacks). `npm run audit:urls` valida que todos os URLs de `BANK_SOURCES` continuam acessíveis.

---

### `/api/comments`

| Método | Auth | Descrição |
|--------|------|-----------|
| `GET` | — | Lista até 100 comentários raiz com `replies` encadeadas. Cache em memória de 30 s, invalidado em escrita. |
| `POST` | — | Novo comentário ou resposta (`parentId`). Texto 5–500 caracteres. IDs gerados com `crypto.randomUUID()`. |
| `DELETE` | `x-admin-token` | Apaga por `?id=` (inclui respostas ao mesmo id). |
| `GET ?debug=1&secret=` | `DEBUG_SECRET` | Diagnóstico SQLite (uso interno). |

---

### `GET /api/stats`

Requer **`x-admin-token`**. Devolve:

```json
{
  "homepageTotal": 12345,
  "adminTotal": 42,
  "today": { "date": "2025-05-17", "homepage": 80, "admin": 2 },
  "recordedSince": "2025-01-01",
  "resetAt": "2025-06-20T15:32:00.000Z",
  "last7Days": [ { "day": "…", "homepage": 0, "admin": 0 } ],
  "commentsTotal": 99,
  "locations": [ { "city": "Lisboa", "country_code": "PT", "country_name": "Portugal", "count": 500 } ],
  "generatedAt": "…"
}
```

- `resetAt` — ISO timestamp do último reset das estatísticas (ausente se nunca houve reset).
- `recordedSince` — primeiro dia com registo na tabela `daily` (pode ser `null` após um reset antes de haver visitas).
- `locations` mostra as cidades de origem dos visitantes da página inicial (top 100 por contagem), obtidas via [ip-api.com](http://ip-api.com) em background. Os IPs nunca são persistidos — apenas cidade + código do país ficam em `stats.sqlite`.

### `DELETE /api/stats`

Requer **`x-admin-token`**. Apaga todas as estatísticas de visitas (`daily`, `meta`, `visitor_locations`) e guarda o momento do reset em `stats_config`. Limpa também a cache de IPs em memória. Devolve `{ ok: true, resetAt: "…" }`.

---

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `PORT` | Porta HTTP (defeito **3000**) |
| `GEMINI_API_KEY` | Activa `POST /api/spreads` (Gemini + URL context tool) |
| `ADMIN_TOKEN` | Admin: `GET/DELETE /api/stats`, `POST/DELETE /api/banks`, `DELETE /api/comments`, e **todo** o `POST /api/spreads` (disparar extração + aprovar/rejeitar) |
| `SPREADS_AUTO_APPLY` | `=1` publica o resultado da AI sem revisão (por defeito fica pendente) |
| `GEMINI_MODEL` | Modelo Gemini a usar (defeito **`gemini-2.5-pro`**) |
| `DEBUG_SECRET` | Endpoint de diagnóstico dos comentários |

---

## Painel Admin (`/admin.html`)

- Lista de bancos com ícones (favicon por domínio), edição de spreads/comissões, histórico por banco.
- Botão **Actualizar spreads via AI** chama `POST /api/spreads` com o token introduzido na página (único ponto que consome o Gemini + BCE).
- **Revisão pendente**: tabela com **uma linha por banco** e, para cada campo, o valor **antigo → novo** (campos sem alteração aparecem repetidos; alterados destacados). Badge de origem por banco (📄 Preçário / ≈ Estimativa / ✍ Manual / ◆ Canónico) e **aprovação selectiva** por banco antes de publicar.
- Operações sensíveis enviam **`x-admin-token`** no header.
- **Estatísticas** (`GET /api/stats`): visitas cumulativas e por dia (UTC); tabela dos últimos 7 dias; contagem de comentários; caixa **"🌍 Localização dos visitantes"** com cidade, país e número de visitas (mostra as primeiras 5, botão "Ver mais" expande as restantes); card "Contagem desde" mostra data e hora exactas do último reset ou o primeiro dia registado.
- **Reset de estatísticas** (`DELETE /api/stats`): botão "🗑 Reset estatísticas" com confirmação apaga visitas e localizações e regista o timestamp de reinício.
- **Moderação de comentários** (`DELETE /api/comments`): lista e apagar na própria página admin.

---

## Desenvolvimento local

```bash
npm install
npm start
# http://localhost:3000/
```

Requisitos: Node 20+ recomendado. Os ficheiros SQLite são criados automaticamente em `data/` na primeira execução.

---

## Docker

```bash
docker build -t simulador-credito-habitacao .
docker run -d --name simulador-credito-habitacao -p 3000:3000 \
  -v simulador-credito-habitacao-data:/usr/src/app/data \
  -e GEMINI_API_KEY="..." \
  -e ADMIN_TOKEN="..." \
  -e DEBUG_SECRET="..." \
  simulador-credito-habitacao:latest
```

Montar **`/usr/src/app/data`** para persistir comentários, caches e base de bancos.

---

## Jenkins / CI

O `Jenkinsfile`:

1. Valida sintaxe: `node --check server.js`.
2. Constrói a imagem Docker.
3. Arranca o contentor com volume `simulador-credito-habitacao-data` e variáveis injectadas.

Credenciais típicas (IDs referidos no pipeline):

- `gemini-api-key`, `admin-token`, `debug-secret`
- `discord-webhook-url` — notificações de build
- `github-api-token` — enriquecimento de mensagens (se configurado no pipeline)

O ambiente de exemplo publica com **`-p 3999:3000`** (host 3999 → app 3000). Ajustar conforme o teu proxy.

---

## Ficheiros SQLite (`data/`)

| Ficheiro | Conteúdo |
|----------|----------|
| `banks.sqlite` | Tabelas `banks`, `spreads` (histórico por `fetched_at`), `kv_store` (cache Euribor + histórico BCE) |
| `spreads.sqlite` | Cache KV do endpoint Gemini (resultado publicado) |
| `comments.sqlite` | Comentários e respostas |
| `stats.sqlite` | Visitas diárias (`daily`), totais (`meta`), localização por cidade (`visitor_locations`), configuração de resets (`stats_config`) |

---

## Scripts e referência de preçários

`scripts/download-precarios-bancos.sh` descarrega PDFs listados em `reference/precarios-pdf/sources.json` para `reference/precarios-pdf/files/`. Requer **`jq`**. Útil para arquivo / auditoria manual de preçários; não faz parte do arranque da app.

Scripts npm:

- `npm run lint` — validação de sintaxe (`node --check`) de todos os ficheiros servidos e das APIs.
- `npm run audit:urls` — verifica que **todos os URLs de preçário** configurados em `api/spreads.js` são acessíveis pela *URL context tool* do Gemini (retrieval `SUCCESS`). Requer **`GEMINI_API_KEY`** (consome quota).

---

## Auditoria de resultados

Ver **`AUDITORIA.md`**: comparar inputs e outputs com simuladores oficiais dos bancos e registar desvios dentro das tolerâncias definidas.

---

## Licença / aviso legal

Este projecto é disponibilizado como ferramenta de apoio à decisão. Os valores são **estimativas** com base em dados públicos, cache e regras implementadas no código; não constituem aconselhamento financeiro.
