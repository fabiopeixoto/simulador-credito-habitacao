# Simulador Crédito Habitação Portugal

Simulador gratuito de crédito habitação em Portugal para comparação de propostas entre bancos.

## Funcionalidades
- Comparação entre 14 bancos portugueses.
- Cálculo de prestação, TAEG, MTIC, DSTI e cenários de taxa.
- Euribor obtida via BCE.
- Atualização de spreads via API (`api/spreads.js`) com cache SQLite e rate limiting.
- PWA com Service Worker para melhor experiência de carregamento.

## Estrutura do projeto
```text
simulador-credito/
├── index.html          # App (bundle React compilado)
├── sw.js               # Service Worker (cache offline)
├── manifest.json       # Manifesto PWA
├── icon.svg            # Ícone da aplicação
├── og-image.svg        # Imagem Open Graph
├── server.js           # Servidor Node.js (HTTP, compressão, API)
├── Dockerfile          # Imagem Docker (node:20-slim)
├── Jenkinsfile         # Pipeline CI/CD com notificações Discord
├── api/
│   ├── spreads.js      # Proxy/API para spreads e Euribor
│   └── comments.js     # API de comentários da comunidade
├── AUDITORIA.md        # Template de auditoria de resultados
└── README.md
```

## Deploy (Docker + Jenkins)

O pipeline Jenkins constrói a imagem Docker e faz deploy automático a cada push.

### Credenciais necessárias no Jenkins
- `anthropic-api-key` — chave Anthropic para atualização de spreads
- `discord-webhook-url` — webhook Discord para notificações de build
- `github-api-token` — token GitHub para enriquecer mensagens de build
- `admin-token` — token para apagar comentários via `?admin=<token>`
- `debug-secret` — token para endpoint de diagnóstico `/api/comments?debug=1&secret=<token>`

### Variáveis de ambiente
- `ANTHROPIC_API_KEY` — ativa atualização dinâmica de spreads via API Anthropic
- `ADMIN_TOKEN` — token para apagar comentários (aceder via `?admin=<token>`)
- `DEBUG_SECRET` — token para endpoint de diagnóstico `/api/comments?debug=1`

### Correr localmente
```bash
docker build -t simulador-credito-habitacao .
docker run -d --name simulador-credito-habitacao -p 3000:3000 \
  -v simulador-credito-habitacao-data:/usr/src/app/data \
  -e ANTHROPIC_API_KEY="..." \
  simulador-credito-habitacao:latest
```

Os comentários e o cache de spreads são guardados em SQLite em `data/`.

## Auditoria de resultados
Para validar se os resultados do simulador estão alinhados com os simuladores oficiais dos bancos:
1. Abre `AUDITORIA.md`.
2. Preenche os **mesmos inputs** usados em cada banco (montante, prazo, taxa, indexante, produtos, etc.).
3. Regista prestação, TAEG e MTIC do simulador interno e oficial.
4. Compara os desvios com as tolerâncias definidas no template.

## Notas
- Simulação meramente indicativa.
- Confirmar sempre condições finais na FINE (Ficha de Informação Normalizada Europeia).
