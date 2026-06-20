# Auditoria de resultados — Simulador Crédito Habitação

> Comparar **inputs e outputs** do simulador com simuladores oficiais dos bancos. Os valores são **indicativos**; a FINE e a proposta do banco prevalecem.

Este ficheiro está em **`docs/auditoria.md`**. Serve de **modelo de método** e de **registo datado** de evidências (números de uma sessão concreta devem ser revalidados quando mudam preçários, spreads ou o indexante BCE).

---

## 1. Definição comum (preencher no início de cada sessão)

| Campo | Valor / notas |
|-------|----------------|
| **Data da sessão (UTC)** | `AAAA-MM-DD` |
| **Euribor (indexante usado)** | Copiar dos **badges** na app ou de `GET /api/banks` → `euribor` (ex.: chave `"6m"` em %). O valor em **`sim-shared-constants.js`** (`FALLBACK_EUR`) é só **fallback sem rede** — não substitui o BCE nem o simulador do banco. |
| **Perfil** | Ex.: HPP, 2.ª habitação, arrendamento |
| **Prazo** | Anos |
| **Tipo de taxa** | Variável / Mista / Fixa |
| **Indexante** | 3m / 6m / 12m |
| **Titulares e idades** | Ex.: 1 titular, 30 anos |
| **Produtos** | Com / sem produtos vinculados (alinhado ao “cartão” do banco) |

---

## 2. Tolerâncias aceites (alinhado ao código — `margemVsOficial` em `app.js`)

| Métrica | Tolerância | Interpretação |
|---------|------------|-----------------|
| Prestação mensal | **±5%** | “Aproximado” |
| TAEG | **±0,30 p.p.** | “Aproximado” |
| MTIC | **±5%** | “Aproximado” |

---

## 3. Evidência histórica — CGD (`POST /calculate` em simuladorch.cgd.pt)

**Sessão arquivada:** **2026-05-10 (UTC)**  
**Indexante na evidência:** Euribor **6m = 2,454 %** (valor devolvido na API CGD **nessa data**; com o tempo diverge do BCE / da app).

### Regras fixas desta comparação

- Perfil: **HPP**
- Prazo: **30** anos
- Tipo de taxa: **Variável**
- Indexante: **Euribor 6M**
- Titulares: **1** (idade **30**)

### Medida Jovem — crédito **200 000 €**, imóvel **200 000 €** (financiamento **100 %**, LTV > 90 %)

`IsMedidaJovem=true`, restantes campos alinhados ao wizard.

| Cartão | Spread (oficial) | TAN | Prestação (oficial) | PMT anuidade interna |
|--------|-----------------:|----:|--------------------:|---------------------:|
| Base (sem produtos) | 2,35 % | 4,804 % | 1 049,81 € | 1 049,81 € |
| Reduzida (com produtos) | 1,65 % | 4,104 % | 966,86 € | 966,86 € |

TAEG / MTIC na API (cartão base): **5,4 %** / **397 437,73 €**; cartão reduzido: **4,7 %** / **367 145,20 €**.

### Medida Jovem — crédito **200 000 €**, imóvel **≥ ca. 223 000 €** (LTV **≤ 90 %**)

O simulador CGD passa ao patamar de spread **mais baixo**:

| Cartão | Spread (oficial) | Prestação (oficial) |
|--------|-----------------:|--------------------:|
| Base | 1,35 % | 932,37 € |
| Reduzida | 0,65 % | 854,47 € |

### Nota sobre patamares

A fronteira exacta entre patamares está entre imóvel **222 000 €** e **223 000 €** (crédito 200 000 €) na API verificada em 2026-05-10. No simulador interno usa-se **capital / valor de referência > 90 %** para o patamar “alto” (spreads **2,35 % / 1,65 %**).

### Resultado dessa sessão (CGD)

- CGD Medida Jovem (PMT capital+juros): **coincidência exacta** com a anuidade quando Euribor e patamar de spread coincidem com a API **da mesma sessão**.
- Na app: activar **Crédito jovem** + **HPP**; com financiamento **> 90 %** do valor de referência do imóvel aplicam-se spreads **1,65 % / 2,35 %** (com / sem produtos), sem somar o escalão LTV genérico do preçário — alinhado ao simulador oficial na evidência acima.

---

## 3.1 Esquema da API da CGD (referência — **confirmado 2026-06-20**)

