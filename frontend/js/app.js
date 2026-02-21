/**
 * app.js - LegalEase AI Frontend Logic
 * All UI interactions. API calls go through window.LegalEaseAPI (api.js).
 */
'use strict';

const RISK_ICONS  = { high: '🔴', medium: '🟡', safe: '🟢' };
const RISK_LABELS = { high: '⚠ High Risk', medium: '⚡ Medium Risk', safe: '✓ Safe' };

const state = {
  currentPage: 'home',
  documentId: null,
  documentName: null,
  clauses: [],
  activeFilter: 'all',
  searchQuery: '',
  currentClauseIndex: 0,
};

// ─── PAGE NAV ─────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) { page.classList.add('active'); state.currentPage = name; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeMobileMenu();
  triggerPageAnimations(name);
}

function triggerPageAnimations(name) {
  const page = document.getElementById('page-' + name);
  if (!page) return;
  page.querySelectorAll('.anim-fade-up, .anim-fade-in, .anim-slide-left, .anim-slide-right, .anim-scale-in, .anim-stagger-child').forEach(el => {
    el.style.animationPlayState = 'paused';
    void el.offsetWidth;
    el.style.animationPlayState = 'running';
  });
  // Animate counters on report page
  if (name === 'report') animateCounters();
}

// ─── MOBILE MENU ──────────────────────────────────────────────
function toggleMobileMenu() {
  const m = document.querySelector('.mobile-menu.active-menu');
  document.querySelectorAll('.mobile-menu').forEach(menu => {
    if (menu.closest(`#page-${state.currentPage}`)) {
      menu.classList.toggle('open');
    }
  });
}
function closeMobileMenu() {
  document.querySelectorAll('.mobile-menu').forEach(m => m.classList.remove('open'));
}

// ─── FILE UPLOAD ──────────────────────────────────────────────
function handleFileSelect(file) {
  if (!file) return;
  if (!/\.(pdf|doc|docx|txt)$/i.test(file.name)) {
    showToast('Unsupported file type. Use PDF, DOC, DOCX, or TXT.', 'error'); return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File exceeds 10MB limit.', 'error'); return;
  }

  state.documentName = file.name;
  setUploadLoading(true, file.name);

  window.LegalEaseAPI.analyzeDocument(file)
    .then(data => {
      state.documentId = data.document_id;
      state.clauses    = data.clauses;
      renderAnalysisPage();
      showPage('analysis');
      setUploadLoading(false);
      showToast(`"${file.name}" analyzed successfully. ${data.clauses.length} clauses detected.`, 'success');
    })
    .catch(err => {
      setUploadLoading(false);
      showToast('Analysis failed: ' + err.message, 'error');
    });
}

function setUploadLoading(loading, filename) {
  const btn = document.getElementById('upload-btn');
  const dz  = document.getElementById('drop-zone');
  if (loading) {
    if (btn) { btn.textContent = 'Analyzing...'; btn.disabled = true; }
    if (dz) dz.classList.add('loading');
    startProgressBar();
  } else {
    if (btn) { btn.innerHTML = '🔍 Upload &amp; Analyze Document'; btn.disabled = false; }
    if (dz) dz.classList.remove('loading');
    stopProgressBar();
  }
}

function startProgressBar() {
  const bar = document.getElementById('upload-progress-bar');
  if (!bar) return;
  bar.style.width = '0%';
  bar.parentElement.style.display = 'block';
  let w = 0;
  bar._interval = setInterval(() => {
    w = Math.min(w + Math.random() * 12, 88);
    bar.style.width = w + '%';
  }, 250);
}
function stopProgressBar() {
  const bar = document.getElementById('upload-progress-bar');
  if (!bar) return;
  clearInterval(bar._interval);
  bar.style.width = '100%';
  setTimeout(() => { bar.style.width = '0%'; bar.parentElement.style.display = 'none'; }, 400);
}

