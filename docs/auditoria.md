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

## 4. Outros bancos (tabela a preencher)

| Banco | URL oficial | Prestação (interno) | Prestação (oficial) | Desvio % | TAEG (interno) | TAEG (oficial) | Dif. p.p. | MTIC (interno) | MTIC (oficial) | Desvio % | Resultado |
|-------|---------------|--------------------:|--------------------:|---------:|---------------:|---------------:|----------:|----------------:|---------------:|---------:|-------------|
| Millennium BCP | https://www.millenniumbcp.pt/credito/credito-habitacao/simulador | 720,80 € | 720,80 € | 0,000 % | 4,6 % | 4,7 % | −0,1 | — | — | — | ✅ dentro de tolerância |
| Santander | https://www.santander.pt/credito-habitacao/simulador-credito-habitacao | | | | | | | | | | ⚠️ simulador bloqueia acesso automático |
| BPI | https://www.bancobpi.pt/particulares/credito-habitacao/simulador | | | | | | | | | | ⚠️ simulador bloqueia acesso automático |
| Novo Banco | https://www.novobanco.pt/particulares/credito-habitacao | | | | | | | | | | ⚠️ simulador bloqueia acesso automático |

---

## 4-bis. Sessão de auditoria — 2026-06-20 (UTC)

> **Nota de método:** os simuladores interactivos dos bancos (BCP, Santander, BPI, Novo Banco, CGD) bloqueiam acesso automatizado (HTTP 403 / proteção anti-bot) e são SPAs que não se conseguem conduzir por fetch a partir do ambiente. Em alternativa, validou-se o motor interno contra os **exemplos representativos oficiais (FINE / preçário SECÇÃO 18)** publicados pelos bancos — que fixam `(capital, TAN, prazo) → prestação` e TAEG, sendo a referência verificável mais próxima do simulador oficial.

**Euribor live (17-jun-2026):** 3m **2,417 %** · 6m **2,607 %** · 12m **2,759 %**.

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

### Observações sobre dados de seed (`api/banks.js`)

- **BCP, spread com produtos:** seed `sCom = 0,70 %` = FINE **exacto**. ✅
- **BCP, spread sem produtos:** seed `sSem = 1,50 %` vs FINE **1,25 %** → seed **0,25 p.p. mais conservador**. Candidato a actualização.
- **Indexante dos FINE está desfasado** do BCE: BCP usa E12m 2,804 % (mai-2026), CGD usa E6m 2,454 % (abr-2026); ambos divergem do live (12m 2,759 % / 6m 2,607 %). Comparar sempre com a Euribor da mesma data do exemplo.

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
