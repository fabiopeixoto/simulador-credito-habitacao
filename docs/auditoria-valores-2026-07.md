# Auditoria aos valores do site — julho 2026

Data da auditoria: 2026-07-18. Âmbito: todos os valores financeiros hardcoded no site (taxas, impostos, regras regulatórias, comissões, defaults), verificados (a) contra fontes oficiais/atuais de 2026 e (b) quanto à consistência interna entre páginas.

> **Estado (2026-07-18):** correções aplicadas nos commits seguintes deste PR — itens 1.1–1.5, 2.1–2.2 e 3.1–3.7. Ficam por executar: 2.3 (revalidação manual dos 13 preçários, por decisão do utilizador) e 3.8 (consolidação de constantes num módulo partilhado, recomendação futura).

Legenda de severidade:
- 🔴 **Errado** — o valor produz resultados incorretos para o utilizador hoje.
- 🟠 **Desatualizado / fica obsoleto em breve** — corrigir na próxima iteração.
- 🟡 **Inconsistente / frágil** — valores certos mas divergentes entre páginas ou duplicados.
- 🟢 **Verificado e correto**.

---

## 1. 🔴 Errado

### 1.1 IS de 0,6% sobre o crédito tratado como isento para HPP (calculadora de custos)
- **Onde:** `public/js/pages/custos-compra-page.js:95` — `isCredito=(financiamento&&finalidade!=='hpp')?…:0` com o comentário "Art.7.º CIS: isento HPP"; a linha 124 mostra a rubrica como "isento" para HPP.
- **Regra real:** o IS da verba 17.1 (0,6% sobre o capital utilizado, prazo ≥5 anos) **paga-se sempre**, incluindo em habitação própria permanente. O que está isento para HPP são os **juros** (art. 7.º, n.º 1 CIS). A isenção jovem (art. 7.º-A CIS, DL 48-A/2024) cobre a verba 1.1 (escritura), **não** o IS do crédito.
- **Impacto:** a página de custos subestima os custos de compra em 0,6% do empréstimo (ex.: empréstimo de €200.000 → faltam €1.200).
- **Nota de consistência:** o simulador principal faz certo (`app.js:346` cobra `capital*0.006` sempre) e a tab Custos também (`view-custos.js:17` + nota correta na linha 45: "Não isento (só IS escritura é isento ≤35a)"). Só a página `custos-compra` está errada.
- **Correção proposta:** em `custos-compra-page.js`, cobrar `emprestimo*0.006` sempre que há financiamento, sem exceção para HPP nem para jovem.

### 1.2 Falta o escalão de topo do IMT (>€1.150.853 → 7,5%)
- **Onde:** `public/js/core/calc.js:101,113-114` — acima de €660.982 (Tabela I) / €633.931 (Tabela II) aplica 6% flat sem limite.
- **Regra real (tabelas 2026):** 6% flat aplica-se só até **€1.150.853**; acima disso a taxa é **7,5%** (ambas as tabelas).
- **Impacto:** imóveis de luxo ficam subtaxados (ex.: HPP de €1,5M → site calcula €90.000; correto €112.500).
- **Correção proposta:** acrescentar `if(v<=1150853) return v*0.06; return v*0.075;` em ambas as tabelas (e refletir nos labels de `custos-compra-page.js:33-48`).

### 1.3 Isenção jovem do IS escritura aplicada sem limite de valor
- **Onde:** `custos-compra-page.js:94` e `view-custos.js:16` — `isEscritura = jovem ? 0 : valor*0.008`, sem teto.
- **Regra real:** a isenção jovem (IMT + IS verba 1.1) é **total até €330.539**, **parcial entre €330.539 e €660.982** (paga-se sobre o excedente) e **inexistente acima de €660.982**.
- **Impacto:** para um jovem a comprar casa de €700.000, o site mostra IS escritura €0 quando devia mostrar €5.600.
- **Correção proposta:** espelhar a mesma lógica de escalões já usada no `calcIMT` jovem (isenção até 330.539 / excedente até 660.982 / regime normal acima).