// ─── ANALYSIS RENDER ──────────────────────────────────────────
function renderAnalysisPage() {
  updateDocMeta();
  state.activeFilter = 'all';
  state.searchQuery  = '';
  state.currentClauseIndex = 0;
  const s = document.getElementById('clause-search');
  if (s) s.value = '';
  setActiveFilter('all', false);
  renderClauseList();
  renderAnalysisCards();
  renderReportTable();
}

function updateDocMeta() {
  const high = state.clauses.filter(c => c.risk === 'high').length;
  const med  = state.clauses.filter(c => c.risk === 'medium').length;
  const safe = state.clauses.filter(c => c.risk === 'safe').length;
  const name = state.documentName || 'Sample_Document.pdf';
  _set('doc-name-display', name);
  _set('doc-meta-display', `${state.clauses.length} clauses detected - ${high} high risk - ${med} medium risk`);
  _set('report-doc-name', name.replace(/\.[^.]+$/, '').replace(/_/g, ' '));
  _set('report-total',  state.clauses.length);
  _set('report-total-2',state.clauses.length);
  _set('report-high',   high);
  _set('report-med',    med);
  _set('report-safe',   safe);
  _set('report-date',   new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }));
}
function _set(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

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
    container.innerHTML = `<div class="empty-state"><div style="font-size:32px;margin-bottom:12px;">🔍</div>No clauses match your filter.</div>`;
    return;
  }
  filtered.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'clause-orig anim-fade-up' + (i === 0 ? ' selected' : '');
    el.style.animationDelay = `${i * 0.05}s`;
    el.dataset.clauseId = c.id;
    el.innerHTML = `
      <div class="clause-num">Clause ${String(c.id).padStart(2,'0')} · ${c.type}
        <span class="clause-risk-tag ${c.risk}">${RISK_LABELS[c.risk]}</span>
      </div>
      <div class="clause-text">${c.original}</div>`;
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
    card.className = 'analysis-card anim-fade-up';
    card.id = `card-${c.id}`;
    card.style.animationDelay = `${i * 0.08}s`;
    card.innerHTML = `
      <div class="ac-header ${c.risk}">
        <span class="risk-icon">${RISK_ICONS[c.risk]}</span>
        <span class="clause-type-label">${c.type}</span>
        <span class="risk-pill ${c.risk}">${RISK_LABELS[c.risk]}</span>
      </div>
      <div class="ac-body">
        <div class="urdu-explanation">
          <div class="urdu-tag">Urdu Explanation - اردو وضاحت</div>
          <div class="urdu-exp-text">${c.urdu}</div>
        </div>
        ${c.tooltip ? `<div class="risk-tooltip">${RISK_ICONS[c.risk]} <strong>Note:</strong> ${c.tooltip}</div>` : ''}
      </div>`;
    container.appendChild(card);
  });
}

function renderReportTable() {
  const tbody = document.getElementById('report-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.clauses.map(c => `
    <tr class="anim-fade-up">
      <td>${String(c.id).padStart(2,'0')}</td>
      <td>${c.type}</td>
      <td class="urdu-cell">${c.urdu.split('.')[0].trim()}.</td>
      <td><span class="risk-badge-sm ${c.risk}">${RISK_LABELS[c.risk]}</span></td>
    </tr>`).join('');
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
  state.currentClauseIndex = getFiltered().findIndex(c => c.id === id);
}

function selectClause(el) {
  document.querySelectorAll('.clause-orig').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

// ─── FILTER & SEARCH ──────────────────────────────────────────
function setActiveFilter(type, rerender = true) {
  state.activeFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('filter-' + type)?.classList.add('on');
  if (rerender) { renderClauseList(); renderAnalysisCards(); }
}

function handleSearch(e) {
  state.searchQuery = e.target.value.toLowerCase().trim();
  renderClauseList();
  renderAnalysisCards();
}

function navigateClause(dir) {
  const filtered = getFiltered();
  if (!filtered.length) return;
  state.currentClauseIndex = Math.max(0, Math.min(filtered.length - 1, state.currentClauseIndex + dir));
  const target = filtered[state.currentClauseIndex];
  const list = document.getElementById('clause-list');
  const el = list?.querySelector(`[data-clause-id="${target.id}"]`);
  selectClauseById(target.id, el);
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    </div>`);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const data = await window.LegalEaseAPI.askQuestion(q, state.documentId);
    document.getElementById(tid)?.remove();
    appendAIMsg(msgs, data.answer_en, data.answer_ur, data.source_clause);
  } catch (err) {
    document.getElementById(tid)?.remove();
    appendAIMsg(msgs, 'Connection error. Please try again.', 'رابطہ نہیں ہو سکا۔ دوبارہ کوشش کریں۔', null);
  }
}