> **Estado:** `simuladorch.cgd.pt` é o **único** simulador oficial conduzível por programação. O esquema abaixo foi **capturado e confirmado** numa sessão real (DevTools → Network, 2026-06-20). Os restantes bancos são SPAs com proteção anti-bot (HTTP 403 a acesso automatizado).

### Endpoint

| Item | Valor |
|------|-------|
| **Host** | `simuladorch.cgd.pt` (**c**rédito **h**abitação) |
| **Método** | `POST` |
| **Caminho** | `/calculate` |
| **Content-Type** | `application/x-www-form-urlencoded; charset=UTF-8` ✅ (não é JSON) |
| **Headers** | exige `X-Requested-With: XMLHttpRequest`, `Origin`/`Referer` de `simuladorch.cgd.pt` e cookie de sessão (`ASP.NET_SessionId`). Bloqueia user-agents automatizados (403) |
| **Resposta** | `application/json` |

### Request (body `x-www-form-urlencoded`) — confirmado

Exemplo real: `…&IsMedidaJovem=true&PropertyValue=200000&Loan=200000&tax=2&Years=30&IndexRate=1&IndexFixedRate=9`

| Campo | Exemplo | Significado | Estado |
|-------|---------|-------------|--------|
| `Loan` | `200000` | montante do empréstimo | ✅ |
| `PropertyValue` | `200000` | valor do imóvel (→ LTV) | ✅ |
| `Years` | `30` | prazo (anos) | ✅ |
| `IsMedidaJovem` | `true` | Medida Jovem (+ `IsMedidaJovemCheckBox=on`) | ✅ |
| `tax` | `2` | tipo de taxa — **`2` = variável** | ✅ |
| `IndexRate` | `1` | indexante Euribor (`1` devolveu `IndexValue=2,536` → Euribor 6m fixado pela CGD) | ✅ |
| `Purpose` / `ProductPurpose` | `1` / `1` | finalidade / sub-finalidade (aquisição) | ◻️ enum por mapear |
| `SimulationSubOriginID` | `1` | canal/origem da simulação | ◻️ |
| `Code` | (vazio) | código promocional | ◻️ |
| `IndexFixedRate` | `9` | parâmetro de taxa fixa/mista (ignorado em variável) | ◻️ |

### Response (JSON) — confirmado

Estrutura: `{ success, data: { BaseResult, DiscountedResult, Fees } }`

- **`BaseResult`** = cartão **Base** (sem produtos vinculados)
- **`DiscountedResult`** = cartão **Reduzida** (com produtos vinculados)
- **`Fees`** = encargos partilhados pelos dois cartões

Campos por cartão (`Base`/`Discounted`):

| Campo JSON | Significado | Exemplo (Base) |
|------------|-------------|----------------|
| `CardInstalment` / `Instalment` | prestação mensal capital+juros (€) | `1 059,75` |
| `CardSpread` / `Spread` | spread (%) | `2,350` |
| `CardIndexRate` / `IndexValue` | Euribor fixado pela CGD (%) | `2,536` |
| `CardAnualNominalRate` / `AnualNominalRate` | TAN (%) | `4,886` |
| `APR` | **TAEG** (%) | `5,5` |
| `TotalPayableAmount` | **MTIC** (€) | `401 154,01` |
| `IndexType` | tipo de taxa | `Variável` |
| `AccountMonthlyFee` | comissão mensal de conta (€) | `6,55` |
| `CardDurationMonths` / `TotalDurationMonths` | prazo em meses | `360` |
| `UtilizationPeriodInstalment` | prestação no período de utilização (só juros) | `814,33` |

`Fees` (€): `LifeInsurance` (16,72), `MultiriskInsurance` (11,28), `AnalysisFee` (226,20 = dossier), `AppraisalFee` (239,20 = avaliação), `FormalizationFee` (202,80 = minutas/formalização).

### Regra de patamares de spread por LTV (Medida Jovem, HPP)

Confirmado pela API (2026-06-20): com `Loan=PropertyValue=200000` (LTV 100 % > 90 %), spread Base **2,350 %** / Reduzida **1,650 %**. Replicado em `app.js` (`b.s==="CGD" && modoJovem && finalidade==="hpp"`):

| LTV (capital / valor de referência) | Spread Base (sem prod.) | Spread Reduzida (com prod.) |
|-------------------------------------|------------------------:|----------------------------:|
| **> 90 %** | 2,35 % | 1,65 % |
| **≤ 90 %** | 1,35 % | 0,65 % |

