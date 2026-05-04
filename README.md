# Simulador Crédito Habitação Portugal

Simulador gratuito de crédito habitação em Portugal para comparação de propostas entre bancos.

## Funcionalidades
- Comparação entre 14 bancos portugueses.
- Cálculo de prestação, TAEG, MTIC, DSTI e cenários de taxa.
- Euribor obtida via BCE.
- Atualização de spreads via função serverless (`api/spreads.js`) com cache e rate limiting.
- PWA com Service Worker para melhor experiência de carregamento.

## Estrutura do projeto
```text
simulador-credito/
├── index.html          # App (bundle React compilado)
├── sw.js               # Service Worker (cache offline)
├── manifest.json       # Manifesto PWA
├── icon.svg            # Ícone da aplicação
├── og-image.svg        # Imagem Open Graph
├── vercel.json         # Configuração de deploy (Vercel)
├── api/
│   └── spreads.js      # Proxy/API para spreads e Euribor
├── AUDITORIA.md        # Template de auditoria de resultados
└── README.md
```

<<<<<<< codex/review-code-and-suggest-improvements-adz028
## Deploy no Vercel (rápido)
1. Criar repositório no GitHub e enviar os ficheiros do projeto.
2. Importar o repositório em [vercel.com](https://vercel.com).
3. (Opcional) Definir variável de ambiente:
   - `ANTHROPIC_API_KEY`
4. Fazer redeploy.

## Variáveis de ambiente
- `ANTHROPIC_API_KEY` (opcional): ativa atualização dinâmica de spreads via API Anthropic.

## Auditoria de resultados
Para validar se os resultados do simulador estão alinhados com os simuladores oficiais dos bancos:
1. Abre `AUDITORIA.md`.
2. Preenche os **mesmos inputs** usados em cada banco (montante, prazo, taxa, indexante, produtos, etc.).
3. Regista prestação, TAEG e MTIC do simulador interno e oficial.
4. Compara os desvios com as tolerâncias definidas no template.

## Notas
- Simulação meramente indicativa.
- Confirmar sempre condições finais na FINE (Ficha de Informação Normalizada Europeia).
=======
---

*Simulação indicativa. Consulte sempre a FINE antes de contratar.*


## Auditoria de resultados
- Usa o template `AUDITORIA.md` para comparar o simulador interno com simuladores oficiais de bancos e registar desvios de prestação, TAEG e MTIC.
>>>>>>> main
