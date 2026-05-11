# Simulador Crédito Habitação Portugal

Aplicação web para **simular e comparar** crédito habitação em Portugal: prestação, TAEG, MTIC, DSTI, cenários de Euribor, amortizações, custos iniciais e comentários da comunidade. O frontend é uma **SPA React** embutida em `index.html`; o backend é um servidor HTTP minimalista em Node.js com APIs REST e **SQLite** (`better-sqlite3`).

> Simulação meramente **indicativa**. Confirmar sempre as condições na **FINE** e na proposta do banco.

---

## Funcionalidades (utilizador)

- Comparação entre **13 bancos** (dados editáveis na base com valores seed).
- Modos **crédito normal** e **crédito jovem** (regras BdP, LTV, finalidade HPP / 2.ª habitação / arrendamento).
- Taxa **variável, mista ou fixa**; vários indexantes Euribor onde aplicável.
- **Euribor** (3m / 6m / 12m) obtido via **API do BCE** (CSV), com cache no servidor.
- **Spreads e comissões** lidos da API `GET /api/banks` com fallback local em caso de falha de rede.
- Gráficos e tabelas (cenários Euribor, barras de prestação, amortização, seguros, etc.).
- **Partilha por URL**, histórico local (localStorage), secção de **comentários** com respostas.
- **PWA**: `manifest.json`, `icon.svg`, Service Worker (`sw.js`) com cache de assets; pedidos `GET /api/*` **não** são cacheados pelo SW.

---

## Stack técnica

| Componente | Detalhe |
|------------|---------|
| Runtime | Node.js 20 |
| Servidor | `server.js` — `http.createServer`, ficheiros estáticos, **Brotli/Gzip** quando o cliente aceita |
| Base de dados | SQLite em `data/` (vários ficheiros; ver abaixo) |
| Frontend | React compilado num único `index.html` (sem build step no repo) |
| Container | `Dockerfile` — `node:20-slim`, `npm install --production`, `CMD node server.js` |

---

## Estrutura do repositório

```text
├── index.html           # App React (bundle), meta tags e HTML estático inicial
├── admin.html           # Painel admin (gestão de bancos e spreads; token no cabeçalho)
├── server.js            # Encaminhamento estático + APIs
├── sw.js                # Service Worker (cache v5)
├── manifest.json        # PWA
├── icon.svg, og-image.svg
├── api/
│   ├── banks.js         # CRUD bancos/spreads, Euribor, seed SQLite
│   ├── spreads.js       # POST: Anthropic + BCE, cache/rate limit
│   └── comments.js      # Comentários + respostas (SQLite)
├── data/                # Criado em runtime — SQLite (persistente em Docker volume)
├── scripts/
│   └── download-precarios-bancos.sh   # Descarrega PDFs listados em reference/
├── reference/precarios-pdf/           # Metadados JSON + PDFs locais (opcional / manual)
├── Jenkinsfile          # CI/CD Docker + deploy + Discord
├── Dockerfile
├── AUDITORIA.md         # Template para validar resultados vs simuladores oficiais
└── README.md
```

---

## APIs HTTP

Todas as rotas JSON usam UTF-8. CORS permissivo nas APIs (`Access-Control-Allow-Origin: *`).

### `GET /api/banks`

Público. Devolve `{ banks, euribor }`:

- **`banks`**: lista de bancos activos com `spreads` mais recentes por banco.
- **`euribor`**: objecto em cache (servidor refresca a partir do BCE quando expira TTL ~6 h).

Query opcional:

- `GET /api/banks?history=CA` — últimas entradas de spreads do banco (útil para admin).

### `POST /api/banks`

Requer cabeçalho **`x-admin-token`** igual a `ADMIN_TOKEN`.

Corpo JSON típico: `{ bank: { … }, spreads: { … } }` — cria ou actualiza banco e insere linha de spreads (manual).

### `DELETE /api/banks?code=XX`

