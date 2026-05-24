# Adicionar um Novo Banco ao Simulador

Checklist actualizado para o estado actual do código (pós PRs #278–282).

> **Nota de arquitectura:** Os dados de cálculo (spreads, comissões, seguros, LTV) vivem na DB SQLite como única fonte de verdade. Os metadados de UI (nome, cor, refs, tipos) ainda estão duplicados em `BANKS_STATIC` no `app.js` por razões de renderização do frontend — ambos têm de ser actualizados.

---

## 1. Recolher os dados do banco

Antes de tocar no código, reúne:

| Campo | Descrição |
|---|---|
| `code` | Código único 2–10 chars maiúsculas/números (ex: `BEST`) |
| `name` | Nome completo (ex: `"Banco Best"`) |
| `color` | Cor da marca em hex (ex: `"#e85520"`) |
| `domain` | Domínio para favicon (ex: `"bancobest.pt"`) |
| `refs` | Indexantes Euribor suportados: `["3m","6m","12m"]` |
| `tipos` | Tipos de taxa: `["variável","mista","fixa"]` |
| `jOk` | Suporta CH Jovem? `true`/`false` |
| `carenciaMax` | Período de carência máximo em meses |
| `sCom` / `sSem` | Spread variável com/sem produtos vinculados (%) |
| `mCom` / `mSem` | TAN misto com/sem produtos (%) |
| `fCom` / `fSem` | TAN fixo com/sem produtos (%) |
| `jsCom` / `jsSem` | Spread CH Jovem com/sem produtos (%) |
| `jmCom` / `jmSem` | TAN Jovem Mista com/sem (% ou `null` → usa `mCom`/`mSem`) |
| `jfCom` / `jfSem` | TAN Jovem Fixa com/sem (% ou `null` → usa `fCom`/`fSem`) |
| `jovemSameSpread` | CH Jovem usa o mesmo spread que o normal? (`false` tipicamente) |
| `jovemIsentaAval` | CH Jovem isenta comissão de avaliação? |
| `promoPeriodo` | Meses do período promocional (0 se não existir) |
| `promoSpread` | Spread durante promoção (%) ou `null` |
| `dossier` | Comissão de abertura/dossier (€) |
| `avaliacao` | Comissão de avaliação do imóvel (€) |
| `minutas` | Preparação de minutas (€, 0 se não existe) |
| `contaMes` | Manutenção de conta mensal (€, 0 se não obrigatória) |
| `contaNota` | Fonte/nota da comissão de conta (string curta) |
| `capMin` / `capMax` | Capital mínimo e máximo (€) |
| `vRef` | Prémio mensal seguro vida: titular 30 anos, 150k€ capital (€/mês) |
| `mAno` | Prémio anual seguro multirriscos: imóvel 200k€ (€/ano) |
| `vCap` | Capital de referência para `vRef` (€, tipicamente `150000`) |
| `vAge` | Idade de referência para `vRef` (anos, tipicamente `30`) |
| `pRef` | Valor de imóvel de referência para `mAno` (€, tipicamente `200000`) |
| `insV` / `insM` | Nome seguradora vida / multirriscos |
| `jovemIsenta` | Banco isenta comissões dossier+avaliação no CH Jovem? |
| `promos` | Array de strings com destaques comerciais |
| `prod` | Produtos vinculados obrigatórios (string) |
| `jProd` | Condições específicas CH Jovem (string; vazio se `jOk: false`) |

---

## 2. `api/banks.js` — Seed data (FAZER PRIMEIRO)

A ordem dentro deste ficheiro é crítica: `reconcileSeedBankMetadataToDb` corre antes de `reconcileSeedSpreadsToDb` no arranque. O banco tem de existir na tabela `banks` antes de inserir os seus spreads (FK constraint).

### 2a. Adicionar a `SEED_BANKS`

```js
// No array SEED_BANKS, adicionar ANTES do `];`
{ code: "XXXX", name: "Nome Banco", color: "#rrggbb",
  refs: ["6m","12m"], jOk: true, carenciaMax: 0,
  tipos: ["variável","mista","fixa"],
  promos: ["Destaque 1", "Destaque 2"],
  prod: "Produtos obrigatórios",
  jProd: "Condições jovem" },
```

### 2b. Adicionar a `SEED_SPREADS`

