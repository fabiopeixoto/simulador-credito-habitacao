# Adicionar um Novo Banco ao Simulador

Checklist completo baseado na adição do Banco Best (PR #254–257). Segue a ordem indicada para evitar falhas de FK na base de dados.

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
| `insV` / `insM` | Nome seguradora vida / multirriscos |
| `jovemIsenta` | Banco isenta comissões dossier+avaliação no CH Jovem? |
| `promos` | Array de strings com destaques comerciais |
| `prod` | Produtos vinculados obrigatórios (string) |
| `jProd` | Condições específicas CH Jovem (string; vazio se `jOk: false`) |

---

## 2. `api/banks.js` — Seed data (FAZER PRIMEIRO)

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
        promoPeriodo: 0, promoSpread: null,
        dossier: 300, avaliacao: 250, minutas: 0,
        contaMes: 5.00, contaNota: "Estimativa",
        capMin: 25000, capMax: 2000000,
        vRef: 18.00, mAno: 150,
        insV: "Seguradora Vida", insM: "Seguradora Multi",
        jovemIsenta: false },
```

> **Nota:** A função `reconcileSeedBankMetadataToDb` corre **antes** de `reconcileSeedSpreadsToDb` no arranque. Esta ordem é crítica: o banco tem de existir na tabela `banks` antes de inserir os seus spreads (FK constraint).

---

## 3. `app.js` — 7 estruturas estáticas

Todas devem estar presentes para o banco funcionar no frontend. A ausência de qualquer uma causa falhas silenciosas (banco ignorado nos cálculos).

### 3a. `FALLBACK_BANK_DATA`
Dados de spread usados offline ou na primeira pintura. Espelhar os valores de `SEED_SPREADS`.

```js
XXXX: { sCom:0.80, sSem:1.60, mCom:3.50, mSem:4.30,
        fCom:4.20, fSem:5.00, jsCom:0.70, jsSem:1.50,
        promoPeriodo:0, promoSpread:null,
        dossier:300, avaliacao:250, contaMes:5.00,
        capMin:25000, capMax:2000000,
        vRef:18.00, mAno:150, minutas:0, jovemIsenta:false },
```

### 3b. `SEG`
Referência de seguros para cálculo de prémios na UI.

```js
XXXX: { vRef:18.00, vCap:150000, vAge:30,
        insV:"Seguradora Vida", mAno:150,
        pRef:200000, insM:"Seguradora Multi" },
```

### 3c. `COM`
Comissões iniciais usadas na secção "Custos Iniciais".

```js
XXXX: { dossier:300, avaliacao:250, minutas:0,
        total2hab:550, jovemIsenta:false },
// total2hab = dossier + avaliacao + minutas
```

### 3d. `LTV_BRACKETS`
Spread adicional por escalão de LTV. Padrão de mercado se não houver info específica:

```js
XXXX: [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
```

### 3e. `CAPITAL_LIMITS`

```js
XXXX: { min:25000, max:2000000 },
```

### 3f. `CONTA_MES`

```js
XXXX: { val:5.00, nota:"Fonte ou estimativa (mai.2026)" },
```

### 3g. `BANKS_STATIC`
Metadados para renderização da UI. Adicionar ao array antes do `];`:

```js
{ name:"Nome Banco", s:"XXXX", color:"#rrggbb",
  refs:["6m","12m"], jOk:true, carenciaMax:0,
  tipos:["variável","mista","fixa"],
  promos:["Destaque 1","Destaque 2"],
  prod:"Produtos obrigatórios",
  jProd:"Condições jovem" },
```

### 3h. `BANK_DOMAINS`
Domínio para carregar o favicon via Google S2:

```js
const BANK_DOMAINS = { ..., XXXX: 'banco.pt' };
```

---

## 4. `transferencia-page.js` — Página de transferência

Este ficheiro tem as suas próprias cópias independentes de `LTV_BRACKETS` e `BANK_DOMAINS`. **A ausência do banco aqui faz o logo aparecer errado e os cálculos de LTV incorrectos na página de transferência.**

### 4a. `LTV_BRACKETS`

```js
XXXX: [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
```

### 4b. `BANK_DOMAINS`

```js
BEST:"bancobest.pt"
```

Após editar, bumpar `transferencia-page.js?vXX` em `transferencia.html` e no precache do `sw.js`.

---

## 6. `api/spreads.js` — Prompt da IA

A IA usa este prompt para actualizar spreads automaticamente via painel de administração. **Dois sítios** a editar na constante `PROMPT`:

1. Adicionar `XXXX` à lista de códigos no início do prompt:
   ```
   (CA, CTT, ..., BNI, XXXX)
   ```

2. Adicionar entrada de exemplo no JSON no final do prompt:
   ```json
   "XXXX":{"sCom":0.80,"sSem":1.60,...,"jovemIsenta":false}
   ```

---

## 7. `admin.html` — BANK_DOMAINS

O painel de administração tem a sua própria cópia do `BANK_DOMAINS` para favicons:

```js
const BANK_DOMAINS = { ..., XXXX: 'banco.pt' };
```

---

## 8. Cache busting — OBRIGATÓRIO após qualquer alteração de JS

Sempre que um ficheiro `.js` é alterado, **todos** os seguintes têm de ser actualizados:

| Ficheiro alterado | Bumpar versão em |
|---|---|
| `app.js` | `index.html` (`app.js?v=XX`) + `sw.js` precache |
| `page-header.js` | `index.html`, `transferencia.html`, `historico.html`, `quanto-posso-pedir.html` + `sw.js` precache |
| `reverse-calc-page.js` | `quanto-posso-pedir.html` + `sw.js` precache |
| `transferencia-page.js` | `transferencia.html` + `sw.js` precache |

Além disso, sempre que o `sw.js` é alterado:
- Bumpar o nome do cache: `const CACHE = "simulador-vXX"`

E quando a resposta da API `/api/banks` muda estruturalmente:
- Bumpar `CACHE_KEY` em `app.js`: `"credito_cache_vXX"`

---

## 9. Contadores de texto — "N bancos"

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

## Checklist resumida

```
[ ] 1.  Recolher todos os dados do banco (spreads, comissões, seguros)
[ ] 2.  api/banks.js → SEED_BANKS
[ ] 3.  api/banks.js → SEED_SPREADS
[ ] 4.  app.js → FALLBACK_BANK_DATA
[ ] 5.  app.js → SEG
[ ] 6.  app.js → COM
[ ] 7.  app.js → LTV_BRACKETS
[ ] 8.  app.js → CAPITAL_LIMITS
[ ] 9.  app.js → CONTA_MES
[ ] 10. app.js → BANKS_STATIC
[ ] 11. app.js → BANK_DOMAINS
[ ] 12. transferencia-page.js → LTV_BRACKETS
[ ] 13. transferencia-page.js → BANK_DOMAINS
[ ] 14. api/spreads.js → PROMPT (lista de códigos + exemplo JSON)
[ ] 15. admin.html → BANK_DOMAINS
[ ] 16. Cache bust: app.js?vXX em index.html + sw.js precache
[ ] 17. Cache bust: transferencia-page.js?vXX em transferencia.html + sw.js precache
[ ] 18. Cache bust: sw.js → simulador-vXX
[ ] 19. Actualizar contadores "N bancos" em todos os ficheiros
[ ] 20. Verificar: grep -rn "[0-9]\+ bancos" . --include="*.js" --include="*.html"
```
