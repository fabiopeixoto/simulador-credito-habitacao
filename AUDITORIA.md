# Versão Auditoria — Simulador Crédito Habitação

> Objetivo: comparar resultados do simulador interno com simuladores oficiais dos bancos.

## Regras de comparação
- Data da auditoria (UTC): **2026-05-10**
- Perfil: **HPP**
- Prazo: **30** anos
- Tipo de taxa: **Variável**
- Indexante: **Euribor 6M** (= **2,454 %** na sessão CGD verificada via API)
- Titulares: **1** (idade **30**)

## Tolerâncias aceites
- Prestação mensal: desvio até **±5%** = "aproximado".
- TAEG: desvio até **±0,30 p.p.** = "aproximado".
- MTIC: desvio até **±5%** = "aproximado".

## Tabela de evidência — CGD (`POST /calculate` simuladorch.cgd.pt)

### Medida Jovem — crédito **200 000 €**, imóvel **200 000 €** (financiamento **100 %**, LTV > 90 %)

`IsMedidaJovem=true`, restantes campos alinhados ao wizard.

| Cartão | Spread (oficial) | TAN | Prestação (oficial) | PMT anuidade interna |
|---|---:|---:|---:|---:|
| Base (sem produtos) | 2,35 % | 4,804 % | 1 049,81 € | 1 049,81 € |
| Reduzida (com produtos) | 1,65 % | 4,104 % | 966,86 € | 966,86 € |

TAEG / MTIC na API (cartão base): **5,4 %** / **397 437,73 €**; cartão reduzido: **4,7 %** / **367 145,20 €**.

### Medida Jovem — crédito **200 000 €**, imóvel **≥ ca. 223 000 €** (LTV **≤ 90 %**)

O simulador CGD passa ao patamar de spread **mais baixo**:

| Cartão | Spread (oficial) | Prestação (oficial) |
|---|---:|---:|
| Base | 1,35 % | 932,37 € |
| Reduzida | 0,65 % | 854,47 € |

### Nota

A fronteira exacta entre patamares está entre imóvel **222 000 €** e **223 000 €** (crédito 200 000 €) na API verificada. No simulador interno usa-se **capital / valor de referência > 90 %** para o patamar “alto” (spreads **2,35 % / 1,65 %**).

### Outros bancos (pendente preenchimento)

| Banco | URL oficial | Prestação (interno) | Prestação (oficial) | Desvio % | TAEG (interno) | TAEG (oficial) | Dif. p.p. | MTIC (interno) | MTIC (oficial) | Desvio % | Resultado |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Millennium BCP | https://www.millenniumbcp.pt/credito/credito-habitacao/simulador |  |  |  |  |  |  |  |  |  |  |
| Santander | https://www.santander.pt/credito-habitacao/simulador-credito-habitacao |  |  |  |  |  |  |  |  |  |  |
| BPI | https://www.bancobpi.pt/particulares/credito-habitacao/simulador |  |  |  |  |  |  |  |  |  |  |
| Novo Banco | https://www.novobanco.pt/particulares/credito-habitacao |  |  |  |  |  |  |  |  |  |  |

## Resultado final
- CGD Medida Jovem (PMT capital+juros): **coincidência exacta** com a anuidade quando Euribor e patamar de spread coincidem com a API.
- Observações:
  - Activar **Crédito jovem** + **HPP** na app; quando o financiamento é superior a **90 %** do valor de referência do imóvel, aplicam-se spreads **1,65 % / 2,35 %** (com / sem produtos), sem somar o escalão LTV genérico do preçário — espelha o simulador oficial.

## Checklist de consistência
- [x] Mesmos inputs (API CGD)
- [x] Mesmo tipo de taxa/indexante
- [x] Produtos associados alinhados (cartão base vs reduzido)
- [ ] Seguros dentro/fora do banco identificados
- [ ] Guardadas evidências (screenshots)
