/* ============================================================
   LegalEase AI — app.js  |  Vanilla ES6  |  No dependencies
   ============================================================

   BACKEND INTEGRATION — search "🔌 BACKEND:" for every API hook.
   API_BASE defaults to localhost:8000 for local dev.
   In production, set window.LEGALEASE_API_BASE before this script.

   Expected endpoints your teammates need to build:
     POST /api/analyze          → upload file, returns clauses + risk
     POST /api/qa               → question + doc_id, returns AI answer
     GET  /api/report/:docId    → returns PDF blob
   ============================================================ */

'use strict';

const API_BASE = window.LEGALEASE_API_BASE || 'http://localhost:8000';

// ─── APP STATE ────────────────────────────────────────────────
const state = {
  currentPage: 'home',
  uploadedFile: null,
  documentId: null,
  documentName: null,
  clauses: [],
  activeFilter: 'all',
  searchQuery: '',
  currentClauseIndex: 0,
};

// ─── DEMO DATA ────────────────────────────────────────────────
// 🔌 BACKEND: This entire array gets replaced by the /api/analyze response.
// Keep the same shape: { id, type, risk, original, urdu, tooltip }
const DEMO_CLAUSES = [
  {
    id: 1, type: 'Termination', risk: 'high',
    original: '"The landlord reserves the right to terminate this agreement with 7 days written notice for any reason deemed appropriate by the landlord at their sole discretion."',
    urdu: 'مالک مکان بغیر کسی خاص وجہ کے صرف 7 دن کے نوٹس پر آپ کو گھر خالی کروا سکتا ہے۔ یہ آپ کے لیے انتہائی نقصان دہ ہے — دستخط سے پہلے اس شق پر مذاکرہ ضرور کریں۔',
    tooltip: 'Landlord can evict with only 7 days notice — no reason needed. Try to negotiate for minimum 60 days and specific valid reasons.',
  },
  {
    id: 2, type: 'Payment & Penalty', risk: 'medium',
    original: '"Late payment of monthly rent shall incur a financial penalty of five percent (5%) per week on the outstanding amount, compounded on a monthly basis."',
    urdu: 'اگر کرایہ دیر سے دیا تو ہر ہفتے 5٪ جرمانہ لگے گا جو ہر مہینے بڑھتا رہے گا۔ ایک مہینے کی تاخیر بھی بڑی رقم بن سکتی ہے — ہمیشہ وقت پر ادائیگی کریں۔',
    tooltip: '5% weekly compounding penalty. One missed month could cost 20%+ extra. Set a payment reminder immediately.',
  },
  {
    id: 3, type: 'Maintenance', risk: 'safe',
    original: '"The landlord shall remain solely responsible for all structural repairs and general maintenance where the cost thereof exceeds Pakistani Rupees Ten Thousand (PKR 10,000)."',
    urdu: '10,000 روپے سے اوپر کی تمام مرمت مالک مکان کی ذمہ داری ہے۔ یہ آپ کے لیے بالکل فائدہ مند شق ہے — اسے تبدیل نہ کروائیں۔',
    tooltip: null,
  },
  {
    id: 4, type: 'Arbitration', risk: 'high',
    original: '"Any disputes arising under this agreement shall be submitted exclusively to binding arbitration. The tenant hereby waives the right to pursue matters through civil courts of law."',
    urdu: 'اگر کوئی تنازعہ ہو تو آپ عدالت نہیں جا سکتے — صرف ثالثی (آربٹریشن) کا راستہ ہے۔ یہ عام طور پر مالک مکان کے حق میں ہوتا ہے کیونکہ وہ زیادہ وسائل رکھتا ہے۔',
    tooltip: 'You give up your right to civil court. Arbitration strongly favors the wealthier party. Try to remove this clause.',
  },
  {
    id: 5, type: 'Liability Waiver', risk: 'high',
    original: '"The landlord shall not be held liable for any damages to the tenant\'s personal property arising from structural defects, water leaks, electrical failures, or utility disruptions."',
    urdu: 'اگر گھر کی خرابی کی وجہ سے آپ کا کوئی سامان تباہ ہو تو مالک مکان ذمہ دار نہیں ہوگا۔ رہائش پذیر ہونے سے پہلے مکمل معائنہ کریں اور تصویریں لیں۔',
    tooltip: 'Landlord escapes all liability for property damage. Document move-in condition thoroughly with timestamped photos.',
  },
  {
    id: 6, type: 'Rent Increase', risk: 'medium',
    original: '"The landlord reserves the right to increase the monthly rent by up to fifteen percent (15%) annually, with thirty (30) days advance written notice to the tenant."',
    urdu: 'مالک مکان ہر سال 15٪ تک کرایہ بڑھا سکتا ہے — صرف 30 دن کا نوٹس دے کر۔ 2 سال میں کرایہ کافی بڑھ سکتا ہے، پہلے سے بجٹ بنائیں۔',
    tooltip: '15% annual increase means rent grows ~32% over 2 years. Negotiate a cap at 8-10%.',
  },
  {
    id: 7, type: 'Subletting', risk: 'safe',
    original: '"The tenant is strictly prohibited from subletting or sharing the premises with any third party without obtaining prior written consent from the landlord."',
    urdu: 'بغیر مالک مکان کی تحریری اجازت کے آپ گھر کسی کو نہیں دے سکتے۔ یہ ایک معیاری اور قابل قبول شق ہے۔',
    tooltip: null,
  },
  {
    id: 8, type: 'Security Deposit', risk: 'safe',
    original: '"A security deposit equivalent to two (2) months rent shall be retained by the landlord and returned within sixty (60) days of vacating, subject to deductions for damages."',
    urdu: 'دو مہینے کا ڈپازٹ واپس کرنے کے لیے 60 دن دیے گئے ہیں۔ جاتے وقت گھر کی حالت کی تصویریں لیں تاکہ ناجائز کٹوتی سے بچ سکیں۔',
    tooltip: null,
  },
];

