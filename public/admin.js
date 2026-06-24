/** Domínios para favicon (proxy local /api/favicon) — alinhado com o simulador */
const BANK_DOMAINS = {
  CA: 'creditoagricola.pt', CTT: 'ctt.pt', BNKTR: 'bankinter.pt', ABANCA: 'abanca.com',
  BCP: 'millenniumbcp.pt', ACTVO: 'activobank.pt', BPI: 'bpi.pt', MNTPO: 'bancomontepio.pt',
  SANTR: 'santander.pt', NB: 'novobanco.pt', CGD: 'cgd.pt', UCI: 'uci.es',
  BNI: 'bnieuropa.pt'
};

let banks = [];
let editingCode = null;
let adminUnlocked = false;
/** Último payload `euribor` do GET /api/banks (BCE 3m/6m/12m). */
let lastEuriborPayload = null;

const ADMIN_EUR_KEY = 'adminEuriborRef';
const ADMIN_EUR_VALID = ['3m', '6m', '12m'];

function getAdminEurRef() {
  try {
    const v = sessionStorage.getItem(ADMIN_EUR_KEY);
    if (ADMIN_EUR_VALID.includes(v)) return v;
  } catch (_) {}
  return '6m';
}

function setAdminEurRef(ref) {
  if (!ADMIN_EUR_VALID.includes(ref)) return;
  try {
    sessionStorage.setItem(ADMIN_EUR_KEY, ref);
  } catch (_) {}
}

function fmtPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toFixed(3).replace('.', ',') + '%';
}

function updateEuriborLiveLabel() {
  const el = document.getElementById('adminEuriborLive');
  if (!el) return;
  const ref = getAdminEurRef();
  const eur = lastEuriborPayload && lastEuriborPayload.eur ? lastEuriborPayload.eur[ref] : null;
  const lbl = lastEuriborPayload && lastEuriborPayload.eurLabel;
  if (eur != null && Number.isFinite(Number(eur))) {
    el.textContent = 'BCE Eur.' + ref.toUpperCase() + ' ' + fmtPct(eur) + (lbl ? ' · ' + lbl : '');
    el.className = 'status ok';
  } else {
    el.textContent = 'Euribor BCE indisponível';
    el.className = 'status error';
  }
}

function updateAdminModalEuriborHint(b) {
  const hint = document.getElementById('adminModalEurHint');
  if (!hint) return;
  const ref = getAdminEurRef();
  const eur = lastEuriborPayload && lastEuriborPayload.eur ? lastEuriborPayload.eur[ref] : null;
  if (!b) {
    hint.innerHTML = 'Escolha o <strong>indexante BCE</strong> na barra acima. Ao guardar o banco, alinhe <strong>Refs Euribor</strong> ao precário (3m / 6m / 12m).';
    return;
  }
  const refsArr = b.refs || [];
  const ok = refsArr.includes(ref);
  const s = b.spreads || {};
  if (eur == null || !Number.isFinite(Number(eur))) {
    hint.innerHTML = 'Indexante <strong>' + escapeHtml(ref) + '</strong>: valor BCE indisponível.';
    return;
  }
  const t1 = s.sCom != null ? Number(eur) + Number(s.sCom) : null;
  const t2 = s.sSem != null ? Number(eur) + Number(s.sSem) : null;
  let html = 'Indexante <strong>' + escapeHtml(ref) + '</strong> BCE: <strong>' + fmtPct(eur) + '</strong> · TAN <em>variável</em> ilustr.: <strong>' + fmtPct(t1) + '</strong> c/ prod. / <strong>' + fmtPct(t2) + '</strong> s/ prod.';
  if (!ok) {
    html += ' <span style="color:#fbbf24;">Refs actuais (' + escapeHtml(refsArr.length ? refsArr.join(', ') : 'vazio') + ') não incluem <strong>' + escapeHtml(ref) + '</strong> — ajuste «Refs Euribor» ou troque o indexante.</span>';
  }
  hint.innerHTML = html;
}

function setAdminUnlocked(ok) {
  adminUnlocked = !!ok;
  const prot = document.getElementById('adminProtected');
  const nb = document.getElementById('btnNewBank');
  if (prot) prot.style.display = ok ? '' : 'none';
  if (nb) nb.style.display = ok ? 'inline-block' : 'none';
}

async function verifyAdminToken() {
  const token = getToken().trim();
  if (!token) return false;
  const r = await fetch('/api/banks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: '{}',
  });
  return r.ok;
}

document.getElementById('tokenInput').addEventListener('input', () => {
  setAdminUnlocked(false);
  banks = [];
  const grid = document.getElementById('banksGrid');
  if (grid) grid.innerHTML = '';
  const ebar = document.getElementById('adminEuriborBar');
  if (ebar) ebar.style.display = 'none';
  const cl = document.getElementById('commentsAdminList');
  const cs = document.getElementById('commentsAdminStatus');
  if (cl) cl.innerHTML = '';
  if (cs) { cs.textContent = ''; cs.className = 'status'; }
  const sg = document.getElementById('statsAdminGrid');
  const s7 = document.getElementById('statsAdmin7d');
  const sl = document.getElementById('statsAdminLocations');
  if (sg) sg.innerHTML = '';
  if (s7) s7.innerHTML = '';
  if (sl) sl.innerHTML = '';
});

function getToken() { return document.getElementById('tokenInput').value; }
function setStatus(msg, type) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className = 'status ' + (type || '');
}

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('pt-PT');
}