- Fronteira verificada (2026-05-10): imóvel entre **222 000 €** e **223 000 €** para crédito **200 000 €**.
- Nestes patamares **não se soma** o escalão LTV genérico do preçário (`getLTVAddon` forçado a 0 — `app.js:241`).

### Como capturar uma sessão real (recomendado: `fetch` na Console)

A allowlist de egress do ambiente cloud **não inclui** `simuladorch.cgd.pt`, por isso a captura é manual. O método mais robusto (corre na origem do site, com cookies de sessão, sem escaping):

```js
fetch("https://simuladorch.cgd.pt/calculate",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","X-Requested-With":"XMLHttpRequest"},body:"SimulationSubOriginID=1&Code=&IsMedidaJovemCheckBox=on&IsMedidaJovem=true&Purpose=1&ProductPurpose=1&PropertyValue=200000&Loan=200000&tax=2&Years=30&IndexRate=1&IndexFixedRate=9"}).then(r=>r.text()).then(t=>prompt("Copia:",t));
```

(DevTools → Console → colar → `Enter` → copiar o JSON da caixa.)

---

## 4. Outros bancos (tabela a preencher)

| Banco | URL oficial | Prestação (interno) | Prestação (oficial) | Desvio % | TAEG (interno) | TAEG (oficial) | Dif. p.p. | MTIC (interno) | MTIC (oficial) | Desvio % | Resultado |
|-------|---------------|--------------------:|--------------------:|---------:|---------------:|---------------:|----------:|----------------:|---------------:|---------:|-------------|
| Millennium BCP | https://www.millenniumbcp.pt/credito/credito-habitacao/simulador | 720,80 € | 720,80 € | 0,000 % | 4,6 % | 4,7 % | −0,1 | — | — | — | ✅ dentro de tolerância |
| Santander | https://simulador-credito-habitacao.santander.pt | 847,10 € | 847,10 € | 0,000 % | 3,7 % | 3,9 % | −0,19 | 330 845 € | 335 110 € | −1,27 % | ✅ dentro de tolerância (ver Teste 3) |
| BPI | https://www.bancobpi.pt/particulares/credito-habitacao/simulador | 970,58 € | 970,58 € | 0,000 % | 4,5 % | 4,7 % | −0,2 | 364 719 € | 366 856 € | −0,58 % | ✅ dentro de tolerância (ver Teste 4) |
| Novo Banco | https://www.novobanco.pt/particulares/credito-habitacao | 964,77 € | 964,77 € | 0,000 % | 4,5 % | 4,6 % | −0,1 | 361 861 € | 364 190 € | −0,64 % | ✅ dentro de tolerância (ver Teste 5) |

---

## 4-bis. Sessão de auditoria — 2026-06-20 (UTC)

> **Nota de método:** os simuladores dos bancos bloqueiam acesso automatizado a partir do ambiente cloud (allowlist de egress + anti-bot). Validou-se o motor por duas vias: **(A)** contra a **API real da CGD** (`POST /calculate`, captura manual via `fetch` na Console — ver §3.1); **(B)** contra os **exemplos representativos oficiais (FINE / preçário SECÇÃO 18)** do BCP, que fixam `(capital, TAN, prazo) → prestação` e TAEG.

**Euribor live (17-jun-2026):** 3m **2,417 %** · 6m **2,607 %** · 12m **2,759 %**.

### Teste 0 — API real da CGD (`POST /calculate`, captura 2026-06-20)

Inputs: Medida Jovem, `Loan=200000`, `PropertyValue=200000` (LTV 100 %), 30 anos, variável, `IndexValue=2,536 %` (Euribor 6m fixado pela CGD). Comparação cêntimo a cêntimo com o motor interno alimentado pelos **mesmos** fees/seguros devolvidos pela API:

| Métrica | Cartão | Interno | CGD (API) | Desvio | Veredito |
|---------|--------|--------:|----------:|-------:|----------|
| TAN | Base / Reduzida | 4,886 % / 4,186 % | 4,886 % / 4,186 % | exacto | ✅ |
| **Prestação** | Base | **1 059,75 €** | 1 059,75 € | **0,000 %** | ✅ |
| **Prestação** | Reduzida | **976,40 €** | 976,40 € | **0,000 %** | ✅ |
| TAEG | Base / Reduzida | 5,3 % / 4,6 % | 5,5 % / 4,8 % | −0,2/−0,3 p.p. | ✅ (±0,30) |
| MTIC | Base / Reduzida | 395 816 € / 365 810 € | 401 154 € / 370 714 € | −1,33 % | ✅ (±5 %) |