```js
// No objecto SEED_SPREADS, adicionar ANTES do `};`
XXXX: { sCom: 0.80, sSem: 1.60, mCom: 3.50, mSem: 4.30,
        fCom: 4.20, fSem: 5.00, jsCom: 0.70, jsSem: 1.50,
        jmCom: null, jmSem: null, jfCom: null, jfSem: null,
        jovemSameSpread: false, jovemIsentaAval: false,
        promoPeriodo: 0, promoSpread: null,
        dossier: 300, avaliacao: 250, minutas: 0,
        contaMes: 5.00, contaNota: "Estimativa mai.AAAA",
        capMin: 25000, capMax: 2000000,
        vRef: 18.00, mAno: 150, vCap: 150000, vAge: 30, pRef: 200000,
        insV: "Seguradora Vida", insM: "Seguradora Multi",
        jovemIsenta: false },
```

> `jmCom`/`jmSem`/`jfCom`/`jfSem`: `null` significa que o frontend calcula automaticamente um desconto de ~0,12pp sobre `mCom`/`fCom` para o modo Jovem. Preenche se o banco publicar valores distintos na FINE.

### 2c. Adicionar a `SEED_LTV_BRACKETS`

```js
// No objecto SEED_LTV_BRACKETS, adicionar ANTES do `};`
XXXX: [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
```

> Estes valores são inseridos na DB apenas se `ltvBrackets IS NULL` para o banco (não sobrescreve edições do admin). O padrão de mercado se não houver info específica é `[{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}]`.

---

## 3. `inversa-bootstrap.js` — Constantes partilhadas

Este ficheiro define `window._SIM.LTV_BRACKETS` e `window._SIM.BANK_DOMAINS`, partilhados por **todas as páginas** (app.js, transferencia, quanto-posso-pedir, historico).

### 4a. `LTV_BRACKETS`

```js
// No objecto LTV_BRACKETS, adicionar ANTES do `};`
XXXX: [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
```

> Deve espelhar `SEED_LTV_BRACKETS` em `api/banks.js`. Este valor é o fallback offline/antes do carregamento da API; a API actualiza o objecto em-lugar com os valores da DB.

### 4b. `BANK_DOMAINS`

```js
// No objecto BANK_DOMAINS, adicionar:
XXXX: "banco.pt",
```

> Cobre todas as páginas de utilizador. O `admin.html` tem a sua própria cópia separada (ver secção 6).

---

## 4. `api/spreads.js` — Prompt da IA

A IA usa este prompt para actualizar spreads automaticamente via painel de administração. **Dois sítios** a editar na constante `PROMPT`:

1. Adicionar `XXXX` à lista de códigos no início do prompt:
   ```
   (CA, CTT, ..., BNI, BEST, XXXX)
   ```

2. Adicionar entrada de exemplo no JSON no final do prompt:
   ```json
   "XXXX":{"sCom":0.80,"sSem":1.60,"mCom":3.50,"mSem":4.30,"fCom":4.20,"fSem":5.00,
           "jsCom":0.70,"jsSem":1.50,"promoPeriodo":0,"promoSpread":null,
           "dossier":300,"avaliacao":250,"contaMes":5.00,"capMin":25000,"capMax":2000000,
           "vRef":18.00,"mAno":150,"insV":"Seg. Vida","insM":"Seg. Multi",
           "contaNota":"Estimativa","minutas":0,"jovemIsenta":false}
   ```

---

## 5. `admin.html` — BANK_DOMAINS

O painel de administração tem a sua própria cópia do `BANK_DOMAINS` para favicons:

```js
const BANK_DOMAINS = { ..., XXXX: 'banco.pt' };
```

---

## 6. Cache busting — OBRIGATÓRIO após qualquer alteração de JS

Sempre que um ficheiro `.js` é alterado, **todos** os seguintes têm de ser actualizados:

| Ficheiro alterado | Bumpar versão em |
|---|---|
| `app.js` | `index.html` (`app.js?v=XX`) + `sw.js` precache |
| `inversa-bootstrap.js` | `index.html`, `transferencia.html`, `historico.html`, `quanto-posso-pedir.html` + `sw.js` precache |
| `page-header.js` | `index.html`, `transferencia.html`, `historico.html`, `quanto-posso-pedir.html` + `sw.js` precache |
| `reverse-calc-page.js` | `quanto-posso-pedir.html` + `sw.js` precache |
| `transferencia-page.js` | `transferencia.html` + `sw.js` precache |

