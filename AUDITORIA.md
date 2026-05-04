# Versão Auditoria — Simulador Crédito Habitação

> Objetivo: comparar resultados do simulador interno com simuladores oficiais dos bancos.

## Regras de comparação
- Data da auditoria (UTC): ____-__-__
- Perfil: HPP / Não HPP
- Montante imóvel: ____ €
- Entrada: ____ €
- Montante crédito: ____ €
- Prazo: ____ anos
- Tipo de taxa: Variável / Mista / Fixa
- Indexante: Euribor 3M / 6M / 12M
- Titulares: 1 / 2 (idades: ____ / ____)
- Produtos associados: Com / Sem

## Tolerâncias aceites
- Prestação mensal: desvio até **±5%** = "aproximado".
- TAEG: desvio até **±0,30 p.p.** = "aproximado".
- MTIC: desvio até **±5%** = "aproximado".

## Tabela de evidência
| Banco | URL oficial | Prestação (interno) | Prestação (oficial) | Desvio % | TAEG (interno) | TAEG (oficial) | Dif. p.p. | MTIC (interno) | MTIC (oficial) | Desvio % | Resultado |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| CGD | https://simuladorch.cgd.pt/ |  |  |  |  |  |  |  |  |  |  |
| Millennium BCP | https://www.millenniumbcp.pt/credito/credito-habitacao/simulador |  |  |  |  |  |  |  |  |  |  |
| Santander | https://www.santander.pt/credito-habitacao/simulador-credito-habitacao |  |  |  |  |  |  |  |  |  |  |
| BPI | https://www.bancobpi.pt/particulares/credito-habitacao/simulador |  |  |  |  |  |  |  |  |  |  |
| Novo Banco | https://www.novobanco.pt/particulares/credito-habitacao |  |  |  |  |  |  |  |  |  |  |

## Resultado final
- % bancos com resultado "aproximado": ____ %
- Observações:
  - ____
  - ____

## Checklist de consistência
- [ ] Mesmos inputs em todos os simuladores
- [ ] Mesmo tipo de taxa/indexante
- [ ] Produtos associados alinhados
- [ ] Seguros dentro/fora do banco identificados
- [ ] Guardadas evidências (screenshots)
