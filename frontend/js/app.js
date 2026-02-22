/**
 * app.js - LegalEase AI Frontend Logic
 *
 * KEY FIXES:
 * 1. initApp() restores sessionStorage FIRST, then stops - does NOT wipe state afterwards
 * 2. Demo mode preloads only when no real document is present
 * 3. Q&A sendMessage guard fixed
 * 4. clearQAMessages() removes hardcoded demo messages on real upload
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
  page.querySelectorAll('.anim-fade-up,.anim-fade-in,.anim-slide-left,.anim-slide-right,.anim-scale-in')
    .forEach(el => {
      el.style.animationPlayState = 'paused';
      void el.offsetWidth;
      el.style.animationPlayState = 'running';
    });
  if (name === 'report') animateCounters();
}

// ─── MOBILE MENU ──────────────────────────────────────────────
function toggleMobileMenu() {
  document.querySelectorAll('.mobile-menu').forEach(menu => {
    if (menu.closest('#page-' + state.currentPage)) menu.classList.toggle('open');
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

  setUploadLoading(true);

  window.LegalEaseAPI.analyzeDocument(file)
    .then(data => {
      state.documentId   = data.document_id;
      state.documentName = data.document_name || file.name;
      state.clauses      = data.clauses || [];

      // Persist to sessionStorage
      try {
        sessionStorage.setItem('legalease_state', JSON.stringify({
          documentId:   state.documentId,
          documentName: state.documentName,
          clauses:      state.clauses,
        }));
      } catch(e) {}

      renderAnalysisPage();
      syncQASidebar();
      clearQAMessages();
      setUploadLoading(false);
      showPage('analysis');
      showToast('"' + state.documentName + '" analyzed — ' + state.clauses.length + ' clauses found.', 'success');
    })
    .catch(err => {
      setUploadLoading(false);
      showToast('Analysis failed: ' + (err.message || 'Unknown error'), 'error');
      console.error('[handleFileSelect]', err);
    });
}

function setUploadLoading(loading) {
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
    w = Math.min(w + Math.random() * 10, 88);
    bar.style.width = w + '%';
  }, 300);
}
function stopProgressBar() {
  const bar = document.getElementById('upload-progress-bar');
  if (!bar) return;
  clearInterval(bar._interval);
  bar.style.width = '100%';
  setTimeout(() => { bar.style.width = '0%'; bar.parentElement.style.display = 'none'; }, 500);
}

// ─── ANALYSIS RENDER ──────────────────────────────────────────
function renderAnalysisPage() {
  updateDocMeta();
  state.activeFilter       = 'all';
  state.searchQuery        = '';
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
  const name = state.documentName || 'Document';
  _set('doc-name-display', name);
  _set('doc-meta-display', state.clauses.length + ' clauses · ' + high + ' high risk · ' + med + ' medium risk');
  _set('report-doc-name',  name.replace(/\.[^.]+$/, '').replace(/_/g, ' '));
  _set('report-total',     state.clauses.length);
  _set('report-total-2',   state.clauses.length);
  _set('report-high',      high);
  _set('report-med',       med);
  _set('report-safe',      safe);
  _set('report-date',      new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }));
  ['report-total-2','report-high','report-med','report-safe'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.dataset.target = el.textContent;
  });
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
    container.innerHTML = '<div class="empty-state"><div style="font-size:32px;margin-bottom:12px">🔍</div>No clauses match your filter.</div>';
    return;
  }
  filtered.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'clause-orig anim-fade-up' + (i === 0 ? ' selected' : '');
    el.style.animationDelay = (i * 0.05) + 's';
    el.dataset.clauseId = c.id;
    el.innerHTML =
      '<div class="clause-num">Clause ' + String(c.id).padStart(2,'0') + ' · ' + c.type +
        '<span class="clause-risk-tag ' + c.risk + '">' + RISK_LABELS[c.risk] + '</span>' +
      '</div>' +
      '<div class="clause-text">' + c.original + '</div>';
    el.addEventListener('click', (function(clauseId, elem){ return function(){ selectClauseById(clauseId, elem); }; })(c.id, el));
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
    card.id = 'card-' + c.id;
    card.style.animationDelay = (i * 0.08) + 's';
    card.innerHTML =
      '<div class="ac-header ' + c.risk + '">' +
        '<span class="risk-icon">' + RISK_ICONS[c.risk] + '</span>' +
        '<span class="clause-type-label">' + c.type + '</span>' +
        '<span class="risk-pill ' + c.risk + '">' + RISK_LABELS[c.risk] + '</span>' +
      '</div>' +
      '<div class="ac-body">' +
        '<div class="urdu-explanation">' +
          '<div class="urdu-tag">Urdu Explanation — اردو وضاحت</div>' +
          '<div class="urdu-exp-text">' + c.urdu + '</div>' +
        '</div>' +
        (c.tooltip ? '<div class="risk-tooltip">' + RISK_ICONS[c.risk] + ' <strong>Note:</strong> ' + c.tooltip + '</div>' : '') +
      '</div>';
    container.appendChild(card);
  });
}

function renderReportTable() {
  const tbody = document.getElementById('report-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.clauses.map(c =>
    '<tr class="anim-fade-up">' +
      '<td>' + String(c.id).padStart(2,'0') + '</td>' +
      '<td>' + c.type + '</td>' +
      '<td class="urdu-cell">' + (c.urdu ? c.urdu.split('.')[0].trim() + '.' : '-') + '</td>' +
      '<td><span class="risk-badge-sm ' + c.risk + '">' + RISK_LABELS[c.risk] + '</span></td>' +
    '</tr>'
  ).join('');
}

function selectClauseById(id, el) {
  document.querySelectorAll('.clause-orig').forEach(c => c.classList.remove('selected'));
  if (el) el.classList.add('selected');
  const card = document.getElementById('card-' + id);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card.classList.add('card-highlight');
    setTimeout(function(){ card.classList.remove('card-highlight'); }, 900);
  }
  state.currentClauseIndex = getFiltered().findIndex(c => c.id === id);
}

function selectClause(el) {
  document.querySelectorAll('.clause-orig').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

// ─── Q&A SIDEBAR SYNC ─────────────────────────────────────────
function syncQASidebar() {
  const high = state.clauses.filter(c => c.risk === 'high').length;
  const med  = state.clauses.filter(c => c.risk === 'medium').length;
  const nameEl = document.getElementById('qa-doc-name-live');
  const statEl = document.getElementById('qa-doc-stat-live');
  if (nameEl) nameEl.textContent = state.documentName || 'Document';
  if (statEl) statEl.textContent = state.clauses.length + ' clauses · ' + high + ' high risk · ' + med + ' medium';
}

function clearQAMessages() {
  const msgs = document.getElementById('qa-messages');
  if (msgs) msgs.innerHTML = '';
}

// ─── FILTER & SEARCH ──────────────────────────────────────────
function setActiveFilter(type, rerender) {
  if (rerender === undefined) rerender = true;
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

function navigateClause(dir) {
  const filtered = getFiltered();
  if (!filtered.length) return;
  state.currentClauseIndex = Math.max(0, Math.min(filtered.length - 1, state.currentClauseIndex + dir));
  const target = filtered[state.currentClauseIndex];
  const list = document.getElementById('clause-list');
  const el = list ? list.querySelector('[data-clause-id="' + target.id + '"]') : null;
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
  const q = input ? input.value.trim() : '';
  if (!q) return;

  if (!state.documentId) {
    showToast('Please upload a document first, then ask questions.', 'error');
    return;
  }

  const msgs = document.getElementById('qa-messages');
  if (!msgs) return;

  appendUserMsg(msgs, q);
  if (input) input.value = '';

  const tid = 'typing-' + Date.now();
  msgs.insertAdjacentHTML('beforeend',
    '<div class="msg-wrap" id="' + tid + '">' +
      '<div class="msg-avatar ai">AI</div>' +
      '<div class="msg-bubble ai typing-dots"><span></span><span></span><span></span></div>' +
    '</div>');
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const data = await window.LegalEaseAPI.askQuestion(q, state.documentId);
    const typingEl = document.getElementById(tid);
    if (typingEl) typingEl.remove();
    appendAIMsg(msgs, data.answer_en, data.answer_ur, data.source_clause);
  } catch (err) {
    const typingEl = document.getElementById(tid);
    if (typingEl) typingEl.remove();
    appendAIMsg(msgs,
      'Could not get answer: ' + (err.message || 'Unknown error'),
      'جواب حاصل نہیں ہو سکا۔ دوبارہ کوشش کریں۔',
      null
    );
    console.error('[sendMessage]', err);
  }
}

function appendUserMsg(c, text) {
  c.insertAdjacentHTML('beforeend',
    '<div class="msg-wrap user anim-fade-up">' +
      '<div class="msg-avatar user">👤</div>' +
      '<div class="msg-bubble user">' + text + '</div>' +
    '</div>');
  c.scrollTop = c.scrollHeight;
}
function appendAIMsg(c, en, ur, source) {
  c.insertAdjacentHTML('beforeend',
    '<div class="msg-wrap anim-fade-up">' +
      '<div class="msg-avatar ai">AI</div>' +
      '<div class="msg-bubble ai">' +
        '<strong>Based on your document:</strong> ' + en +
        (ur ? '<div class="urdu-reply">' + ur + '</div>' : '') +
        (source ? '<div class="related-clause">📎 ' + source + '</div>' : '') +
      '</div>' +
    '</div>');
  c.scrollTop = c.scrollHeight;
}

// ─── REPORT ───────────────────────────────────────────────────
async function triggerDownloadReport() {
  if (!state.documentId) {
    showToast('Please upload a document first.', 'error');
    return;
  }
  try {
    showToast('Generating PDF report...', 'info');
    await window.LegalEaseAPI.downloadReport(state.documentId, state.documentName);
  } catch (err) {
    showToast('Download failed: ' + (err.message || 'Unknown error'), 'error');
  }
}

// ─── COUNTER ANIMATION ────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('.insight-num[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target, 10) || 0;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 20));
    const iv = setInterval(function() {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(iv);
    }, 40);
  });
}

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg, type) {
  if (!type) type = 'info';
  const container = document.getElementById('toast-container') || document.body;
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(function(){ t.classList.add('toast-show'); });
  setTimeout(function(){ t.classList.remove('toast-show'); setTimeout(function(){ t.remove(); }, 350); }, 3800);
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// ─── DROP ZONE ────────────────────────────────────────────────
function attachDropZone() {
  const dz = document.getElementById('drop-zone');
  const fi = document.getElementById('file-input');
  if (!dz) return;
  dz.addEventListener('click',     function(){ if (fi) fi.click(); });
  dz.addEventListener('dragover',  function(e){ e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', function(){ dz.classList.remove('dragover'); });
  dz.addEventListener('drop', function(e) {
    e.preventDefault(); dz.classList.remove('dragover');
    handleFileSelect(e.dataTransfer.files[0]);
  });
  if (fi) {
    fi.addEventListener('change', function(e) {
      handleFileSelect(e.target.files[0]);
      e.target.value = '';
    });
  }
}

// ─── SCROLL ANIMATIONS ────────────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.scroll-reveal').forEach(function(el){ observer.observe(el); });
}

// ─── INIT ─────────────────────────────────────────────────────
function initApp() {

  // ── STEP 1: Restore from sessionStorage ──────────────────────
  // This must happen first and must NOT be overwritten afterwards.
  let hasData = false;
  try {
    const saved = sessionStorage.getItem('legalease_state');
    if (saved) {
      const s = JSON.parse(saved);
      if (s && s.clauses && s.clauses.length > 0 && s.documentId) {
        state.documentId   = s.documentId;
        state.documentName = s.documentName;
        state.clauses      = s.clauses;
        hasData = true;
      }
    }
  } catch(e) {
    console.warn('[initApp] sessionStorage restore failed:', e);
  }

  // ── STEP 2: If we have real data, render it ───────────────────
  if (hasData) {
    renderAnalysisPage();
    syncQASidebar();
  }

  // ── STEP 3: Demo mode - only if no real document loaded ───────
  if (!hasData && window.LegalEaseAPI && window.LegalEaseAPI.USE_DEMO_MODE === true) {
    window.LegalEaseAPI.analyzeDocument({
      name: 'Rental_Agreement_Karachi_2024.pdf',
      size: 1000,
      type: 'application/pdf'
    })
    .then(function(data) {
      state.clauses      = data.clauses;
      state.documentId   = data.document_id;
      state.documentName = data.document_name;
      renderAnalysisPage();
      syncQASidebar();
    })
    .catch(function(err){ console.warn('[initApp demo preload]', err); });
  }

  // ── STEP 4: Wire DOM events ───────────────────────────────────
  attachDropZone();

  const qaInput = document.getElementById('qa-input');
  if (qaInput) {
    qaInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  const search = document.getElementById('clause-search');
  if (search) search.addEventListener('input', handleSearch);

  const stb = document.getElementById('scroll-top-btn');
  if (stb) window.addEventListener('scroll', function(){ stb.classList.toggle('visible', window.scrollY > 400); });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.mobile-menu') && !e.target.closest('.hamburger')) closeMobileMenu();
  });

  initScrollAnimations();
  showPage(hasData ? 'analysis' : 'home');
}

// ─── GLOBALS ──────────────────────────────────────────────────
window.showPage             = showPage;
window.selectClause         = selectClause;
window.fillQuestion         = fillQuestion;
window.sendMessage          = sendMessage;
window.setActiveFilter      = setActiveFilter;
window.navigateClause       = navigateClause;
window.handleSearch         = handleSearch;
window.triggerDownloadReport= triggerDownloadReport;
window.toggleMobileMenu     = toggleMobileMenu;
window.scrollToTop          = scrollToTop;
window.showToast            = showToast;
window.initApp              = initApp;