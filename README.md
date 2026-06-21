# Simulador Crédito Habitação Portugal

Ferramenta gratuita para **simular e comparar** crédito habitação em Portugal: prestação, TAEG, MTIC, DSTI, cenários de Euribor, amortizações, seguros e custos iniciais.

> Simulação meramente **indicativa**. Confirmar sempre as condições na **FINE** e na proposta do banco.

---

## Funcionalidades

- Comparação entre **13 bancos** portugueses com spreads actualizados.
- Modos **crédito normal** e **crédito jovem** (regras BdP, LTV, finalidade HPP / 2.ª habitação / arrendamento).
- Taxa **variável, mista ou fixa**; indexantes Euribor 3m / 6m / 12m.
- Estimativas de seguros (vida e multirriscos), IMT, imposto de selo e TAEG.
- **Calculadora inversa** — capital máximo dado rendimento, DSTI e taxa.
- **Transferência de crédito** — compara bancos para trocar o crédito existente.
- **Histórico Euribor BCE** — gráfico de evolução 3m / 6m / 12m e spreads por banco.
- Partilha por URL, histórico local e secção de **comentários** da comunidade.
- PWA instalável.

---

## Desenvolvimento local

```bash
npm install
npm start
# http://localhost:3000
```

Requer Node.js 20+. A base de dados SQLite é criada automaticamente em `data/` na primeira execução.

---

## Docker

```bash
docker build -t simulador-credito-habitacao .
docker run -d -p 3000:3000 \
  -v simulador-credito-habitacao-data:/usr/src/app/data \
  -e GEMINI_API_KEY="..." \
  -e ADMIN_TOKEN="..." \
  simulador-credito-habitacao:latest
```

---

## Licença / aviso legal

Este projecto é disponibilizado como ferramenta de apoio à decisão. Os valores são **estimativas** com base em dados públicos e não constituem aconselhamento financeiro.
