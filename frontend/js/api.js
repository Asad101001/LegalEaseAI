/**
 * ============================================================
 *  LegalEase AI - api.js
 *  Backend Integration Layer
 * ============================================================
 *
 *  This is the ONLY file the backend team needs to modify.
 *  All API calls from the frontend go through this file.
 *
 *  HOW TO USE:
 *  1. Set API_BASE_URL below to your deployed backend URL
 *  2. Implement each function to hit your real endpoints
 *  3. Keep the return shapes exactly as documented
 *  4. The frontend (app.js) will work automatically
 *
 *  CORS: Make sure your backend allows:
 *    - Origin: https://legalease-ai.vercel.app (and localhost)
 *    - Methods: GET, POST, OPTIONS
 *    - Headers: Content-Type
 * ============================================================
 */

'use strict';

// ─── CONFIGURATION ────────────────────────────────────────────
// Change this to your backend URL when deployed
const API_BASE_URL = window.LEGALEASE_API_URL || 'http://localhost:8000';

// Set to false to disable demo mode and use real API
const USE_DEMO_MODE = true;

// ─── DEMO DATA ────────────────────────────────────────────────
// Used when USE_DEMO_MODE = true. Remove once backend is ready.
const _DEMO_CLAUSES = [
  { id: 1, type: 'Termination', risk: 'high',
    original: '"The landlord reserves the right to terminate this agreement with 7 days written notice for any reason deemed appropriate by the landlord at their sole discretion."',
    urdu: 'مالک مکان بغیر کسی خاص وجہ کے صرف 7 دن کے نوٹس پر آپ کو گھر خالی کروا سکتا ہے۔ یہ آپ کے لیے انتہائی نقصان دہ ہے۔ دستخط سے پہلے اس شق پر مذاکرہ ضرور کریں۔',
    tooltip: 'Landlord can evict with only 7 days notice and no reason. Negotiate for minimum 60 days and specific valid conditions.' },
  { id: 2, type: 'Payment and Penalty', risk: 'medium',
    original: '"Late payment of monthly rent shall incur a financial penalty of five percent (5%) per week on the outstanding amount, compounded on a monthly basis."',
    urdu: 'اگر کرایہ دیر سے دیا تو ہر ہفتے 5 فیصد جرمانہ لگے گا جو ہر مہینے بڑھتا رہے گا۔ ایک مہینے کی تاخیر بھی بڑی رقم بن سکتی ہے۔',
    tooltip: '5% weekly compounding penalty. One missed month could cost 20%+ extra. Set a payment reminder.' },
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
//  Called when user uploads a file.
// ═══════════════════════════════════════════════════════════════
/**
 * @param {File} file - The uploaded file object
 * @returns {Promise<Object>} - See shape below
 *
 * Expected return shape:
 * {
 *   document_id: "string",        // unique ID for this session
 *   document_name: "string",      // original filename
 *   clauses: [
 *     {
 *       id: Number,               // clause number (1, 2, 3...)
 *       type: "string",           // e.g. "Termination", "Penalty"
 *       risk: "high"|"medium"|"safe",
 *       original: "string",       // raw clause text from document
 *       urdu: "string",           // Urdu explanation from LLM
 *       tooltip: "string"|null,   // English risk tip (or null if safe)
 *     }
 *   ]
 * }
 *
 * Backend steps:
 *   1. Accept file via multipart/form-data
 *   2. Extract text: pdfplumber (PDF), python-docx (DOCX), open() (TXT)
 *   3. Split into clauses using LangChain RecursiveCharacterTextSplitter
 *   4. Store chunks in FAISS with sentence-transformers embeddings
 *   5. For each chunk: classify risk type using keyword matching or LLM
 *   6. Generate Urdu explanation via LLM (GPT/Gemini) with prompt:
 *      "Explain this legal clause in simple Urdu for a Pakistani citizen: {clause}"
 *   7. Return structured JSON
 */
async function analyzeDocument(file) {
  if (USE_DEMO_MODE) {
    // Simulate network delay
    await _sleep(2000);
    return {
      document_id: 'demo-' + Date.now(),
      document_name: file.name,
      clauses: _DEMO_CLAUSES,
    };
  }

  // ── REAL IMPLEMENTATION (uncomment when backend is ready) ──
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type header - browser sets it with boundary automatically
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Analysis failed: ${err}`);
  }

  return await response.json();
}

// ═══════════════════════════════════════════════════════════════
//  API FUNCTION 2: askQuestion
//  Called when user sends a message in Q&A.
// ═══════════════════════════════════════════════════════════════
/**
 * @param {string} question - User's question (Urdu or English)
 * @param {string} documentId - From analyzeDocument response
 * @returns {Promise<Object>} - See shape below
 *
 * Expected return shape:
 * {
 *   answer_en: "string",          // English answer
 *   answer_ur: "string",          // Urdu answer
 *   source_clause: "string",      // e.g. "Clause 02 - Payment and Penalty"
 *   confidence: Number,           // 0.0 to 1.0 (optional)
 * }
 *
 * Backend steps:
 *   1. Embed the question with same model used for document chunks
 *   2. FAISS similarity_search(question_embedding, k=3)
 *   3. Build prompt: "Given these clauses: {chunks}\nAnswer: {question}\nAlso provide Urdu translation."
 *   4. Call LLM, parse response into English + Urdu parts
 *   5. Return JSON
 */
async function askQuestion(question, documentId) {
  if (USE_DEMO_MODE) {
    await _sleep(1100);
    return {
      answer_en: 'Based on your document, this relates to the rental clauses analyzed. Once the AI backend is connected it will search the FAISS index for relevant sections and give a precise, document-grounded answer.',
      answer_ur: 'آپ کے سوال کا جواب آپ کے دستاویز کی بنیاد پر دیا جائے گا۔ بیک اینڈ کنیکٹ ہونے کے بعد FAISS سے متعلقہ شق تلاش کر کے اردو میں مکمل جواب ملے گا۔',
      source_clause: 'Retrieved from document via FAISS vector search',
      confidence: 0.91,
    };
  }

  // ── REAL IMPLEMENTATION ──
  const response = await fetch(`${API_BASE_URL}/api/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, document_id: documentId }),
  });

  if (!response.ok) throw new Error('Question failed: ' + await response.text());
  return await response.json();
}