async function loadStatsAdmin() {
  if (!adminUnlocked) return;
  const grid = document.getElementById('statsAdminGrid');
  const t7 = document.getElementById('statsAdmin7d');
  if (t7) t7.innerHTML = '<p class="status" style="margin:4px 0 8px;">A carregar…</p>';
  if (grid) grid.innerHTML = '';
  try {
    const r = await fetch('/api/stats', { headers: { 'x-admin-token': getToken().trim() } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (grid) {
      const sinceFmt = (() => {
        if (d.resetAt) {
          try { return new Date(d.resetAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }); } catch (_) { return d.resetAt; }
        }
        return d.recordedSince || '—';
      })();
      const sinceLabel = d.resetAt ? 'Contagem desde (após reset)' : 'Primeiro dia nos registos (UTC)';
      grid.innerHTML = `
        <div class="stat-card"><div class="label">Visitas página inicial (total)</div><div class="value">${fmtNum(d.homepageTotal)}</div></div>
        <div class="stat-card"><div class="label">Visitas hoje · início</div><div class="value">${fmtNum(d.today && d.today.homepage)}</div></div>
        <div class="stat-card"><div class="label">Visitas painel admin (total)</div><div class="value">${fmtNum(d.adminTotal)}</div></div>
        <div class="stat-card"><div class="label">Visitas hoje · admin</div><div class="value">${fmtNum(d.today && d.today.admin)}</div></div>
        <div class="stat-card"><div class="label">Linhas comentários (BD)</div><div class="value">${d.commentsTotal != null ? fmtNum(d.commentsTotal) : '—'}</div></div>
        <div class="stat-card"><div class="label">${escapeHtml(sinceLabel)}</div><div class="value" style="font-size:0.9rem;line-height:1.3">${escapeHtml(sinceFmt)}</div></div>
      `;
    }
    if (t7 && d.last7Days && d.last7Days.length) {
      const rows = d.last7Days.map(x =>
        `<tr><td>${escapeHtml(x.day)}</td><td>${fmtNum(x.homepage)}</td><td>${fmtNum(x.admin)}</td></tr>`
      ).join('');
      t7.innerHTML = '<table><thead><tr><th>Dia (UTC)</th><th>Início</th><th>Admin</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
    const locEl = document.getElementById('statsAdminLocations');
    if (locEl) {
      const excluded = d.excludedIps || [];
      const excludedBar = excluded.length
        ? `<div style="margin-top:10px;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span>🚫 IPs excluídos: ${excluded.map(ip => `<code style="background:rgba(0,0,0,0.15);padding:1px 5px;border-radius:3px">${escapeHtml(ip)}</code>`).join(' ')}</span>
            <button class="btn-sm" onclick="clearExcludedIps()">Remover exclusões</button>
          </div>`
        : '';
      const excludeBtn = `<div style="margin-top:10px;"><button class="btn-sm" onclick="excludeMyIp()" title="Adiciona o teu IP actual à lista de exclusão — as tuas visitas deixam de ser contadas">🚫 Ignorar o meu IP</button></div>`;
      if (d.locations && d.locations.length) {
        const flag = cc => cc && cc.length === 2
          ? `<img src="https://flagcdn.com/16x12/${escapeHtml(cc.toLowerCase())}.png" width="16" height="12" alt="${escapeHtml(cc.toUpperCase())}" style="vertical-align:middle;margin-right:5px;border-radius:1px">`
          : '';
        const INITIAL = 5;
        const rows = d.locations.map((l, i) =>
          `<tr${i >= INITIAL ? ' class="loc-extra" style="display:none"' : ''}><td>${flag(l.country_code)}${escapeHtml(!l.city || l.city === '?' ? '—' : l.city)}</td><td style="color:var(--muted)">${escapeHtml(l.country_name || l.country_code)}</td><td>${fmtNum(l.count)}</td></tr>`
        ).join('');
        const extra = d.locations.length - INITIAL;
        const moreBtn = extra > 0
          ? `<div style="text-align:center;margin-top:8px;"><button class="btn-sm btn-history" onclick="showMoreLocations(this)">Ver mais (${extra} localização${extra !== 1 ? 'ões' : ''})</button></div>`
          : '';
        locEl.innerHTML = `<div class="stats-admin-col-table"><h3 style="font-size:13px;font-weight:600;margin:0 0 8px;color:var(--text)">🌍 Localização dos visitantes</h3><div class="stats-admin-7d"><table><thead><tr><th>Cidade</th><th>País</th><th>Visitas</th></tr></thead><tbody>${rows}</tbody></table></div>${moreBtn}${excludedBar}${excludeBtn}</div>`;
      } else {
        locEl.innerHTML = `<div class="stats-admin-col-table"><p class="status" style="margin:4px 0;font-size:12px;">Sem dados de localização ainda.</p>${excludedBar}${excludeBtn}</div>`;
      }
    }
  } catch (e) {
    if (grid) grid.innerHTML = '<p class="status error">Não foi possível carregar estatísticas: ' + escapeHtml(e.message.slice(0, 120)) + '</p>';
    if (t7) t7.innerHTML = '';
  }
}

function showMoreLocations(btn) {
  document.querySelectorAll('.loc-extra').forEach(tr => { tr.style.display = ''; });
  btn.closest('div').remove();
}

async function excludeMyIp() {
  if (!adminUnlocked) return;
  try {
    const r = await fetch('/api/stats', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': getToken().trim() },
      body: JSON.stringify({ action: 'exclude' })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
    alert('IP ' + d.ip + ' excluído — as tuas visitas deixam de ser contadas.');
    await loadStatsAdmin();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function clearExcludedIps() {
  if (!adminUnlocked) return;
  if (!confirm('Remover todos os IPs excluídos?')) return;
  try {
    const r = await fetch('/api/stats', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': getToken().trim() },
      body: JSON.stringify({ action: 'clear_excluded' })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    await loadStatsAdmin();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function resetStatsAdmin() {
  if (!adminUnlocked) return;
  if (!confirm('Tem a certeza que quer apagar TODAS as estatísticas (visitas e localizações)?\n\nEsta acção não pode ser revertida.')) return;
  try {
    const r = await fetch('/api/stats', {
      method: 'DELETE',
      headers: { 'x-admin-token': getToken().trim() }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    await loadStatsAdmin();
  } catch (e) {
    alert('Erro ao fazer reset das estatísticas: ' + e.message);
  }
}

function renderCommentsAdminTree(items) {
  const box = document.getElementById('commentsAdminList');
  const st = document.getElementById('commentsAdminStatus');
  if (!box) return;
  if (!items || items.length === 0) {
    box.innerHTML = '<p class="status">Sem comentários.</p>';
    if (st) st.textContent = '';
    return;
  }
  function card(c, depth) {
    const dt = new Date(c.ts).toLocaleString('pt-PT');
    const idEsc = escapeHtml(c.id);
    const replies = (c.replies || []).map(r => card(r, depth + 1)).join('');
    const bankLine = c.bank ? ' · ' + escapeHtml(c.bank) : '';
    const nums = (c.simPt != null || c.realPt != null)
      ? '<div style="font-size:12px;color:var(--muted);margin-top:4px;">Simulador: '
        + (c.simPt != null ? escapeHtml(String(c.simPt)) : '—')
        + ' €/mês · Real: '
        + (c.realPt != null ? escapeHtml(String(c.realPt)) : '—')
        + ' €/mês</div>'
      : '';
    const flagged = c.flagged ? 'border:2px solid #ef4444;background:rgba(239,68,68,0.14)' : 'border:1px solid rgba(59,130,246,0.25);border-left:3px solid rgba(59,130,246,0.45)';
    const flagBadge = c.flagged ? '<span style="font-size:10px;background:#ef4444;color:#fff;border-radius:4px;padding:1px 6px;margin-left:6px;font-weight:700;">REPORTADO</span>' : '';
    const keepBtn = c.flagged ? `<button type="button" class="btn-sm" data-cid="${idEsc}" onclick="unflagCommentAdmin(this.dataset.cid)" title="Remover marca de reportado" style="background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.5);color:#16a34a;">Manter</button>` : '';
    return `
      <div style="margin-left:${depth * 14}px;margin-bottom:10px;padding:12px 14px;background:rgba(0,0,0,0.2);border-radius:8px;${flagged}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;font-size:13px;">
            <strong>${escapeHtml(c.name || 'Anónimo')}</strong>${flagBadge}<span style="color:var(--muted);">${bankLine}</span>
            <span style="color:var(--muted);font-size:12px;"> · ${dt}</span>
            ${nums}
            <div style="margin-top:8px;color:var(--text);white-space:pre-wrap;line-height:1.45;">${escapeHtml(c.text)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
            ${keepBtn}
            <button type="button" class="btn-sm btn-delete" data-cid="${idEsc}" onclick="deleteCommentAdmin(this.dataset.cid)">Apagar</button>
          </div>
        </div>
        ${replies}
      </div>`;
  }
  box.innerHTML = items.map(c => card(c, 0)).join('');
  if (st) st.textContent = items.length + ' fio(s)';
}

async function loadCommentsAdmin() {
  if (!adminUnlocked) return;
  const st = document.getElementById('commentsAdminStatus');
  if (st) { st.textContent = 'A carregar…'; st.className = 'status'; }
  try {
    const r = await fetch('/api/comments');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    renderCommentsAdminTree(Array.isArray(data) ? data : []);
    if (st) st.className = 'status ok';
  } catch (e) {
    if (st) {
      st.textContent = 'Erro: ' + e.message.slice(0, 80);
      st.className = 'status error';
    }
  }
}

async function deleteCommentAdmin(id) {
  if (!adminUnlocked || !id) return;
  if (!confirm('Apagar este comentário e respostas associadas?')) return;
  try {
    const r = await fetch('/api/comments?id=' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { 'x-admin-token': getToken().trim() },
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || 'HTTP ' + r.status);
    }
    await loadCommentsAdmin();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function unflagCommentAdmin(id) {
  if (!adminUnlocked || !id) return;
  try {
    const r = await fetch('/api/comments?id=' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': getToken().trim() },
      body: JSON.stringify({ action: 'unflag' }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || 'HTTP ' + r.status);
    }
    await loadCommentsAdmin();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function refreshSpreadsAI() {
  if (!adminUnlocked) {
    setStatus('Valida o token com Carregar primeiro.', 'error');
    return;
  }
  const token = getToken();
  if (!token) { setStatus('Introduz o Admin Token primeiro', 'error'); return; }
  const btn = document.getElementById('btnAi');
  const aiEl = document.getElementById('aiStatus');
  btn.disabled = true;
  btn.textContent = '⏳ A actualizar...';
  aiEl.textContent = 'A ler preçários e a chamar Google Gemini...';
  aiEl.className = '';
  document.getElementById('aiPending').innerHTML = '';
  try {
    const r = await fetch('/api/spreads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 202) throw new Error(data.error || 'HTTP ' + r.status);

    // O refresh corre em background no servidor (~2-5 min) — polling via GET /api/spreads.
    aiEl.textContent = '⏳ Actualização em curso (PDFs + Google Gemini — ~2-5 min)...';
    const deadline = Date.now() + 13 * 60 * 1000; // 13 min — margem para 1–2 chamadas Gemini.
    let st = null;
    while (Date.now() < deadline) {
      await new Promise(s => setTimeout(s, 5000));
      const sr = await fetch('/api/spreads').catch(() => null);
      st = sr ? await sr.json().catch(() => null) : null;
      if (st && !st.running) break;
      const mins = Math.floor((Date.now() - (st?.startedAt ? Date.parse(st.startedAt) : Date.now())) / 60000);
      aiEl.textContent = `⏳ Actualização em curso há ${mins} min...`;
    }
    if (!st || st.running) {
      aiEl.textContent = '⏳ Ainda a correr — o resultado aparece aqui quando terminar.';
      aiEl.className = '';
      if (st?.running) pollRefreshStatus(st); // continua a monitorizar em background
      return;
    }
    if (st.error) throw new Error(st.error);
    if (st.pending) {
      // Resultado da AI fica em revisão — o admin aprova antes de ir a "live".
      aiEl.textContent = `Pesquisa concluída — ${st.pending.bancos} bancos a aguardar revisão.`;
      aiEl.className = 'ok';
      renderPending(st.pending);
    } else {
      // Auto-aplicado (SPREADS_AUTO_APPLY=1) ou sem dados pendentes.
      const ts = st.updatedAt ? new Date(st.updatedAt).toLocaleString('pt-PT') : '';
      aiEl.textContent = `✓ Actualizado${ts ? ' · ' + ts : ''}`;
      aiEl.className = 'ok';
      await loadBanks();
    }
  } catch (e) {
    aiEl.textContent = 'Erro: ' + e.message.slice(0, 80);
    aiEl.className = 'error';
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 Actualizar Agora';
  }
}

// Etiquetas legíveis para os campos comparados no diff de aprovação.
const PENDING_FIELD_LABELS = {
  sCom: 'Spread var. c/ produtos', sSem: 'Spread var. s/ produtos',
  mCom: 'TAN mista c/', mSem: 'TAN mista s/', fCom: 'TAN fixa c/', fSem: 'TAN fixa s/',
  jsCom: 'Spread jovem c/', jsSem: 'Spread jovem s/',
  promoPeriodo: 'Promo (meses)', promoSpread: 'Spread promo',
  dossier: 'Dossier (€)', avaliacao: 'Avaliação (€)', contaMes: 'Conta/mês (€)',
  capMin: 'Capital mín. (€)', capMax: 'Capital máx. (€)',
  vRef: 'Seg. vida ref. (€)', mAno: 'Multirriscos/ano (€)',
  insV: 'Seguradora vida', insM: 'Seguradora multirriscos',
  contaNota: 'Nota da conta', minutas: 'Minutas (€)', jovemIsenta: 'Jovem isenta comissões',
};

// Igualdade tolerante: números com margem de arredondamento; null/undefined/'' equivalentes.
function pendingValsEqual(a, b) {
  const na = (a === undefined || a === '') ? null : a;
  const nb = (b === undefined || b === '') ? null : b;
  if (typeof na === 'number' && typeof nb === 'number') return Math.abs(na - nb) < 1e-9;
  if (na !== null && nb !== null && !isNaN(Number(na)) && !isNaN(Number(nb)) &&
      typeof na !== 'boolean' && typeof nb !== 'boolean') return Math.abs(Number(na) - Number(nb)) < 1e-9;
  return na === nb;
}

function pendingFmtVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  const s = String(v);
  return escapeHtml(s.length > 44 ? s.slice(0, 44) + '…' : s);
}

// Classifica a origem dos valores de um banco: lido do preçário (ficheiro via
// API) vs estimado pelo modelo, vs manual, vs canónico (seed). Baseia-se no
// source do registo e na contaNota (o modelo escreve "Estimativa..." quando não
// leu o ficheiro).
function spreadsOrigin(s) {
  const note = String((s && s.contaNota) || '');
  const src = String((s && s.source) || '').toLowerCase();
  const isEstimate = /estimativ|estimad|url\s*inv|inv[aá]lid|sem\s+pre[cç]/i.test(note);
  const tip = note ? ' — ' + note : '';
  if (src === 'manual') return { label: 'Manual', icon: '✍', color: '#60a5fa', title: 'Inserido manualmente (admin)' + tip };
  if (isEstimate) return { label: 'Estimativa', icon: '≈', color: '#fbbf24', title: 'Estimado pelo modelo (preçário não lido)' + tip };
  if (src === 'gemini' || src === 'anthropic') return { label: 'Preçário (API)', icon: '📄', color: '#22c55e', title: 'Lido do preçário oficial via API' + tip };
  if (src === 'seed' || src === 'seed-reconcile') return { label: 'Canónico', icon: '◆', color: '#94a3b8', title: 'Valor canónico do seed (ainda sem extração API)' + tip };
  return { label: '—', icon: '', color: 'var(--muted)', title: tip };
}

function originBadge(s) {
  const o = spreadsOrigin(s);
  if (!o.label || o.label === '—') return '';
  return `<span class="badge" title="${escapeHtml(o.title)}" style="background:${o.color}22;color:${o.color};border:1px solid ${o.color}55">${o.icon} ${escapeHtml(o.label)}</span>`;
}

// Mostra os dados PENDENTES (devolvidos pela AI) como uma tabela: uma linha por
// banco e, para cada campo, o valor antigo → novo. Campos que não mudam mostram
// o mesmo valor dos dois lados; só os alterados ficam destacados.
function renderPending(pending) {
  const el = document.getElementById('aiPending');
  if (!el) return;
  const ts = pending.fetchedAt ? new Date(pending.fetchedAt).toLocaleString('pt-PT') : '';
  const codes = Object.keys(pending.spreads || {});
  const liveByCode = {};
  (banks || []).forEach(b => { liveByCode[b.code] = b.spreads || {}; });

  const hasVal = (v) => !(v === null || v === undefined || v === '');

  // Colunas = campos conhecidos (ordem das etiquetas) + extra, só os que têm
  // algum valor (antigo ou novo) em pelo menos um banco.
  const extra = [];
  codes.forEach(code => {
    Object.keys(pending.spreads[code] || {}).forEach(k => {
      if (k !== 'codigo' && k !== 'source' && !(k in PENDING_FIELD_LABELS) && extra.indexOf(k) < 0) extra.push(k);
    });
  });
  const fields = Object.keys(PENDING_FIELD_LABELS).concat(extra).filter(k =>
    codes.some(code => hasVal((pending.spreads[code] || {})[k]) || hasVal((liveByCode[code] || {})[k])));

  const STICKY = 'position:sticky;left:0;background:var(--card);z-index:1';
  let changedBanks = 0, totalChanges = 0;

  const rows = codes.map(code => {
    const next = pending.spreads[code] || {};
    const live = liveByCode[code] || {};
    const isNew = !(code in liveByCode);
    const changedFields = fields.filter(k => !pendingValsEqual(live[k], next[k]));
    if (changedFields.length) { changedBanks++; totalChanges += changedFields.length; }
    const origin = originBadge({ ...next, source: next.source || 'gemini' });
    const bankCell = `<td style="${STICKY};text-align:left;white-space:nowrap;vertical-align:top">`
      + `<label style="display:flex;gap:6px;align-items:center;font-weight:600;cursor:pointer;color:var(--text)">`
      + `<input type="checkbox" class="pending-bank-chk" value="${escapeHtml(code)}" checked>`
      + `<span>${escapeHtml(code)}${isNew ? ' <span style="color:#22c55e">(novo)</span>' : ''}</span></label>`
      + (origin ? `<div style="margin-top:4px">${origin}</div>` : '')
      + `<div style="font-size:10px;color:var(--muted);margin-top:2px">${changedFields.length ? changedFields.length + ' alteração(ões)' : 'sem alterações'}</div>`
      + `</td>`;
    const cells = fields.map(k => {
      const changed = !pendingValsEqual(live[k], next[k]);
      return `<td style="white-space:nowrap${changed ? ';background:rgba(251,191,36,0.10)' : ''}">`
        + `<span style="color:var(--muted)">${pendingFmtVal(live[k])}</span>`
        + `<span style="color:var(--muted)"> → </span>`
        + `<span style="${changed ? 'color:#fbbf24;font-weight:600' : 'color:var(--text)'}">${pendingFmtVal(next[k])}</span>`
        + `</td>`;
    }).join('');
    return `<tr>${bankCell}${cells}</tr>`;
  }).join('');

  const headCells = fields.map(k =>
    `<th title="${escapeHtml(PENDING_FIELD_LABELS[k] || k)}" style="white-space:nowrap">${escapeHtml(k)}</th>`).join('');

  const body = codes.length
    ? `<div class="stats-admin-7d" style="max-height:420px;overflow:auto"><table><thead><tr>`
      + `<th style="${STICKY};z-index:2;text-align:left"><label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="pendingSelectAll" checked onchange="togglePendingAll(this)"> Banco</label></th>`
      + headCells
      + `</tr></thead><tbody>${rows}</tbody></table></div>`
    : `<p style="margin:6px 0;color:var(--muted)">Sem dados pendentes.</p>`;

  const summary = `${totalChanges} alteração(ões) em ${changedBanks} de ${codes.length} banco(s)`
    + ` · cada linha mostra antigo → novo (campos iguais aparecem repetidos)`;

  el.innerHTML =
    `<div style="margin-top:12px;padding:12px;border:1px solid rgba(251,191,36,0.4);border-radius:8px;background:rgba(251,191,36,0.08)">`
    + `<p style="margin:0 0 6px;font-weight:600">🕵️ Revisão pendente — ${codes.length} bancos${ts ? ' · ' + ts : ''}</p>`
    + `<p style="margin:0 0 4px;font-size:12px">${summary}</p>`
    + `<p style="margin:0 0 10px;font-size:12px;color:var(--muted)">Só ao aprovar é que estes valores substituem os dados servidos.</p>`
    + body
    + `<div class="comments-admin-toolbar" style="margin-top:10px">`
    + `<button type="button" class="btn-ai" onclick="approvePendingSpreads()">✓ Aprovar selecionados</button>`
    + `<button type="button" class="btn-sm btn-history" onclick="rejectPendingSpreads()">✗ Rejeitar tudo</button>`
    + `</div></div>`;
}

// Liga/desliga todos os checkboxes de banco da revisão pendente.
function togglePendingAll(cb) {
  document.querySelectorAll('.pending-bank-chk').forEach(c => { c.checked = cb.checked; });
}

async function approvePendingSpreads() {
  const token = getToken();
  if (!token) { setStatus('Introduz o Admin Token primeiro', 'error'); return; }
  const aiEl = document.getElementById('aiStatus');
  const checks = Array.from(document.querySelectorAll('.pending-bank-chk'));
  const selected = checks.filter(c => c.checked).map(c => c.value);
  if (!selected.length) {
    aiEl.textContent = 'Seleciona pelo menos um banco para aprovar.';
    aiEl.className = 'error';
    return;
  }
  try {
    const headers = { 'x-admin-token': token, 'x-spreads-action': 'approve' };
    // Só envia a lista quando é aprovação parcial; ausente = aprovar todos.
    if (selected.length < checks.length) headers['x-spreads-codes'] = selected.join(',');
    const r = await fetch('/api/spreads', { method: 'POST', headers });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.applied) throw new Error(data.error || 'Nada para aprovar');
    // Recarrega bancos (actualiza valores live e re-rendeniza eventuais pendentes restantes).
    await loadBanks();
    if (data.pending) {
      aiEl.textContent = `✓ ${selected.length} banco(s) publicado(s) · ${data.pending.bancos} ainda em revisão`;
    } else {
      document.getElementById('aiPending').innerHTML = '';
      aiEl.textContent = `✓ Publicado · ${selected.length} banco(s)`;
    }
    aiEl.className = 'ok';
  } catch (e) {
    aiEl.textContent = 'Erro ao aprovar: ' + e.message.slice(0, 80);
    aiEl.className = 'error';
  }
}

async function rejectPendingSpreads() {
  const token = getToken();
  if (!token) { setStatus('Introduz o Admin Token primeiro', 'error'); return; }
  const aiEl = document.getElementById('aiStatus');
  try {
    const r = await fetch('/api/spreads', { method: 'POST', headers: { 'x-admin-token': token, 'x-spreads-action': 'reject' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    document.getElementById('aiPending').innerHTML = '';
    aiEl.textContent = 'Resultado rejeitado — dados servidos inalterados.';
    aiEl.className = '';
  } catch (e) {
    aiEl.textContent = 'Erro ao rejeitar: ' + e.message.slice(0, 80);
    aiEl.className = 'error';
  }
}

// Ao carregar a página, verifica se há um refresh em curso ou dados pendentes.
async function checkPendingSpreads() {
  const aiEl = document.getElementById('aiStatus');
  try {
    const sr = await fetch('/api/spreads').catch(() => null);
    const st = sr ? await sr.json().catch(() => null) : null;
    if (!st) return;
    if (st.pending) {
      if (aiEl) { aiEl.textContent = `🕵️ ${st.pending.bancos} bancos a aguardar revisão.`; aiEl.className = 'ok'; }
      renderPending(st.pending);
    } else if (st.running) {
      if (aiEl) { aiEl.textContent = '⏳ Pesquisa em curso — a aguardar resultado...'; aiEl.className = ''; }
      pollRefreshStatus(st); // retoma monitorização em background sem bloquear o loadBanks
    }
  } catch (_) {}
}

// Polling em background — actualiza o aiStatus até o refresh terminar.
// Usado tanto por refreshSpreadsAI (após deadline) como por checkPendingSpreads (após reload).
async function pollRefreshStatus(initialSt) {
  const aiEl = document.getElementById('aiStatus');
  const deadline = Date.now() + 13 * 60 * 1000;
  let s = initialSt;
  while (Date.now() < deadline && s?.running) {
    await new Promise(r => setTimeout(r, 10000));
    const sr = await fetch('/api/spreads').catch(() => null);
    s = sr ? await sr.json().catch(() => null) : null;
    if (s?.running && aiEl) {
      const mins = Math.floor((Date.now() - (s.startedAt ? Date.parse(s.startedAt) : Date.now())) / 60000);
      aiEl.textContent = `⏳ Actualização em curso há ${mins} min...`;
    }
  }
  if (!s || s.running) {
    if (aiEl) { aiEl.textContent = '⏳ Ainda a correr — recarrega para ver o resultado.'; aiEl.className = ''; }
    return;
  }
  if (s.error) { if (aiEl) { aiEl.textContent = 'Erro: ' + s.error.slice(0, 80); aiEl.className = 'error'; } return; }
  if (s.pending) {
    if (aiEl) { aiEl.textContent = `Pesquisa concluída — ${s.pending.bancos} bancos a aguardar revisão.`; aiEl.className = 'ok'; }
    renderPending(s.pending);
  } else {
    const ts = s.updatedAt ? new Date(s.updatedAt).toLocaleString('pt-PT') : '';
    if (aiEl) { aiEl.textContent = `✓ Actualizado${ts ? ' · ' + ts : ''}`; aiEl.className = 'ok'; }
  }
}

async function loadBanks() {
  try {
    setStatus('A validar token…');
    const token = getToken().trim();
    if (!token) {
      setStatus('Introduz o Admin Token.', 'error');
      setAdminUnlocked(false);
      return;
    }
    const valid = await verifyAdminToken();
    if (!valid) {
      setStatus('Token inválido ou acesso negado.', 'error');
      setAdminUnlocked(false);
      return;
    }
    setAdminUnlocked(true);
    setStatus('A carregar…');
    const r = await fetch('/api/banks', { headers: { 'x-admin-token': token } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    banks = data.banks || data; // suporte para resposta {banks, euribor} e array legado
    lastEuriborPayload = data.euribor || null;
    const ebar = document.getElementById('adminEuriborBar');
    if (ebar) {
      ebar.style.display = banks.length ? 'block' : 'none';
      const sel = document.getElementById('adminEuriborSelect');
      if (sel) sel.value = getAdminEurRef();
    }
    updateEuriborLiveLabel();
    renderBanks();
    setStatus(banks.length + ' bancos carregados', 'ok');
    await loadStatsAdmin();
    await loadCommentsAdmin();
    await checkPendingSpreads();
  } catch (e) {
    setStatus('Erro: ' + e.message, 'error');
    setAdminUnlocked(false);
  }
}

function renderBanks() {
  const grid = document.getElementById('banksGrid');
  const ref = getAdminEurRef();
  const eur = lastEuriborPayload && lastEuriborPayload.eur ? lastEuriborPayload.eur[ref] : null;
  grid.innerHTML = banks.map(b => {
    const s = b.spreads || {};
    const domain = BANK_DOMAINS[b.code] || 'bank.pt';
    const hex = (b.color && String(b.color).startsWith('#')) ? b.color : '#64748b';
    const borderTint = hex.length === 7 ? hex + '55' : hex;
    const favUrl = '/api/favicon?domain=' + encodeURIComponent(domain);
    const refsArr = b.refs || [];
    const refOk = refsArr.includes(ref);
    const t1 = eur != null && Number.isFinite(Number(eur)) && s.sCom != null ? Number(eur) + Number(s.sCom) : null;
    const t2 = eur != null && Number.isFinite(Number(eur)) && s.sSem != null ? Number(eur) + Number(s.sSem) : null;
    const tanRow = '<tr><td>TAN var. ilustr. (Eur.' + ref + ')</td><td>' + fmtPct(t1) + ' / ' + fmtPct(t2) + '</td></tr>';
    const warnRow = refOk ? '' : '<tr><td colspan="2" style="color:#fbbf24;font-size:11px;line-height:1.35;">Refs (' + escapeHtml(refsArr.length ? refsArr.join(', ') : 'vazio') + ') não incluem <strong>' + escapeHtml(ref) + '</strong> — ajuste no editor ou troque o indexante acima.</td></tr>';
    const prefSrc = b.preferSource || 'api';
    const prefBadge = prefSrc === 'manual'
      ? '<span class="badge badge-manual" title="Spreads manuais (admin) activos">Manual</span>'
      : '<span class="badge badge-api" title="Spreads da API/FINE activos">API</span>';
    const prefBtnClass = prefSrc === 'manual' ? 'btn-prefer prefer-manual' : 'btn-prefer';
    const prefBtnLabel = prefSrc === 'manual' ? 'Mudar p/ API' : 'Mudar p/ Manual';
    return `
      <div class="card ${b.active ? '' : 'inactive'}">
        <div class="card-header">
          <div class="bank-logo-wrap" style="border-color:${borderTint}">
            <img src="${favUrl}" width="18" height="18" alt="" loading="lazy"
              onerror="this.style.display='none';var f=this.nextElementSibling;if(f)f.style.display='flex';"/>
            <span class="bank-logo-fallback">${b.code}</span>
          </div>
          <span class="card-title">${b.name}</span>
          <span class="card-code">${b.code}</span>
          <span class="badge ${b.active ? 'badge-active' : 'badge-inactive'}">${b.active ? 'activo' : 'inactivo'}</span>
          ${prefBadge}
          ${originBadge(s)}
        </div>
        <div class="card-body">
          <table>
            <tr><td>Refs Euribor</td><td>${refsArr.length ? escapeHtml(refsArr.join(', ')) : '—'}</td></tr>
            ${tanRow}
            <tr><td>Spread c/ prod.</td><td>${s.sCom != null ? s.sCom + '%' : '—'}</td></tr>
            <tr><td>Spread s/ prod.</td><td>${s.sSem != null ? s.sSem + '%' : '—'}</td></tr>
            <tr><td>TAN Mista c/</td><td>${s.mCom != null ? s.mCom + '%' : '—'}</td></tr>
            <tr><td>TAN Fixa c/</td><td>${s.fCom != null ? s.fCom + '%' : '—'}</td></tr>
            <tr><td>Dossier</td><td>${s.dossier != null ? s.dossier + '€' : '—'}</td></tr>
            <tr><td>Avaliação</td><td>${s.avaliacao != null ? s.avaliacao + '€' : '—'}</td></tr>
            <tr><td>Capital</td><td>${s.capMin ? s.capMin.toLocaleString() + '€' : '—'} — ${s.capMax ? s.capMax.toLocaleString() + '€' : '—'}</td></tr>
            <tr><td>Fonte activa</td><td>${s.source || '—'} (prefer: ${prefSrc})</td></tr>
            <tr><td>Actualizado</td><td>${s.fetchedAt ? new Date(s.fetchedAt).toLocaleString('pt-PT') : '—'}</td></tr>
            ${warnRow}
          </table>
        </div>
        <div class="card-actions">
          <button class="btn-sm btn-edit" onclick="openEditModal('${b.code}')">Editar</button>
          <button class="btn-sm btn-history" onclick="openHistory('${b.code}')">Histórico</button>
          <button class="btn-sm ${prefBtnClass}" onclick="togglePreferSource('${b.code}')">${prefBtnLabel}</button>
          <button class="btn-sm btn-delete" onclick="deleteBank('${b.code}')">Desactivar</button>
        </div>
      </div>
    `;
  }).join('');
}

function openNewBankModal() {
  if (!adminUnlocked) return;
  editingCode = null;
  document.getElementById('editModalTitle').textContent = 'Novo Banco';
  document.getElementById('f_code').disabled = false;
  clearForm();
  updateAdminModalEuriborHint(null);
  document.getElementById('editModal').classList.add('active');
}

function openEditModal(code) {
  if (!adminUnlocked) return;
  editingCode = code;
  const b = banks.find(x => x.code === code);
  if (!b) return;
  document.getElementById('editModalTitle').textContent = 'Editar — ' + b.name;
  document.getElementById('f_code').value = b.code;
  document.getElementById('f_code').disabled = true;
  document.getElementById('f_name').value = b.name;
  document.getElementById('f_color').value = b.color;
  document.getElementById('f_jOk').value = b.jOk ? '1' : '0';
  document.getElementById('f_carenciaMax').value = b.carenciaMax || 0;
  document.getElementById('f_tipos').value = (b.tipos || []).join(', ');
  document.getElementById('f_refs').value = (b.refs || []).join(', ');
  document.getElementById('f_promos').value = (b.promos || []).join(', ');
  document.getElementById('f_prod').value = b.prod || '';
  document.getElementById('f_jProd').value = b.jProd || '';

  const s = b.spreads || {};
  document.getElementById('f_sCom').value = s.sCom ?? '';
  document.getElementById('f_sSem').value = s.sSem ?? '';
  document.getElementById('f_jsCom').value = s.jsCom ?? '';
  document.getElementById('f_jsSem').value = s.jsSem ?? '';
  document.getElementById('f_mCom').value = s.mCom ?? '';
  document.getElementById('f_mSem').value = s.mSem ?? '';
  document.getElementById('f_fCom').value = s.fCom ?? '';
  document.getElementById('f_fSem').value = s.fSem ?? '';
  document.getElementById('f_promoPeriodo').value = s.promoPeriodo || 0;
  document.getElementById('f_promoSpread').value = s.promoSpread ?? '';
  document.getElementById('f_dossier').value = s.dossier ?? '';
  document.getElementById('f_avaliacao').value = s.avaliacao ?? '';
  document.getElementById('f_contaMes').value = s.contaMes ?? '';
  document.getElementById('f_minutas').value = s.minutas || 0;
  document.getElementById('f_jovemIsenta').value = s.jovemIsenta ? '1' : '0';
  document.getElementById('f_capMin').value = s.capMin ?? '';
  document.getElementById('f_capMax').value = s.capMax ?? '';
  document.getElementById('f_vRef').value = s.vRef ?? '';
  document.getElementById('f_mAno').value = s.mAno ?? '';
  document.getElementById('f_contaNota').value = s.contaNota || '';
  document.getElementById('f_insV').value = s.insV || '';
  document.getElementById('f_insM').value = s.insM || '';
  document.getElementById('f_jovemSameSpread').value = s.jovemSameSpread ? '1' : '0';
  document.getElementById('f_jovemIsentaAval').value = s.jovemIsentaAval ? '1' : '0';
  document.getElementById('f_jmCom').value = s.jmCom ?? '';
  document.getElementById('f_jmSem').value = s.jmSem ?? '';
  document.getElementById('f_jfCom').value = s.jfCom ?? '';
  document.getElementById('f_jfSem').value = s.jfSem ?? '';
  document.getElementById('f_vCap').value = s.vCap ?? '';
  document.getElementById('f_vAge').value = s.vAge ?? '';
  document.getElementById('f_pRef').value = s.pRef ?? '';
  document.getElementById('f_ltvBrackets').value = b.ltvBrackets ? JSON.stringify(b.ltvBrackets) : '';
  document.getElementById('f_preferSource').value = b.preferSource || 'api';

  updateAdminModalEuriborHint(b);
  document.getElementById('editModal').classList.add('active');
}

function clearForm() {
  ['f_code','f_name','f_prod','f_jProd','f_promos','f_tipos','f_refs',
   'f_sCom','f_sSem','f_jsCom','f_jsSem','f_mCom','f_mSem','f_fCom','f_fSem',
   'f_jmCom','f_jmSem','f_jfCom','f_jfSem',
   'f_promoSpread','f_dossier','f_avaliacao','f_contaMes','f_capMin','f_capMax',
   'f_vRef','f_mAno','f_vCap','f_vAge','f_pRef','f_contaNota','f_insV','f_insM',
   'f_ltvBrackets'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f_color').value = '#666666';
  document.getElementById('f_jOk').value = '1';
  document.getElementById('f_carenciaMax').value = '0';
  document.getElementById('f_promoPeriodo').value = '0';
  document.getElementById('f_minutas').value = '0';
  document.getElementById('f_jovemIsenta').value = '1';
  document.getElementById('f_jovemSameSpread').value = '0';
  document.getElementById('f_jovemIsentaAval').value = '0';
  document.getElementById('f_preferSource').value = 'api';
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function numOrNull(id) { const v = document.getElementById(id).value; return v === '' ? null : Number(v); }

async function saveBank() {
  if (!adminUnlocked) return;
  const code = document.getElementById('f_code').value.trim().toUpperCase();
  if (!code) return setStatus('Código obrigatório', 'error');

  const bank = {
    code,
    name: document.getElementById('f_name').value.trim(),
    color: document.getElementById('f_color').value,
    jOk: document.getElementById('f_jOk').value === '1',
    carenciaMax: parseInt(document.getElementById('f_carenciaMax').value) || 0,
    tipos: document.getElementById('f_tipos').value.split(',').map(s => s.trim()).filter(Boolean),
    refs: document.getElementById('f_refs').value.split(',').map(s => s.trim()).filter(Boolean),
    promos: document.getElementById('f_promos').value.split(',').map(s => s.trim()).filter(Boolean),
    prod: document.getElementById('f_prod').value.trim(),
    jProd: document.getElementById('f_jProd').value.trim(),
    active: true,
    sort_order: editingCode ? (banks.findIndex(b => b.code === editingCode)) : banks.length,
    ltvBrackets: (() => {
      const raw = document.getElementById('f_ltvBrackets').value.trim();
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (_) { return null; }
    })(),
    preferSource: document.getElementById('f_preferSource').value || 'api',
  };

  const spreads = {
    bank_code: code,
    sCom: numOrNull('f_sCom'), sSem: numOrNull('f_sSem'),
    mCom: numOrNull('f_mCom'), mSem: numOrNull('f_mSem'),
    fCom: numOrNull('f_fCom'), fSem: numOrNull('f_fSem'),
    jsCom: numOrNull('f_jsCom'), jsSem: numOrNull('f_jsSem'),
    jmCom: numOrNull('f_jmCom'), jmSem: numOrNull('f_jmSem'),
    jfCom: numOrNull('f_jfCom'), jfSem: numOrNull('f_jfSem'),
    promoPeriodo: parseInt(document.getElementById('f_promoPeriodo').value) || 0,
    promoSpread: numOrNull('f_promoSpread'),
    dossier: numOrNull('f_dossier'),
    avaliacao: numOrNull('f_avaliacao'),
    contaMes: numOrNull('f_contaMes'),
    contaNota: document.getElementById('f_contaNota').value.trim(),
    capMin: numOrNull('f_capMin'),
    capMax: numOrNull('f_capMax'),
    vRef: numOrNull('f_vRef'),
    mAno: numOrNull('f_mAno'),
    vCap: numOrNull('f_vCap'),
    vAge: numOrNull('f_vAge'),
    pRef: numOrNull('f_pRef'),
    insV: document.getElementById('f_insV').value.trim(),
    insM: document.getElementById('f_insM').value.trim(),
    minutas: numOrNull('f_minutas'),
    jovemIsenta: document.getElementById('f_jovemIsenta').value === '1',
    jovemSameSpread: document.getElementById('f_jovemSameSpread').value === '1',
    jovemIsentaAval: document.getElementById('f_jovemIsentaAval').value === '1',
    source: 'manual',
  };

  const rawLtv = document.getElementById('f_ltvBrackets').value.trim();
  if (rawLtv && bank.ltvBrackets === null) {
    return setStatus('ltvBrackets: JSON inválido — verifique o formato', 'error');
  }

  try {
    const r = await fetch('/api/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': getToken() },
      body: JSON.stringify({ bank, spreads }),
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'HTTP ' + r.status); }
    setStatus('Guardado ✓', 'ok');
    closeModal('editModal');
    loadBanks();
  } catch (e) { setStatus('Erro: ' + e.message, 'error'); }
}

async function togglePreferSource(code) {
  if (!adminUnlocked) return;
  const b = banks.find(x => x.code === code);
  if (!b) return;
  const newPref = (b.preferSource || 'api') === 'api' ? 'manual' : 'api';
  try {
    const r = await fetch('/api/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': getToken() },
      body: JSON.stringify({ bank: { ...b, preferSource: newPref } }),
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'HTTP ' + r.status); }
    setStatus('Fonte alterada para "' + newPref + '" ✓', 'ok');
    loadBanks();
  } catch (e) { setStatus('Erro: ' + e.message, 'error'); }
}

async function deleteBank(code) {
  if (!adminUnlocked) return;
  if (!confirm('Desactivar banco ' + code + '?')) return;
  try {
    const r = await fetch('/api/banks?code=' + code, {
      method: 'DELETE',
      headers: { 'x-admin-token': getToken() },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    setStatus('Desactivado ✓', 'ok');
    loadBanks();
  } catch (e) { setStatus('Erro: ' + e.message, 'error'); }
}

async function openHistory(code) {
  if (!adminUnlocked) return;
  const b = banks.find(x => x.code === code);
  document.getElementById('historyBankName').textContent = b ? b.name : code;
  try {
    const r = await fetch('/api/banks?history=' + code, { headers: { 'x-admin-token': getToken() } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const list = document.getElementById('historyList');
    if (!data.history || data.history.length === 0) {
      list.innerHTML = '<p style="color:var(--muted);padding:12px;">Sem histórico.</p>';
    } else {
      list.innerHTML = data.history.map(h => `
        <div class="history-item">
          <span class="date">${new Date(h.fetched_at).toLocaleString('pt-PT')}</span>
          <span class="source">(${h.source})</span><br/>
          Spread: ${h.sCom}% / ${h.sSem}% | Mista: ${h.mCom}% / ${h.mSem}% | Fixa: ${h.fCom}% / ${h.fSem}%
          | Dossier: ${h.dossier}€ | Aval: ${h.avaliacao}€
        </div>
      `).join('');
    }
    document.getElementById('historyModal').classList.add('active');
  } catch (e) { setStatus('Erro: ' + e.message, 'error'); }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

(function initAdminEuriborSelect() {
  const sel = document.getElementById('adminEuriborSelect');
  if (!sel) return;
  sel.addEventListener('change', function () {
    setAdminEurRef(this.value);
    updateEuriborLiveLabel();
    renderBanks();
    const modal = document.getElementById('editModal');
    if (modal && modal.classList.contains('active')) {
      if (editingCode) {
        const b = banks.find(x => x.code === editingCode);
        if (b) updateAdminModalEuriborHint(b);
      } else {
        updateAdminModalEuriborHint(null);
      }
    }
  });
})();

(function initModalEurLiveRefresh() {
  function stubFromSpreadForm() {
    return {
      refs: document.getElementById('f_refs').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      spreads: {
        sCom: numOrNull('f_sCom'),
        sSem: numOrNull('f_sSem'),
      },
    };
  }
  function refresh() {
    const modal = document.getElementById('editModal');
    if (!modal || !modal.classList.contains('active')) return;
    updateAdminModalEuriborHint(stubFromSpreadForm());
  }
  ['f_refs', 'f_sCom', 'f_sSem'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', refresh);
    if (el) el.addEventListener('change', refresh);
  });
})();