Requer **`x-admin-token`**. Desactiva o banco (`active = 0`).

---

### `POST /api/spreads`

Actualização massiva via **Anthropic** (modelo configurado em código) + Euribor BCE.

- **Com `x-admin-token` válido**: ignora cache e limites diários (uso administrativo / Jenkins).
- **Sem token**: **rate limit** por IP (~20 pedidos/h) e **limite global** ~2 chamadas “frescas” ao modelo por dia por instância (com cache SQLite ~25 h e cache em memória). Serve dados em cache quando excede limites.

Persistência: grava spreads em `banks.sqlite` via `bulkInsertSpreads`; Euribor também em cache (`banks.js`).

Variável obrigatória no servidor: **`ANTHROPIC_API_KEY`**.

---

### `/api/comments`

| Método | Auth | Descrição |
|--------|------|-----------|
| `GET` | — | Lista até 100 comentários raiz com `replies` encadeadas. |
| `POST` | — | Novo comentário ou resposta (`parentId`). Texto 5–500 caracteres. |
| `DELETE` | `x-admin-token` | Apaga por `?id=` (inclui respostas ao mesmo id). |
| `GET ?debug=1&secret=` | `DEBUG_SECRET` | Diagnóstico SQLite (uso interno). |

---

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `PORT` | Porta HTTP (defeito **3000**) |
| `ANTHROPIC_API_KEY` | Activa `POST /api/spreads` com chamada ao modelo |
| `ADMIN_TOKEN` | Admin: `GET /api/stats`, `POST/DELETE /api/banks`, `DELETE /api/comments`, e bypass de limites em `POST /api/spreads` |
| `DEBUG_SECRET` | Endpoint de diagnóstico dos comentários |

---

## Painel Admin (`/admin.html`)

- Lista de bancos com ícones (favicon por domínio), edição de spreads/comissões, histórico por banco.
- Botão **Actualizar spreads via AI** chama `POST /api/spreads` com o token introduzido na página.
- Operações sensíveis enviam **`x-admin-token`** no header.
- **Estatísticas** (`GET /api/stats`, token no header): visitas cumulativas e por dia (UTC) à página inicial e ao painel; tabela dos últimos 7 dias; contagem de linhas de comentários. Persistido em `data/stats.sqlite`. Após **Carregar** com token.
- **Moderação de comentários** (`DELETE /api/comments`): lista e apagar na própria página admin, abaixo dos bancos, após validar o token com **Carregar** (não há moderação na app principal).

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
  -e ANTHROPIC_API_KEY="..." \
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

- `anthropic-api-key`, `admin-token`, `debug-secret`
- `discord-webhook-url` — notificações de build
- `github-api-token` — enriquecimento de mensagens (se configurado no pipeline)

O ambiente de exemplo publica com **`-p 3999:3000`** (host 3999 → app 3000). Ajustar conforme o teu proxy.

---

## Ficheiros SQLite (`data/`)

| Ficheiro | Conteúdo |
|----------|----------|
| `banks.sqlite` | Tabelas `banks`, `spreads` (histórico por `fetched_at`), `kv_store` (cache Euribor) |
| `spreads.sqlite` | Cache KV / contadores para limites do endpoint Anthropic |
| `comments.sqlite` | Comentários e respostas |

---

## Scripts e referência de preçários

`scripts/download-precarios-bancos.sh` descarrega PDFs listados em `reference/precarios-pdf/sources.json` para `reference/precarios-pdf/files/`. Requer **`jq`**. Útil para arquivo / auditoria manual de preçários; não faz parte do arranque da app.

---

## Auditoria de resultados

Ver **`AUDITORIA.md`**: comparar inputs e outputs com simuladores oficiais dos bancos e registar desvios dentro das tolerâncias definidas.

---

## Licença / aviso legal

Este projecto é disponibilizado como ferramenta de apoio à decisão. Os valores são **estimativas** com base em dados públicos, cache e regras implementadas no código; não constituem aconselhamento financeiro.