const RISK_ICONS  = { high: '🔴', medium: '🟡', safe: '🟢' };
const RISK_LABELS = { high: '⚠ High Risk', medium: '⚡ Medium Risk', safe: '✓ Safe' };

// ─── PAGE NAVIGATION ──────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) { page.classList.add('active'); state.currentPage = name; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeMobileMenu();
}

// ─── MOBILE MENU ──────────────────────────────────────────────
function toggleMobileMenu() {
  document.getElementById('mobile-menu')?.classList.toggle('open');
}
function closeMobileMenu() {
  document.getElementById('mobile-menu')?.classList.remove('open');
}

// ─── FILE UPLOAD ──────────────────────────────────────────────
function handleFileSelect(file) {
  if (!file) return;
  const ok = /\.(pdf|doc|docx|txt)$/i.test(file.name);
  if (!ok) { showToast('❌ Unsupported file. Use PDF, DOC, DOCX, or TXT.', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('❌ File exceeds 10MB limit.', 'error'); return; }

  state.uploadedFile = file;
  state.documentName = file.name;

  const btn = document.getElementById('upload-btn');
  if (btn) { btn.textContent = '⏳ Analyzing…'; btn.disabled = true; }

  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    dropZone.innerHTML = `
      <div class="drop-icon">⏳</div>
      <div class="drop-title">Processing "${file.name}"</div>
      <div class="drop-sub">Extracting text · Detecting risks · Generating Urdu explanations…</div>
      <div class="upload-progress"><div class="upload-progress-bar" id="progress-bar"></div></div>
    `;
    animateProgress();
  }

  doUpload(file);
}

function animateProgress() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  let w = 0;
  const iv = setInterval(() => {
    w = Math.min(w + Math.random() * 15, 90);
    bar.style.width = w + '%';
    if (w >= 90) clearInterval(iv);
  }, 200);
}

function doUpload(file) {
  /* 🔌 BACKEND: Replace this function body with the real API call.
     ──────────────────────────────────────────────────────────────
     async function doUpload(file) {
       try {
         const formData = new FormData();
         formData.append('file', file);

         const res = await fetch(`${API_BASE}/api/analyze`, {
           method: 'POST',
           body: formData,
         });

         if (!res.ok) throw new Error(await res.text());

         const data = await res.json();
         // data shape: { document_id, document_name, clauses: [...] }
         // Each clause: { id, type, risk, original, urdu, tooltip }

         state.documentId = data.document_id;
         state.clauses    = data.clauses;
         afterUploadSuccess();

       } catch (err) {
         showToast('❌ Analysis failed: ' + err.message, 'error');
         resetDropZone();
       }
     }
     ──────────────────────────────────────────────────────────── */

  // Demo simulation
  setTimeout(() => {
    state.documentId = 'demo-001';
    state.clauses    = DEMO_CLAUSES;
    afterUploadSuccess();
  }, 2200);
}