function appendUserMsg(c, text) {
  c.insertAdjacentHTML('beforeend', `
    <div class="msg-wrap user anim-fade-up">
      <div class="msg-avatar user">👤</div>
      <div class="msg-bubble user">${text}</div>
    </div>`);
  c.scrollTop = c.scrollHeight;
}
function appendAIMsg(c, en, ur, source) {
  c.insertAdjacentHTML('beforeend', `
    <div class="msg-wrap anim-fade-up">
      <div class="msg-avatar ai">AI</div>
      <div class="msg-bubble ai">
        <strong>Based on your document:</strong> ${en}
        <div class="urdu-reply">${ur}</div>
        ${source ? `<div class="related-clause">📎 ${source}</div>` : ''}
      </div>
    </div>`);
  c.scrollTop = c.scrollHeight;
}

// ─── REPORT ───────────────────────────────────────────────────
async function triggerDownloadReport() {
  try {
    await window.LegalEaseAPI.downloadReport(state.documentId, state.documentName);
  } catch (err) {
    showToast('Download failed: ' + err.message, 'error');
  }
}

// ─── COUNTER ANIMATION ────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('.insight-num[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    let current = 0;
    const step = Math.ceil(target / 20);
    const iv = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(iv);
    }, 40);
  });
}

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container') || document.body;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-show'));
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 350); }, 3800);
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// ─── DROP ZONE ────────────────────────────────────────────────
function attachDropZone() {
  const dz = document.getElementById('drop-zone');
  const fi = document.getElementById('file-input');
  if (!dz) return;
  dz.addEventListener('click',     () => fi?.click());
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    handleFileSelect(e.dataTransfer.files[0]);
  });
  fi?.addEventListener('change', e => handleFileSelect(e.target.files[0]));
}

// ─── INTERSECTION OBSERVER (scroll-triggered anims) ───────────
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
}

// ─── INIT ─────────────────────────────────────────────────────
function initApp() {
  // Pre-load demo data so Demo nav works immediately
  state.clauses      = window.LegalEaseAPI ? [] : [];
  state.documentName = 'Rental_Agreement_Karachi_2024.pdf';
  state.documentId   = 'demo-preload';

  // Pre-render with demo data
  if (window.LegalEaseAPI) {
    window.LegalEaseAPI.analyzeDocument({ name: 'Rental_Agreement_Karachi_2024.pdf', size: 1000, type: 'application/pdf' })
      .then(data => {
        state.clauses     = data.clauses;
        state.documentId  = data.document_id;
        renderAnalysisPage();
      });
  }

  attachDropZone();

  document.getElementById('qa-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  document.getElementById('clause-search')?.addEventListener('input', handleSearch);

  const stb = document.getElementById('scroll-top-btn');
  if (stb) window.addEventListener('scroll', () => stb.classList.toggle('visible', window.scrollY > 400));

  document.addEventListener('click', e => {
    if (!e.target.closest('.mobile-menu') && !e.target.closest('.hamburger')) closeMobileMenu();
  });

  initScrollAnimations();

  // Start on home
  showPage('home');
}

// Globals
Object.assign(window, {
  showPage, selectClause, fillQuestion, sendMessage,
  setActiveFilter, navigateClause, handleSearch,
  triggerDownloadReport, toggleMobileMenu, scrollToTop, showToast, initApp,
});
