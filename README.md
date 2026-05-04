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

---

*Simulação indicativa. Consulte sempre a FINE antes de contratar.*


## Auditoria de resultados
- Usa o template `AUDITORIA.md` para comparar o simulador interno com simuladores oficiais de bancos e registar desvios de prestação, TAEG e MTIC.