function afterUploadSuccess() {
  renderAnalysisPage();
  showPage('analysis');
  resetDropZone();
  const btn = document.getElementById('upload-btn');
  if (btn) { btn.textContent = '🔍 Upload & Analyze Document'; btn.disabled = false; }
  showToast(`✅ "${state.documentName}" analyzed — ${state.clauses.length} clauses detected`, 'success');
}

function resetDropZone() {
  const dropZone = document.getElementById('drop-zone');
  if (!dropZone) return;
  dropZone.innerHTML = `
    <input type="file" id="file-input" accept=".pdf,.doc,.docx,.txt" style="display:none"/>
    <div class="drop-icon">📄</div>
    <div class="drop-title">Drag & Drop your file here</div>
    <div class="drop-sub">or click to browse files</div>
    <div class="type-chips">
      <span class="type-chip">PDF</span>
      <span class="type-chip">DOC</span>
      <span class="type-chip">DOCX</span>
      <span class="type-chip">TXT</span>
    </div>
  `;
  // Re-attach listeners
  const fi = document.getElementById('file-input');
  if (fi) fi.addEventListener('change', e => handleFileSelect(e.target.files[0]));
  attachDropZoneListeners();
}

// ─── RENDER ANALYSIS ──────────────────────────────────────────
function renderAnalysisPage() {
  updateDocMeta();
  renderClauseList();
  renderAnalysisCards();
  renderReportTable();
  state.activeFilter = 'all';
  state.searchQuery  = '';
  state.currentClauseIndex = 0;
  const s = document.getElementById('clause-search');
  if (s) s.value = '';
  setActiveFilter('all', false);
}

function updateDocMeta() {
  const high = state.clauses.filter(c => c.risk === 'high').length;
  const med  = state.clauses.filter(c => c.risk === 'medium').length;
  const safe = state.clauses.filter(c => c.risk === 'safe').length;
  const name = state.documentName || 'Rental_Agreement_Karachi_2024.pdf';

  const el = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
  el('doc-name-display', name);
  el('doc-meta-display', `${state.clauses.length} clauses detected · ${high} high risk · ${med} medium`);
  el('report-doc-name', name.replace(/\.[^.]+$/, '').replace(/_/g,' '));
  el('report-total', state.clauses.length);
  el('report-high',  high);
  el('report-med',   med);
  el('report-safe',  safe);
  el('report-date',  new Date().toLocaleDateString('en-PK', { day:'numeric', month:'long', year:'numeric' }));
}

function getFiltered() {
  return state.clauses.filter(c => {
    const mf = state.activeFilter === 'all' || c.risk === state.activeFilter;
    const ms = !state.searchQuery ||
      c.type.toLowerCase().includes(state.searchQuery) ||
      c.original.toLowerCase().includes(state.searchQuery);
    return mf && ms;
  });
}

