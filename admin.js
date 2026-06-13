/** Domínios para favicon (Google s2) — alinhado com o simulador */
const BANK_DOMAINS = {
  CA: 'creditoagricola.pt', CTT: 'ctt.pt', BNKTR: 'bankinter.pt', ABANCA: 'abanca.com',
  BCP: 'millenniumbcp.pt', ACTVO: 'activobank.pt', BPI: 'bpi.pt', MNTPO: 'bancomontepio.pt',
  SANTR: 'santander.pt', NB: 'novobanco.pt', CGD: 'cgd.pt', UCI: 'uci.es',
  BNI: 'bnieuropa.pt', BEST: 'bancobest.pt'
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
      grid.innerHTML = `
        <div class="stat-card"><div class="label">Visitas página inicial (total)</div><div class="value">${fmtNum(d.homepageTotal)}</div></div>
        <div class="stat-card"><div class="label">Visitas hoje · início</div><div class="value">${fmtNum(d.today && d.today.homepage)}</div></div>
        <div class="stat-card"><div class="label">Visitas painel admin (total)</div><div class="value">${fmtNum(d.adminTotal)}</div></div>
        <div class="stat-card"><div class="label">Visitas hoje · admin</div><div class="value">${fmtNum(d.today && d.today.admin)}</div></div>
        <div class="stat-card"><div class="label">Linhas comentários (BD)</div><div class="value">${d.commentsTotal != null ? fmtNum(d.commentsTotal) : '—'}</div></div>
        <div class="stat-card"><div class="label">Primeiro dia nos registos (UTC)</div><div class="value" style="font-size:1rem">${escapeHtml(d.recordedSince || '—')}</div></div>
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
      if (d.locations && d.locations.length) {
        const flag = cc => cc && cc.length === 2
          ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))
          : '';
        const rows = d.locations.map(l =>
          `<tr><td>${flag(l.country_code)} ${escapeHtml(l.city)}</td><td style="color:var(--muted)">${escapeHtml(l.country_name || l.country_code)}</td><td>${fmtNum(l.count)}</td></tr>`
        ).join('');
        locEl.innerHTML = `<h3 style="font-size:13px;font-weight:600;margin:0 0 8px;color:var(--text)">🌍 Localização dos visitantes</h3><div class="stats-admin-7d"><table><thead><tr><th>Cidade</th><th>País</th><th>Visitas</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      } else {
        locEl.innerHTML = '<p class="status" style="margin:4px 0;font-size:12px;">Sem dados de localização ainda.</p>';
      }
    }
  } catch (e) {
    if (grid) grid.innerHTML = '<p class="status error">Não foi possível carregar estatísticas: ' + escapeHtml(e.message.slice(0, 120)) + '</p>';
    if (t7) t7.innerHTML = '';
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
    return `
      <div style="margin-left:${depth * 14}px;margin-bottom:10px;padding:12px 14px;background:rgba(0,0,0,0.2);border-radius:8px;border-left:3px solid rgba(59,130,246,0.45);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;font-size:13px;">
            <strong>${escapeHtml(c.name || 'Anónimo')}</strong><span style="color:var(--muted);">${bankLine}</span>
            <span style="color:var(--muted);font-size:12px;"> · ${dt}</span>
            ${nums}
            <div style="margin-top:8px;color:var(--text);white-space:pre-wrap;line-height:1.45;">${escapeHtml(c.text)}</div>
          </div>
          <button type="button" class="btn-sm btn-delete" data-cid="${idEsc}" onclick="deleteCommentAdmin(this.dataset.cid)">Apagar</button>
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
  aiEl.textContent = 'A chamar Anthropic + BCE...';
  aiEl.className = '';
  try {
    const r = await fetch('/api/spreads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 202) throw new Error(data.error || 'HTTP ' + r.status);

    // O refresh corre em background no servidor (vários minutos com pesquisa web) —
    // o POST responde já; fazer polling do estado via GET /api/spreads.
    aiEl.textContent = '⏳ Actualização em curso (pode demorar 5–10 min)...';
    // Margem acima do tecto do servidor (ANTHROPIC_TOTAL_MS = 20 min) — caso
    // contrário o admin desiste enquanto o refresh ainda corre e termina com sucesso.
    const deadline = Date.now() + 22 * 60 * 1000;
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
      // O refresh continua no servidor e os dados ficam em cache quando terminar —
      // não se perdeu nada; basta recarregar a página daqui a uns minutos.
      aiEl.textContent = '⏳ Ainda a correr no servidor — recarrega a página daqui a uns minutos para ver o resultado.';
      aiEl.className = '';
      return;
    }
    if (st.error) throw new Error(st.error);
    const ts = st.updatedAt ? new Date(st.updatedAt).toLocaleString('pt-PT') : '';
    aiEl.textContent = `✓ Actualizado${ts ? ' · ' + ts : ''}`;
    aiEl.className = 'ok';
    // Recarregar lista de bancos para mostrar dados actualizados
    await loadBanks();
  } catch (e) {
    aiEl.textContent = 'Erro: ' + e.message.slice(0, 80);
    aiEl.className = 'error';
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 Actualizar Agora';
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
    const favUrl = 'https://www.google.com/s2/favicons?sz=32&amp;domain=' + encodeURIComponent(domain);
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