→ **Prestação coincide ao cêntimo.** TAEG e MTIC dentro de tolerância (consistentemente ~0,2 p.p. / ~1,3 % abaixo — a CGD imputa ligeiramente mais encargos no MTIC do que o nosso stack).

#### Discrepâncias de seed reveladas pela API (`api/banks.js`, código `CGD`)

| Campo seed | Valor seed | Implícito na API | Acção sugerida |
|------------|-----------:|-----------------:|----------------|
| `minutas` (formalização) | 0 € | **202,80 €** (`FormalizationFee`) | **corrigir** → 202,80 |
| seguro vida (`vRef`) | 29,82 → 39,76 €/mês p/ 200 k | **16,72 €** (`LifeInsurance`) | rever `vRef` (~12,5); nota: a simulação CGD **não pediu idade** |
| multirriscos (`mAno`) | 110 → 9,17 €/mês p/ 200 k | **11,28 €** (`MultiriskInsurance`) | rever `mAno` (~135) |

### Teste 1 — Prestação (anuidade) vs FINE oficial (match exacto de TAN)

| Fonte oficial | Capital | TAN | Prazo | Prest. oficial | Prest. interna (`calcP`) | Desvio |
|---------------|--------:|----:|------:|---------------:|-------------------------:|-------:|
| BCP FINE — sem produtos (E12m 2,804 % + spread 1,25 %) | 150 000 € | 4,054 % | 30 a | 720,80 € | **720,80 €** | **0,000 %** |
| BCP FINE — com produtos (E12m 2,804 % + spread 0,70 %) | 150 000 € | 3,504 % | 30 a | 673,90 € | **673,90 €** | **0,000 %** |
| CGD FINE — Regime Geral (E6m 2,454 % + spread 1,35 %) | 150 000 € | 3,804 % | 35 a | 646,64 € | **646,64 €** | **0,000 %** |

→ A anuidade interna coincide **ao cêntimo** com os exemplos oficiais quando a TAN coincide. Motor de prestação validado.

### Teste 2 — TAEG vs FINE oficial (BCP sem produtos, mesmos inputs)

Inputs oficiais: comissões iniciais 748,80 €; seguro de vida 20,88 €/mês.

| Stack de encargos alimentado ao `calcTAEG` | TAEG interna | TAEG oficial | Dif. |
|--------------------------------------------|-------------:|-------------:|-----:|
| Só seguro de vida | 4,3 % | 4,7 % | −0,4 p.p. |
| Vida + multirriscos | 4,5 % | 4,7 % | −0,2 p.p. |
| Vida + multirriscos + conta (stack completo da app) | **4,6 %** | 4,7 % | **−0,1 p.p.** ✅ |

→ O `calcTAEG` está correcto; só converge para o valor oficial quando alimentado com **todo** o encargo mensal (vida + multirriscos + conta), que é o que a app já faz. Dentro de ±0,30 p.p.

### Teste 3 — Santander (simulador client-side, screenshot 2026-06-20)

O simulador do Santander é uma **SPA com cálculo client-side** (`simulador-credito-habitacao.santander.pt`): a pesquisa por valor no DevTools → Network **não devolve nada** (a prestação nunca passa pela rede). Fonte = página de resultados (FINE no ecrã). Inputs: HPP, 200 000 € / imóvel 200 000 €, 30 anos, variável, **com produtos**, Euribor 6m **2,536 %**, promo spread **0,5 % nos 1.ºs 3 anos** depois **0,8 %**.

| Métrica | Interno | Santander | Desvio | Veredito |
|---------|--------:|----------:|-------:|----------|
| TAN promo / pós | 3,036 % / 3,336 % | 3,036 % / 3,336 % | exacto | ✅ |
| **Prestação fase promo** (1.ºs 3 a) | **847,10 €** | 847,10 € | **0,000 %** | ✅ |
| **Capital em dívida após 36 m** | **187 160,80 €** | 187 160,79 € | **1 cêntimo** | ✅ |
| **Prestação após 3 anos** | **877,10 €** | 877,10 € | **0,000 %** | ✅ |
| Multirriscos (`mAno = 246`) | 20,50 € | 20,50 € | exacto | ✅ |
| TAEG (IRR sobre as 2 fases) | 3,7 % | 3,9 % | −0,19 p.p. | ✅ (±0,30) |
| MTIC | 330 845 € | 335 110 € | −1,27 % | ✅ (±5 %) |