### 1.4 IMT Jovem com teto de 2025 na página do IMI
- **Onde:** `public/js/pages/imi-page.js:621` — "VPT ≤ €316.772".
- **Regra real 2026:** o limiar de isenção total do IMT Jovem é **€330.539** (o próprio `calc.js` e a página custos-compra já usam este valor). €316.772 nem sequer é o valor de 2025 correto para o IMT Jovem (2025: €324.058) — parece ser o antigo limiar da Tabela I.
- **Correção proposta:** atualizar para €330.539.

### 1.5 IAS desatualizado (2025 em vez de 2026)
- **Onde:** `imi-page.js:324-326` — `IAS_2025 = 522.50` e limiares derivados (isenção permanente IMI: VPT ≤ €73.150; rendimento ≤ 522.50×14×2.3).
- **Valor real 2026:** IAS = **€537,13** (Portaria; +2,8%). Limiares derivados corretos: VPT ≤ 537,13×14×10 = **€75.198,20**; rendimento ≤ 537,13×14×2,3 = **€17.295,59**.
- **Impacto:** a página nega/afirma incorretamente elegibilidade para isenção permanente de IMI em casos na margem.
- **Correção proposta:** renomear a constante para `IAS_2026 = 537.13` e recalcular.

---

## 2. 🟠 Desatualizado / fica obsoleto a 1 de agosto de 2026

### 2.1 Regras BdP: nova Recomendação Macroprudencial n.º 1/2026 (em vigor a 01/08/2026)
O BdP reviu a recomendação em julho de 2026; aplica-se a avaliações de solvabilidade a partir de 1 de agosto de 2026:

| Regra | Site (hoje) | Até 31/07/2026 | A partir de 01/08/2026 |
|---|---|---|---|
| Prazo máximo por idade | 40a (≤30) / 37a (30–35) / 35a (>35) | igual ao site ✅ | **40a (≤35) / 35a (>35)** — desaparece o escalão de 37 anos |
| DSTI regulamentar | não modelado (usa 33/35% "prudentes") | 50% | **45%** |
| Choque de taxa (stress) | +1,5 p.p. | +1,5 p.p. ✅ | +1,5 p.p. ✅ (mantido) |
| LTV máximo | 90% HPP / 80% restantes | igual ✅ | igual ✅ (mantido) |

- **Onde corrigir o prazo:** `app.js:217`, `prontidao-page.js:136-138`, `view-viabilidade.js:15`, `reverse-calc-page.js:157` (texto "BdP: máx. 40a (idade ≤ 30 anos)" → passa a ≤35).
- **Citação legal:** vários sítios citam "BdP Aviso 4/2022" para o prazo (`reverse-calc-page.js:232`) — a fonte correta passa a ser a Recomendação Macroprudencial n.º 1/2026.

### 2.2 Euribor de fallback uma edição atrasada (e 12m suspeito)
- **Onde:** `sim-shared-constants.js:8-12` e duplicado em `inversa-bootstrap.js:20-24` — `3m: 2.209 / 6m: 2.541 / 12m: 2.86`, rotulado "maio 2026".
- **Valores reais:** médias mensais de **junho 2026**: **3m 2,339 / 6m 2,596 / 12m 2,798**. (Diárias a 17/07: 2,485 / 2,688 / 2,876.) Nota: o 12m "2.86 (maio)" não bate com a média de maio (~2,80) — parece ter sido um valor diário, não a média mensal que o `api/euribor.js` serve (série mensal HSTA do BCE).
- **Impacto:** só quando o fetch ao BCE falha — mas neste sandbox o BCE veio bloqueado (`euribor: null` no `/api/banks`), o que mostra que o fallback é realmente usado em condições adversas.
- **Correção proposta:** atualizar para as médias de junho (e criar rotina/nota de manutenção mensal); remover o terceiro fallback `2.5` em `stress-euribor-page.js:67` a favor do partilhado.