// ═══════════════════════════════════════════════════════════════
//  API FUNCTION 3: downloadReport
//  Called when user clicks Download PDF.
// ═══════════════════════════════════════════════════════════════
/**
 * @param {string} documentId - From analyzeDocument response
 * @param {string} documentName - For the downloaded filename
 *
 * Backend steps:
 *   1. Retrieve stored clause analysis for this document_id
 *   2. Generate PDF using ReportLab or WeasyPrint:
 *      - Header: document name, date, LegalEase AI branding
 *      - Risk summary table (clause, type, risk level, Urdu explanation)
 *      - Color-coded rows (red/yellow/green)
 *      - Urdu text using a Nastaliq-compatible font
 *   3. Return PDF as binary response with Content-Type: application/pdf
 */
async function downloadReport(documentId, documentName) {
  if (USE_DEMO_MODE) {
    _showToast('PDF generation requires backend. Coming soon!', 'info');
    return;
  }

  // ── REAL IMPLEMENTATION ──
  const response = await fetch(`${API_BASE_URL}/api/report/${documentId}`);
  if (!response.ok) throw new Error('Report failed');

  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `LegalEase_Report_${documentName || 'document'}.pdf`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── INTERNAL HELPERS ─────────────────────────────────────────
function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function _showToast(msg, type) {
  if (typeof showToast === 'function') showToast(msg, type);
  else console.log(`[${type}] ${msg}`);
}

// Expose for app.js
window.LegalEaseAPI = { analyzeDocument, askQuestion, downloadReport, USE_DEMO_MODE, API_BASE_URL };
