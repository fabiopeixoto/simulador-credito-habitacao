# Versão Auditoria — Simulador Crédito Habitação

> Objetivo: comparar resultados do simulador interno com simuladores oficiais dos bancos.

## Regras de comparação
- Data da auditoria (UTC): **2026-05-10**
- Perfil: **HPP**
- Montante imóvel: **250 000 €** (para LTV 80% com crédito 200 000 €)
- Entrada: **50 000 €**
- Montante crédito: **200 000 €**
- Prazo: **30** anos
- Tipo de taxa: **Variável**
- Indexante: **Euribor 6M** (= **2,454 %** na sessão CGD verificada)
- Titulares: **1** (idade **30**)
- Produtos associados: **Com / Sem** (dois cartões no simulador CGD)

## Tolerâncias aceites
- Prestação mensal: desvio até **±5%** = "aproximado".
- TAEG: desvio até **±0,30 p.p.** = "aproximado".
- MTIC: desvio até **±5%** = "aproximado".

## Tabela de evidência

### CGD — verificação API `POST /calculate` (2026-05-10)

Condição comercial **actual** na API (spread base **1,35 %** / condicionado **0,65 %** sobre Euribor 6 m):

| Cartão simulador CGD | Prestação indicada (oficial) | Fórmula anuidade interna (PMT) | TAEG (oficial) | MTIC (oficial) |
|---|---:|---:|---:|---:|
| Prestação base (sem produtos vinculados) | 932,37 € | 932,37 € (TAN 3,804 %) | 4,4 % | 355 570,74 € |
| Prestação reduzida (com produtos) | 854,47 € | 854,47 € (TAN 3,104 %) | 3,7 % | 327 093,22 € |

**Nota sobre capturas de ecrã antigas:** valores como prestação **1 049,81 €** / **966,86 €** com spreads **2,35 %** / **1,65 %** são **internamente consistentes** com o mesmo Euribor (2,454 %) mas correspondem a **outra condição comercial** (preçário ou perfil diferente). Com os spreads **actuais** da API, as prestações são as da tabela acima.

### Outros bancos (pendente preenchimento)

| Banco | URL oficial | Prestação (interno) | Prestação (oficial) | Desvio % | TAEG (interno) | TAEG (oficial) | Dif. p.p. | MTIC (interno) | MTIC (oficial) | Desvio % | Resultado |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Millennium BCP | https://www.millenniumbcp.pt/credito/credito-habitacao/simulador |  |  |  |  |  |  |  |  |  |  |
| Santander | https://www.santander.pt/credito-habitacao/simulador-credito-habitacao |  |  |  |  |  |  |  |  |  |  |
| BPI | https://www.bancobpi.pt/particulares/credito-habitacao/simulador |  |  |  |  |  |  |  |  |  |  |
| Novo Banco | https://www.novobanco.pt/particulares/credito-habitacao |  |  |  |  |  |  |  |  |  |  |

## Resultado final
- CGD (PMT capital+juros, mesmo Euribor e spreads da API): **coincidência exacta** com a fórmula de anuidade do simulador.
- Observações:
  - Manter **Euribor actualizado** (BCE / sessão do banco); um Euribor diferente altera só a componente TAN.
  - MTIC/TAEG dependem de custos iniciais e seguros na FINE — comparar sempre com o mesmo pacote de produtos.

## Checklist de consistência
- [x] Mesmos inputs em todos os simuladores (CGD API)
- [x] Mesmo tipo de taxa/indexante
- [x] Produtos associados alinhados (cartão base vs reduzido)
- [ ] Seguros dentro/fora do banco identificados
- [ ] Guardadas evidências (screenshots)
