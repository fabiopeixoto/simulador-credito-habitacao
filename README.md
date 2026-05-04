# Simulador Crédito Habitação Portugal

Simulador gratuito de crédito habitação em Portugal.  
Compare 14 bancos com TAEG, MTIC, DSTI e Euribor actualizada.

## Deploy no Vercel — Passo a Passo

### 1. Criar conta GitHub
- Vai a [github.com](https://github.com) e regista-te (gratuito)

### 2. Criar repositório no GitHub
- Clica em **New repository**
- Nome: `simulador-credito`
- Visibilidade: Public (necessário para Vercel gratuito)
- Clica **Create repository**

### 3. Fazer upload dos ficheiros
- Na página do repositório, clica **uploading an existing file**
- Faz upload de todos os ficheiros desta pasta:
  - `index.html`
  - `vercel.json`
  - `api/spreads.js`  ← cria a pasta `api` primeiro
- Clica **Commit changes**

### 4. Ligar ao Vercel
- Vai a [vercel.com](https://vercel.com) e regista-te com a conta GitHub
- Clica **Add New → Project**
- Selecciona o repositório `simulador-credito`
- Clica **Deploy**

### 5. Configurar a chave API (opcional, para spreads)
- No dashboard do Vercel, vai ao projecto → **Settings → Environment Variables**
- Adiciona:
  - **Name:** `ANTHROPIC_API_KEY`
  - **Value:** `sk-ant-api03-...` (a tua chave de console.anthropic.com/settings/keys)
- Clica **Save**
- Vai a **Deployments → Redeploy**

### 6. O site está online!
- URL automático: `https://simulador-credito-xyz.vercel.app`
- Domínio personalizado: Settings → Domains → Add Domain

---

## Funcionalidades
- 14 bancos portugueses (abril 2026)
- Taxa variável / mista / fixa
- Crédito Jovem (DL 44/2024)
- 2 titulares com tipo de contrato
- TAEG · MTIC · DSTI · Stress test BdP
- Euribor actualizada via BCE (gratuito)
- Spreads actualizados via API Anthropic (opcional)
- 6 separadores: Comparação · Seguros · Custos · Viabilidade · Cenários · Amortização

---

## Estrutura do projecto
```
simulador-credito/
├── index.html          # App completa (React compilado)
├── vercel.json         # Configuração Vercel
├── api/
│   └── spreads.js      # Proxy seguro para API Anthropic
└── README.md
```

---

*Simulação indicativa. Consulte sempre a FINE antes de contratar.*


## Auditoria de resultados
- Usa o template `AUDITORIA.md` para comparar o simulador interno com simuladores oficiais de bancos e registar desvios de prestação, TAEG e MTIC.