→ O motor reproduz **as duas fases da promoção e o capital em dívida entre fases ao cêntimo**. Spreads do seed (`promoSpread = 0,50` / `sCom = 0,80`) **exactos**.

**Nota de produto:** a app mostra a prestação ao **spread normal** (`calcP(200k; 3,336 %; 30) = 879,88 €`), não a prestação **promocional** de 847,10 € — apesar de o seed do Santander já ter `promoPeriodo = 36` e `promoSpread = 0,50`. A fase promocional não está reflectida na prestação principal (candidato a melhoria).

### Teste 4 — BPI (simulador, screenshot 2026-06-20)

Cartão **base** (sem vendas associadas facultativas). Inputs: HPP, 200 000 € / imóvel 200 000 € (LTV 100 %), 30 anos, variável, Euribor 6m **2,536 %**. Campanha BPI com **comissões iniciais isentas** (dossier/avaliação/minutas = 0 €).

| Métrica | Interno | BPI | Desvio | Veredito |
|---------|--------:|----:|-------:|----------|
| Spread base | 1,600 % (seed `sSem 1,50` + LTV 0,10) | 1,600 % | exacto | ✅ |
| TAN | 4,136 % | 4,136 % | exacto | ✅ |
| **Prestação** | **970,58 €** | 970,58 € | **0,000 %** | ✅ |
| Seguro de vida (seed `vRef 13,12`) | 17,49 € | 16,99 € | +0,50 € (1,03×) | ✅ |
| Multirriscos (seed `mAno 195`) | 16,25 € | 16,50 € | −0,25 € | ✅ |
| TAEG | 4,5 % | 4,7 % | −0,2 p.p. | ✅ (±0,30) |
| MTIC base | 364 719 € | 366 856 € | −0,58 % | ✅ (±5 %) |

→ Prestação **ao cêntimo**. **Seguro de vida do BPI bem calibrado** (1,03×) — ao contrário da CGD/Santander.

### Teste 5 — Novo Banco (simulador, screenshot 2026-06-20)

Cenário com **Garantia do Estado DL44/24** (jovem; garantia 15 % / 30 000 €) → spread **1,550 % único** (igual com/sem vendas associadas). Inputs: 200 000 € / imóvel 200 000 €, 30 anos, variável, Euribor 6m **2,536 %**.

| Métrica | Interno | Novo Banco | Desvio | Veredito |
|---------|--------:|-----------:|-------:|----------|
| TAN (E + spread 1,550 %) | 4,086 % | 4,086 % | exacto | ✅ |
| **Prestação** | **964,77 €** | 964,77 € | **0,000 %** | ✅ |
| Seguro de vida (seed `vRef 17,55`) | 23,40 € | 15,35 € | 1,52× | ⚠️ |
| Multirriscos (seed `mAno 98`) | 8,17 € | 12,34 € | 0,66× | ⚠️ |
| TAEG | 4,5 % | 4,6 % | −0,1 p.p. | ✅ (±0,30) |
| MTIC | 361 861 € | 364 190 € | −0,64 % | ✅ (±5 %) |

→ Prestação **ao cêntimo**. Seguros desafinados nos dois sentidos: vida alto, multirriscos baixo.

### Teste 6 — ActivoBank (simulador, screenshot 2026-06-20)

Inputs **diferentes**: financiamento **180 000 €** / imóvel 200 000 € (**LTV 90 %**), 30 anos, variável, **com produtos**, Euribor 6m 2,536 %, spread **0,750 %**, campanha spread 0 % nos 1.ºs 24 meses.

| Métrica | Interno | ActivoBank | Nota |
|---------|--------:|-----------:|------|
| TAN | 3,286 % | 3,286 % | ✅ exacto (spread 0,750 + E 2,536) |
| Prestação 1.º ano / 11.º ano | — | 677,81 € / 826,25 € | ⚠️ **não replicável** (ver abaixo) |
| Seguro de vida (seed `vRef 19,84`→ 23,81 €) | 23,81 € | 17,27 € | 1,38× → `vRef` ~14,39 |
| Multirriscos (seed `mAno 256`→ 21,33 €) | 21,33 € | 20,70 € | 1,03× (ok) |