Além disso, sempre que o `sw.js` é alterado:
- Bumpar o nome do cache: `const CACHE = "simulador-vXX"`

E quando a resposta da API `/api/banks` muda estruturalmente (novos campos):
- Bumpar `CACHE_KEY` em `app.js`: `"credito_cache_vXX"`

---

## 7. Contadores de texto — "N bancos"

Pesquisar o número concreto (ex: `"14 bancos"`) em todo o repositório e actualizar:

```bash
grep -rn "[0-9]\+ bancos" . --include="*.js" --include="*.html"
```

Ficheiros típicos a actualizar:
- `app.js` (2 ocorrências: subtítulo do header e rodapé)
- `index.html` (meta description, og:description, twitter:description, ld+json, texto SSR)
- `page-header.js` (subtítulo do header partilhado)
- `reverse-calc-page.js` (texto dica na calculadora inversa)
- `transferencia.html` (meta description)

---

## 8. Verificar flag `preferSource` no admin

Após o primeiro deploy, o novo banco terá `preferSource = 'api'` por defeito — os spreads da API/FINE têm prioridade sobre entradas manuais. Não é necessária nenhuma acção, mas se quiseres forçar valores manuais, usa o botão **"Mudar p/ Manual"** no card do banco na página admin.

---

## Checklist resumida

```
[ ] 1.  Recolher todos os dados do banco (spreads, comissões, seguros, LTV)
[ ] 2.  api/banks.js → SEED_BANKS
[ ] 3.  api/banks.js → SEED_SPREADS  (incluir jmCom/jmSem/jfCom/jfSem, jovemSameSpread, jovemIsentaAval, vCap/vAge/pRef)
[ ] 4.  api/banks.js → SEED_LTV_BRACKETS
[ ] 5.  inversa-bootstrap.js → LTV_BRACKETS
[ ] 6.  inversa-bootstrap.js → BANK_DOMAINS
[ ] 7.  api/spreads.js → PROMPT (lista de códigos + exemplo JSON)
[ ] 8.  admin.html → BANK_DOMAINS
[ ] 9.  Cache bust: inversa-bootstrap.js?vXX em index.html, transferencia.html, historico.html, quanto-posso-pedir.html + sw.js
[ ] 10. Cache bust: sw.js → simulador-vXX
[ ] 11. Actualizar contadores "N bancos" em todos os ficheiros
[ ] 12. Verificar: grep -rn "[0-9]\+ bancos" . --include="*.js" --include="*.html"
[ ] 13. (Opcional) Admin → confirmar preferSource='api' no novo banco
```

---

## O que já NÃO é necessário (removido nos PRs #278–282 e #288)

Os seguintes objectos foram eliminados de `app.js` — **não adicionar**:

- ~~`FALLBACK_BANK_DATA`~~ — removido (PR #278); spreads vêm exclusivamente da DB
- ~~`SEG`~~ — removido (PR #278); dados de seguro vêm da DB via `bankData[code]`
- ~~`COM`~~ — removido (PR #278); comissões vêm da DB via `bankData[code]`
- ~~`CAPITAL_LIMITS`~~ — removido (PR #278); limites vêm da DB via `bankData[code]`
- ~~`CONTA_MES`~~ — removido (PR #278); comissão de conta vem da DB
- ~~`LTV_BRACKETS` em `app.js`~~ — migrado para DB (PR #280); seed em `SEED_LTV_BRACKETS`, fallback em `inversa-bootstrap.js`
- ~~`BANK_DOMAINS` em `app.js`~~ — centralizado em `inversa-bootstrap.js`
- ~~`BANKS_STATIC` em `app.js`~~ — removido (PR #288); metadados dos bancos (name, color, refs, jOk, tipos, promos, prod, jProd) vêm da DB via `/api/banks` e são incorporados em `bankData` durante `loadRates`
- ~~`LTV_BRACKETS` em `transferencia-page.js`~~ — usa `window._SIM.LTV_BRACKETS`
- ~~`BANK_DOMAINS` em `transferencia-page.js`~~ — usa `window._SIM.BANK_DOMAINS`
