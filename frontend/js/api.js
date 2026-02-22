/**
 * ============================================================
 *  LegalEase AI - api.js  (FIXED)
 *  Backend Integration Layer
 * ============================================================
 *  CHANGES FROM PREVIOUS VERSION:
 *  1. USE_DEMO_MODE = false  (connect to real backend)
 *  2. analyzeDocument demo branch now checks file.name safely
 *     so fake startup calls don't hit the real API
 *  3. USE_DEMO_MODE exposed on window.LegalEaseAPI so app.js
 *     can read it in initApp()
 * ============================================================
 */

'use strict';

// ─── CONFIGURATION ────────────────────────────────────────────
const API_BASE_URL = window.LEGALEASE_API_URL || 'http://localhost:8000';

// *** CHANGE THIS TO false TO USE REAL BACKEND ***
const USE_DEMO_MODE = false;

// ─── DEMO DATA ────────────────────────────────────────────────
const _DEMO_CLAUSES = [
  { id: 1, type: 'Termination', risk: 'high',
    original: '"The landlord reserves the right to terminate this agreement with 7 days written notice for any reason deemed appropriate by the landlord at their sole discretion."',
    urdu: 'مالک مکان بغیر کسی خاص وجہ کے صرف 7 دن کے نوٹس پر آپ کو گھر خالی کروا سکتا ہے۔ یہ آپ کے لیے انتہائی نقصان دہ ہے۔ دستخط سے پہلے اس شق پر مذاکرہ ضرور کریں۔',
    tooltip: 'Landlord can evict with only 7 days notice and no reason. Negotiate for minimum 60 days.' },
  { id: 2, type: 'Payment and Penalty', risk: 'medium',
    original: '"Late payment of monthly rent shall incur a financial penalty of five percent (5%) per week on the outstanding amount, compounded on a monthly basis."',
    urdu: 'اگر کرایہ دیر سے دیا تو ہر ہفتے 5 فیصد جرمانہ لگے گا جو ہر مہینے بڑھتا رہے گا۔ ایک مہینے کی تاخیر بھی بڑی رقم بن سکتی ہے۔',
    tooltip: '5% weekly compounding penalty. One missed month could cost 20%+ extra.' },
  { id: 3, type: 'Maintenance', risk: 'safe',
    original: '"The landlord shall remain solely responsible for all structural repairs and general maintenance where the cost thereof exceeds Pakistani Rupees Ten Thousand (PKR 10,000)."',
    urdu: '10,000 روپے سے اوپر کی تمام مرمت مالک مکان کی ذمہ داری ہے۔ یہ آپ کے لیے بالکل فائدہ مند شق ہے۔',
    tooltip: null },
  { id: 4, type: 'Arbitration', risk: 'high',
    original: '"Any disputes arising under this agreement shall be submitted exclusively to binding arbitration. The tenant hereby waives the right to pursue matters through civil courts of law."',
    urdu: 'اگر کوئی تنازعہ ہو تو آپ عدالت نہیں جا سکتے، صرف ثالثی کا راستہ ہے۔ یہ عام طور پر مالک مکان کے حق میں ہوتا ہے۔',
    tooltip: 'You give up your right to civil court. Try to remove this clause entirely.' },
  { id: 5, type: 'Liability Waiver', risk: 'high',
    original: '"The landlord shall not be held liable for any damages to the tenant\'s personal property arising from structural defects, water leaks, electrical failures, or utility disruptions."',
    urdu: 'اگر گھر کی خرابی کی وجہ سے آپ کا کوئی سامان تباہ ہو تو مالک مکان ذمہ دار نہیں ہوگا۔ رہائش سے پہلے مکمل معائنہ کریں۔',
    tooltip: 'Landlord escapes all liability. Document move-in condition with timestamped photos.' },
  { id: 6, type: 'Rent Increase', risk: 'medium',
    original: '"The landlord reserves the right to increase the monthly rent by up to fifteen percent (15%) annually, with thirty (30) days advance written notice to the tenant."',
    urdu: 'مالک مکان ہر سال 15 فیصد تک کرایہ بڑھا سکتا ہے۔ 2 سال میں کرایہ کافی بڑھ سکتا ہے، پہلے سے بجٹ بنائیں۔',
    tooltip: '15% annual increase means rent grows ~32% over 2 years. Negotiate a cap at 8-10%.' },
  { id: 7, type: 'Subletting', risk: 'safe',
    original: '"The tenant is strictly prohibited from subletting or sharing the premises with any third party without obtaining prior written consent from the landlord."',
    urdu: 'بغیر مالک مکان کی تحریری اجازت کے آپ گھر کسی کو نہیں دے سکتے۔ یہ ایک معیاری اور قابل قبول شق ہے۔',
    tooltip: null },
  { id: 8, type: 'Security Deposit', risk: 'safe',
    original: '"A security deposit equivalent to two (2) months rent shall be retained by the landlord and returned within sixty (60) days of vacating, subject to deductions for damages."',
    urdu: 'دو مہینے کا ڈپازٹ واپس کرنے کے لیے 60 دن دیے گئے ہیں۔ جاتے وقت گھر کی حالت کی تصویریں ضرور لیں۔',
    tooltip: null },
];