function renderClauseList() {
  const container = document.getElementById('clause-list');
  if (!container) return;
  const filtered = getFiltered();
  container.innerHTML = '';

  if (!filtered.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--muted);">
      <div style="font-size:32px;margin-bottom:12px;">🔍</div>
      No clauses match your filter.
    </div>`;
    return;
  }

  filtered.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'clause-orig' + (i === 0 ? ' selected' : '');
    el.dataset.clauseId = c.id;
    el.innerHTML = `
      <div class="clause-num">
        Clause ${String(c.id).padStart(2,'0')} · ${c.type}
        <span class="clause-risk-tag ${c.risk}">${RISK_LABELS[c.risk]}</span>
      </div>
      <div class="clause-text">${c.original}</div>
    `;
    el.addEventListener('click', () => selectClauseById(c.id, el));
    container.appendChild(el);
  });

  if (filtered.length) selectClauseById(filtered[0].id, container.firstChild);
}

function renderAnalysisCards() {
  const container = document.getElementById('analysis-cards');
  if (!container) return;
  const filtered = getFiltered();
  container.innerHTML = '';

  filtered.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'analysis-card';
    card.id = `card-${c.id}`;
    card.style.animationDelay = `${i * 0.07}s`;
    card.innerHTML = `
      <div class="ac-header ${c.risk}">
        <span class="risk-icon">${RISK_ICONS[c.risk]}</span>
        <span class="clause-type-label">${c.type}</span>
        <span class="risk-pill ${c.risk}">${RISK_LABELS[c.risk]}</span>
      </div>
      <div class="ac-body">
        <div class="urdu-explanation">
          <div class="urdu-tag">Urdu Explanation — اردو وضاحت</div>
          <div class="urdu-exp-text">${c.urdu}</div>
        </div>
        ${c.tooltip ? `<div class="risk-tooltip">${RISK_ICONS[c.risk]} <strong>Note:</strong> ${c.tooltip}</div>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

function renderReportTable() {
  const tbody = document.getElementById('report-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.clauses.map(c => `
    <tr>
      <td>${String(c.id).padStart(2,'0')}</td>
      <td>${c.type}</td>
      <td class="urdu-cell">${c.urdu.split('—')[0].trim()}</td>
      <td><span class="risk-badge-sm ${c.risk}">${RISK_LABELS[c.risk]}</span></td>
    </tr>
  `).join('');
}

function selectClauseById(id, el) {
  document.querySelectorAll('.clause-orig').forEach(c => c.classList.remove('selected'));
  if (el) el.classList.add('selected');
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card.classList.add('card-highlight');
    setTimeout(() => card.classList.remove('card-highlight'), 900);
  }
  const filtered = getFiltered();
  state.currentClauseIndex = filtered.findIndex(c => c.id === id);
}

// Legacy for any remaining inline onclicks
function selectClause(el) {
  document.querySelectorAll('.clause-orig').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

// ─── FILTER & SEARCH ──────────────────────────────────────────
function setActiveFilter(type, rerender = true) {
  state.activeFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('on'));
  const btn = document.getElementById('filter-' + type);
  if (btn) btn.classList.add('on');
  if (rerender) { renderClauseList(); renderAnalysisCards(); }
}

function handleSearch(e) {
  state.searchQuery = e.target.value.toLowerCase().trim();
  renderClauseList();
  renderAnalysisCards();
}

// ─── CLAUSE NAV ───────────────────────────────────────────────
function navigateClause(dir) {
  const filtered = getFiltered();
  if (!filtered.length) return;
  state.currentClauseIndex = Math.max(0, Math.min(filtered.length - 1, state.currentClauseIndex + dir));
  const target = filtered[state.currentClauseIndex];
  const list = document.getElementById('clause-list');
  const el = list?.querySelector(`[data-clause-id="${target.id}"]`);
  selectClauseById(target.id, el);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Q&A ──────────────────────────────────────────────────────
function fillQuestion(el) {
  const input = document.getElementById('qa-input');
  if (input) { input.value = el.textContent.trim(); input.focus(); }
}

async function sendMessage() {
  const input = document.getElementById('qa-input');
  const q = input?.value.trim();
  if (!q) return;
  const msgs = document.getElementById('qa-messages');
  if (!msgs) return;

  appendUserMsg(msgs, q);
  if (input) input.value = '';

  const tid = 'typing-' + Date.now();
  msgs.insertAdjacentHTML('beforeend', `
    <div class="msg-wrap" id="${tid}">
      <div class="msg-avatar ai">AI</div>
      <div class="msg-bubble ai typing-dots"><span></span><span></span><span></span></div>
    </div>
  `);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    /* 🔌 BACKEND: Replace timeout with real API call.
       ─────────────────────────────────────────────────────────
       const res = await fetch(`${API_BASE}/api/qa`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ question: q, document_id: state.documentId }),
       });
       if (!res.ok) throw new Error('QA failed');
       const data = await res.json();
       // data: { answer_en, answer_ur, source_clause, confidence }
       document.getElementById(tid)?.remove();
       appendAIMsg(msgs, data.answer_en, data.answer_ur, data.source_clause);
       ─────────────────────────────────────────────────────── */

    await new Promise(r => setTimeout(r, 1100));
    document.getElementById(tid)?.remove();
    appendAIMsg(msgs,
      'Based on your document, this clause states the relevant terms. Once the AI backend is connected, it will use FAISS vector search to retrieve the exact relevant section and provide a precise, document-grounded answer.',
      'آپ کے سوال کا جواب آپ کے دستاویز کی بنیاد پر دیا جائے گا۔ بیک اینڈ کنیکٹ ہونے کے بعد FAISS سرچ سے متعلقہ شق تلاش کی جائے گی۔',
      'Retrieved from your document via FAISS'
    );
  } catch {
    document.getElementById(tid)?.remove();
    appendAIMsg(msgs, 'Connection error. Please try again.', 'رابطہ نہیں ہو سکا۔ دوبارہ کوشش کریں۔', null);
  }
}

function appendUserMsg(c, text) {
  c.insertAdjacentHTML('beforeend', `
    <div class="msg-wrap user">
      <div class="msg-avatar user">👤</div>
      <div class="msg-bubble user">${text}</div>
    </div>
  `);
  c.scrollTop = c.scrollHeight;
}

function appendAIMsg(c, en, ur, source) {
  c.insertAdjacentHTML('beforeend', `
    <div class="msg-wrap">
      <div class="msg-avatar ai">AI</div>
      <div class="msg-bubble ai">
        <strong>Based on your document:</strong> ${en}
        <div class="urdu-reply">${ur}</div>
        ${source ? `<div class="related-clause">📎 ${source}</div>` : ''}
      </div>
    </div>
  `);
  c.scrollTop = c.scrollHeight;
}

// ─── REPORT DOWNLOAD ──────────────────────────────────────────
async function downloadReport() {
  /* 🔌 BACKEND: Replace with real PDF download.
     ──────────────────────────────────────────────────────────
     const res = await fetch(`${API_BASE}/api/report/${state.documentId}`);
     if (!res.ok) { showToast('❌ Could not generate report.', 'error'); return; }
     const blob = await res.blob();
     const a = Object.assign(document.createElement('a'), {
       href: URL.createObjectURL(blob),
       download: `LegalEase_Report.pdf`,
     });
     a.click();
     URL.revokeObjectURL(a.href);
     ─────────────────────────────────────────────────────── */
  showToast('📄 PDF generation requires backend connection. Coming soon!', 'info');
}

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  document.getElementById('toast')?.remove();
  const t = Object.assign(document.createElement('div'), { id: 'toast', className: `toast toast-${type}`, textContent: msg });
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-show'));
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, 3500);
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// ─── DROP ZONE LISTENERS ──────────────────────────────────────
function attachDropZoneListeners() {
  const dz = document.getElementById('drop-zone');
  if (!dz) return;
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    handleFileSelect(e.dataTransfer.files[0]);
  });
  dz.addEventListener('click', () => document.getElementById('file-input')?.click());
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Pre-load demo data so the Demo nav link works immediately
  state.clauses = DEMO_CLAUSES;
  state.documentName = 'Rental_Agreement_Karachi_2024.pdf';
  renderAnalysisPage();

  // File input
  document.getElementById('file-input')?.addEventListener('change', e => handleFileSelect(e.target.files[0]));

  // Drop zone
  attachDropZoneListeners();

  // Q&A enter key
  document.getElementById('qa-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Clause search
  document.getElementById('clause-search')?.addEventListener('input', handleSearch);

  // Scroll-to-top button
  const stb = document.getElementById('scroll-top-btn');
  if (stb) window.addEventListener('scroll', () => stb.classList.toggle('visible', window.scrollY > 400));

  // Close mobile menu on outside click
  document.addEventListener('click', e => {
    const m = document.getElementById('mobile-menu');
    const h = document.getElementById('hamburger-btn');
    if (m && h && !m.contains(e.target) && !h.contains(e.target)) closeMobileMenu();
  });
});

// ─── GLOBALS ──────────────────────────────────────────────────
Object.assign(window, {
  showPage, selectClause, fillQuestion, sendMessage,
  setActiveFilter, navigateClause, downloadReport,
  toggleMobileMenu, scrollToTop,
});