### 2.3 Preçários bancários datados de fev–mai 2026
- **Onde:** `api/banks.js:180-193` (`contaNota` "FINE mai.2026", "PRE-FC fev.2026") e URLs de preçários com datas nos nomes (`api/spreads.js:92-120`).
- **Estado:** a CGD servida pela API (sCom 0,65 / sSem 1,35 / dossier 226,20 / avaliação 239,20) bate certo com a seed; não foi possível verificar os PDF dos bancos a partir deste ambiente (bloqueio de proxy). **Recomendação:** correr o health-check `auditUrls` existente e revalidar os 13 preçários manualmente (têm 2–5 meses).

---

## 3. 🟡 Inconsistente entre páginas / frágil

### 3.1 Divergência de dados real: brackets LTV do Montepio
- `api/banks.js:156` (canónico, confirmado ao vivo via `/api/banks`): addons **0 / 0** aos LTV 90/100.
- `inversa-bootstrap.js:43` (fallback do cliente): addons **0,05 / 0,10**. → Atualizar o fallback para igualar a BD.

### 3.2 Stress test divergente: +1,5 p.p. vs +2 p.p.
- Simulador principal, viabilidade e página de stress usam **+1,5 p.p.** (correto, BdP); a calculadora inversa usa **+2 p.p.** (`reverse-calc-page.js:37`). → Uniformizar em 1,5 p.p. ou rotular o +2 explicitamente como cenário conservador próprio.

### 3.3 DSTI divergente: 35% vs 33%
- Prontidão/stress/viabilidade usam **35%**; a inversa usa **33%** por defeito (`reverse-calc-page.js:16`) com a etiqueta "BdP recomenda". Nenhum dos dois é o limite do BdP (50% → 45% em agosto). → Escolher um valor "prudente" único (ex.: 35%) e corrigir as etiquetas para não atribuir 33/35% ao BdP.

### 3.4 Meta tag da página IMI diz "2025"
- `public/imi.html:7` "actualizadas 2025" vs conteúdo da página "2026". → Atualizar meta.

### 3.5 Rodapé "Cache 8h" vs TTL real de 25h
- `app.js:490` e `reverse-calc-page.js:232` dizem "Cache 8h"; `api/spreads.js:34` define `KV_CACHE_TTL = 25h`. → Corrigir o texto (ou o TTL).

### 3.6 Rodapé "IS HPP: €0 (art. 7º CIS)" é ambíguo
- `reverse-calc-page.js:232` e `app.js:490`. O que é €0 para HPP é o IS sobre **juros**; o IS de 0,6% sobre o capital paga-se (e o próprio app cobra-o na TAEG). → Reformular para "IS s/ juros HPP: €0".

### 3.7 Isenções de comissões bancárias jovem assumidas a 100% na página de custos
- `custos-compra-page.js:99-100` isenta dossier+avaliação para todos os jovens; os dados por banco (`jovemIsenta`/`jovemIsentaAval`, muitos `false` — ex.: CGD) mostram que não é geral. → Usar os flags por banco ou rotular como "melhor cenário".

### 3.8 Duplicações a consolidar (risco de divergência futura)
Um módulo partilhado de constantes fiscais/regulatórias eliminaria estas cópias:
- Tabelas IMT: `calc.js:92-115` (motor) + `custos-compra-page.js:33-48` (labels) + notas em `view-custos.js:43`.
- IS 0,8% / 0,6% como literais em ~7 ficheiros.
- Euribor fallback + `CONTRATO_FACTOR`: `sim-shared-constants.js` + `inversa-bootstrap.js` (+ `2.5` em stress-euribor).
- Dossier 300 / avaliação 230 por defeito: `custos-compra-page.js:97-98`, `app.js:343`, `view-custos.js:23`.
- Fórmula registo hipoteca `capital*0.0008+150`: `app.js:347` + `view-custos.js:19`.
- Regra de prazos BdP: `app.js:217`, `prontidao-page.js:136-138`, `view-viabilidade.js:15`.
- Texto livre de `SEED_BANKS.promos/jProd` repete números de `SEED_SPREADS` (`api/banks.js:164-177`).