- **Prestação por curva forward.** As prestações sobem ao longo da vida (677,81 € → 826,25 €) com taxas implícitas de **2,138 %** e **3,678 %** — o ActivoBank **projecta uma curva forward da Euribor**, ao contrário do modelo interno (Euribor spot fixa). Não é comparável ao cêntimo; é metodologia diferente, não erro de motor (já validado em 5 bancos).
- **Fronteira LTV 90 %.** O ActivoBank aplica o spread **base** 0,750 % a LTV 90 % (sem addon). O `getLTVAddon` interno somaria **0,05** a `ltv ≤ 90` (`SEED_LTV_BRACKETS.ACTVO` tem `{max:90,add:0.05}`) → app mostraria 0,800 %. **Candidato a rever a semântica do escalão** (≤ 90 inclusivo vs exclusivo) — afecta vários bancos, não alterado aqui.

### Observações sobre dados de seed (`api/banks.js`)

- **BCP, spread com produtos:** seed `sCom = 0,70 %` = FINE **exacto**. ✅
- **BCP, spread sem produtos:** seed `sSem = 1,50 %` vs FINE **1,25 %** → seed **0,25 p.p. mais conservador**. Candidato a actualização.
- **Indexante dos FINE está desfasado** do BCE: BCP usa E12m 2,804 % (mai-2026), CGD usa E6m 2,454 % (abr-2026); ambos divergem do live (12m 2,759 % / 6m 2,607 %). Comparar sempre com a Euribor da mesma data do exemplo.
- **Seguros — calibração é por banco (`vRef`/`mAno`), NÃO do modelo.** O modelo `sVida`/multirriscos está correcto: onde o seed está certo, acerta (BPI vida 1,03×, Santander multi exacto). Os desvios são valores de seed banco-a-banco. Tabela consolidada (4 bancos, prémio mensal para 200 000 € / imóvel 200 000 €):

  | Banco | Vida seed → calc | Vida oficial | Factor | Multi seed → calc | Multi oficial | Acção |
  |-------|-----------------:|-------------:|-------:|------------------:|--------------:|-------|
  | BPI | `vRef 13,12` → 17,49 € | 16,99 € | 1,03× ✅ | `mAno 195` → 16,25 € | 16,50 € | ok |
  | Santander | `vRef 22,55` → 30,07 € | 14,11 € | 2,1× | `mAno 246` → 20,50 € | 20,50 € ✅ | ↓ `vRef`~10,5 |
  | CGD | `vRef 29,82` → 39,76 € | 16,72 € | 2,4× | `mAno 110` → 9,17 € | 11,28 € | ↓ `vRef`~12,5; ↑ `mAno`~135 |
  | Novo Banco | `vRef 17,55` → 23,40 € | 15,35 € | 1,52× | `mAno 98` → 8,17 € | 12,34 € | ↓ `vRef`~11,5; ↑ `mAno`~148 |
  | ActivoBank | `vRef 19,84` → 23,81 € | 17,27 € | 1,38× | `mAno 256` → 21,33 € | 20,70 € | ↓ `vRef`~14,4 (multi ok) |

  Não mexer no modelo. (Conclusão revista após Teste 4/5 — antes suspeitava-se de factor sistémico.) Notar que os simuladores da CGD/Santander/NB não pediram idade do titular.
- **✅ Correcções aplicadas (2026-06-20):** `api/banks.js` (+ exemplo em `api/spreads.js`) — CGD `vRef 12,54` / `mAno 135,36` / `minutas 202,80`; Santander `vRef 10,58`; Novo Banco `vRef 11,51` / `mAno 148,09`; ActivoBank `vRef 14,39`. Com estes valores o cálculo de seguros reproduz o prémio oficial. BPI ficou inalterado (já estava certo).

---

## 5. Checklist de consistência

- [ ] Mesmos inputs (capital, prazo, taxa, indexante, produtos, idades)
- [ ] Mesmo Euribor / spread **na mesma data** que o simulador oficial
- [ ] Produtos associados alinhados (cartão base vs reduzido)
- [ ] Seguros dentro/fora do banco identificados
- [ ] Evidências guardadas (screenshots ou export)

---

## 6. Quando voltar a actualizar este documento

- Após **alteração relevante** em `api/banks.js` (seeds / reconciliação), `app.js` (regras BdP, IMT, TAEG) ou preçários BdP.
- **Trimestralmente** ou quando o **BCE** ou os **simuladores oficiais** mudarem spreads/TAN de referência.
- **Última revisão estrutural do modelo:** **2026-05-24** (UTC).
- **Última sessão de auditoria:** **2026-06-20** (UTC) — ver §4-bis.

---

## Ver também

- [`docs/adicionar-banco.md`](adicionar-banco.md) — checklist para novos bancos no código e na base.