// ═══════════════════════════════════════════════════════════════
//  API FUNCTION 1: analyzeDocument
// ═══════════════════════════════════════════════════════════════
async function analyzeDocument(file) {
  // Demo mode: only works if it's a real File object with a name
  if (USE_DEMO_MODE) {
    await _sleep(2000);
    return {
      document_id: 'demo-' + Date.now(),
      document_name: file.name || 'demo-document.pdf',
      clauses: _DEMO_CLAUSES,
    };
  }

  // Real backend: file MUST be a proper File object
  if (!(file instanceof File)) {
    throw new Error('analyzeDocument requires a real File object');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type - browser sets it with correct boundary
  });

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try { const e = await response.json(); errMsg = e.detail || JSON.stringify(e); } catch {}
    throw new Error(errMsg);
  }

  return await response.json();
}

// ═══════════════════════════════════════════════════════════════
//  API FUNCTION 2: askQuestion
// ═══════════════════════════════════════════════════════════════
async function askQuestion(question, documentId) {
  if (USE_DEMO_MODE) {
    await _sleep(1100);
    return {
      answer_en: 'Demo mode is active. Connect the backend to get real answers from your document.',
      answer_ur: 'ڈیمو موڈ فعال ہے۔ بیک اینڈ کنیکٹ ہونے کے بعد آپ کے دستاویز سے اصل جواب ملے گا۔',
      source_clause: 'Demo response',
      confidence: 0.91,
    };
  }

  if (!documentId) {
    throw new Error('No document loaded. Please upload a document first.');
  }

  const response = await fetch(`${API_BASE_URL}/api/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, document_id: documentId }),
  });

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try { const e = await response.json(); errMsg = e.detail || JSON.stringify(e); } catch {}
    throw new Error(errMsg);
  }

  return await response.json();
}

// ═══════════════════════════════════════════════════════════════
//  API FUNCTION 3: downloadReport
// ═══════════════════════════════════════════════════════════════
async function downloadReport(documentId, documentName) {
  if (USE_DEMO_MODE) {
    if (typeof showToast === 'function') showToast('PDF download requires real backend. Upload a document first.', 'info');
    return;
  }

  if (!documentId) {
    throw new Error('No document loaded.');
  }

  const response = await fetch(`${API_BASE_URL}/api/report/${documentId}`);
  if (!response.ok) throw new Error('Report generation failed: ' + response.status);

  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `LegalEase_Report_${(documentName || 'document').replace(/\.[^.]+$/, '')}.pdf`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── HELPERS ──────────────────────────────────────────────────
function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Expose everything for app.js
window.LegalEaseAPI = {
  analyzeDocument,
  askQuestion,
  downloadReport,
  USE_DEMO_MODE,
  API_BASE_URL,
};