---

## 4. 🟢 Verificado e correto

- **Escalões IMT 2026** (Tabela I e II): limiares 106.346 / 145.470 / 198.347 / 330.539 / 660.982 (I) e 633.931 (II) e parcelas a abater — todos batem certo com o OE 2026 (a continuidade matemática entre escalões também confere). Falta só o topo de 7,5% (item 1.2).
- **IMT Jovem no motor** (`calc.js:105-107`): isenção até 330.539, 8% sobre o excedente até 660.982 — correto para 2026.
- **Imposto do Selo**: 0,8% escritura (verba 1.1) e 0,6% crédito ≥5 anos (verba 17.1) — corretos onde aplicados (exceção: item 1.1/1.3).
- **Comissão de amortização antecipada**: 0,5% variável / 2% fixa — **correto em 2026**: a isenção da comissão em taxa variável terminou a 31/12/2025 e não foi renovada (proposta chumbada no OE 2026).
- **Garantia pública / Crédito Jovem (DL 44/2024)**: imóvel ≤ €450.000, idade ≤35, financiamento até 100%, garantia do Estado até 15%, vigente até 31/12/2026 — tudo conforme o site.
- **IMI 2026 (spot-check)**: mínimo 0,30% / máximo 0,45% ✓; os 4 municípios à taxa máxima (Oeiras, Cartaxo, Nazaré, VRSA) ✓; Loures 0,361% ✓; Braga 0,32% ✓; Cascais 0,35% ✓; Porto mantido ✓; rústicos 0,80% ✓. Os restantes ~300 municípios não foram verificados um a um.
- **Stress +1,5 p.p. e LTV 90/80**: conforme BdP (mantidos na Recomendação 1/2026).
- **Isenção de emolumentos de registo para jovens HPP** (`app.js:347`, `view-custos.js:51`): existe e o site aplica-a.
- **/api/banks ao vivo**: spreads CGD servidos = seed (sCom 0,65 / sSem 1,35 / dossier 226,20 / avaliação 239,20 / contaMes 6,55).

---

## 5. Próximos passos propostos (após aprovação)

1. **Prioridade alta (corrige resultados errados):** itens 1.1–1.5.
2. **Antes de 1 de agosto:** item 2.1 (novas regras BdP) + 2.2 (Euribor fallback junho).
3. **Higiene:** itens 3.1–3.7 e consolidação de constantes (3.8).
4. **Manutenção contínua:** revalidação mensal dos preçários (2.3) e da Euribor de fallback.

## Fontes consultadas (2026-07-18)

- Euribor diária/mensal: euribor-rates.eu, comparaja.pt, notícias de 16/07/2026 (médias de junho: 2,339/2,596/2,798).
- IMT 2026: Doutor Finanças, ECO (09/10/2025), Portal das Finanças (tabelas práticas), imtcalc.pt, APCMC.
- IAS 2026 = €537,13: APCMC, CMS Law, JN.
- BdP Recomendação Macroprudencial n.º 1/2026: comunicado BdP, ECO (02/07/2026), Jornal Económico.
- Amortização antecipada 2026: Doutor Finanças, DECO Proteste, idealista/news, Público (chumbo da proposta no OE 2026).
- Garantia pública jovem: CGD, ABANCA, Santander, comparaja.pt, credilink.pt.
- IS jovem / verba 17.1: Portal das Finanças (IMT Jovem), Santander, Bankinter, decisões CAAD.
- IMI 2026: Doutor Finanças, idealista/news, Santander, Executive Digest.
