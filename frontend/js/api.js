/**
 * ============================================================
 *  LegalEase AI - api.js
 *
 *  USE_DEMO_MODE = true  → Full working demo (no backend needed)
 *                          Q&A answers intelligently, report shows
 *  USE_DEMO_MODE = false → Real FastAPI backend at localhost:8000
 * ============================================================
 */
'use strict';

const API_BASE_URL = window.LEGALEASE_API_URL || 'https://legalease-backend-iovp.onrender.com';
const USE_DEMO_MODE = false; // ← set true for demo fallback

const _DEMO_CLAUSES = [
  { id:1, type:'Termination', risk:'high',
    original:'The landlord reserves the right to terminate this agreement with 7 days written notice for any reason deemed appropriate by the landlord at their sole discretion.',
    urdu:'مالک مکان بغیر کسی خاص وجہ کے صرف 7 دن کے نوٹس پر آپ کو گھر خالی کروا سکتا ہے۔ یہ آپ کے لیے انتہائی نقصان دہ ہے۔ دستخط سے پہلے اس شق پر مذاکرہ ضرور کریں۔',
    tooltip:'Landlord can evict with only 7 days notice. Negotiate for minimum 60 days.' },
  { id:2, type:'Payment and Penalty', risk:'medium',
    original:'Late payment of monthly rent shall incur a financial penalty of five percent (5%) per week on the outstanding amount, compounded on a monthly basis.',
    urdu:'اگر کرایہ دیر سے دیا تو ہر ہفتے 5 فیصد جرمانہ لگے گا۔ ایک مہینے کی تاخیر بھی بڑی رقم بن سکتی ہے۔',
    tooltip:'5% weekly penalty compounded monthly. One missed month could cost 20%+ extra.' },
  { id:3, type:'Maintenance', risk:'safe',
    original:'The landlord shall remain solely responsible for all structural repairs and general maintenance where the cost thereof exceeds Pakistani Rupees Ten Thousand (PKR 10,000).',
    urdu:'10,000 روپے سے اوپر کی تمام مرمت مالک مکان کی ذمہ داری ہے۔ یہ آپ کے لیے فائدہ مند شق ہے۔',
    tooltip:null },
  { id:4, type:'Arbitration', risk:'high',
    original:'Any disputes arising under this agreement shall be submitted exclusively to binding arbitration. The tenant hereby waives the right to pursue matters through civil courts of law.',
    urdu:'اگر کوئی تنازعہ ہو تو آپ عدالت نہیں جا سکتے۔ یہ عام طور پر مالک مکان کے حق میں ہوتا ہے۔',
    tooltip:'You give up your right to civil court. Try to remove this clause entirely.' },
  { id:5, type:'Liability Waiver', risk:'high',
    original:'The landlord shall not be held liable for any damages to the tenant\'s personal property arising from structural defects, water leaks, electrical failures, or utility disruptions.',
    urdu:'اگر گھر کی خرابی سے سامان تباہ ہو تو مالک مکان ذمہ دار نہیں ہوگا۔ رہائش سے پہلے مکمل معائنہ کریں۔',
    tooltip:'Landlord escapes all liability. Document move-in condition with timestamped photos.' },
  { id:6, type:'Rent Increase', risk:'medium',
    original:'The landlord reserves the right to increase the monthly rent by up to fifteen percent (15%) annually, with thirty (30) days advance written notice to the tenant.',
    urdu:'مالک مکان ہر سال 15 فیصد تک کرایہ بڑھا سکتا ہے۔ 2 سال میں کرایہ 32 فیصد بڑھ سکتا ہے۔',
    tooltip:'15% annually means rent grows ~32% over 2 years. Negotiate a cap at 8-10%.' },
  { id:7, type:'Subletting', risk:'safe',
    original:'The tenant is strictly prohibited from subletting or sharing the premises with any third party without obtaining prior written consent from the landlord.',
    urdu:'بغیر مالک مکان کی تحریری اجازت کے آپ گھر کسی کو نہیں دے سکتے۔ یہ معیاری شق ہے۔',
    tooltip:null },
  { id:8, type:'Security Deposit', risk:'safe',
    original:'A security deposit equivalent to two (2) months rent shall be retained by the landlord and returned within sixty (60) days of vacating, subject to deductions for damages.',
    urdu:'دو مہینے کا ڈپازٹ واپسی کے 60 دن بعد ملے گا۔ جاتے وقت گھر کی حالت کی تصویریں ضرور لیں۔',
    tooltip:null },
];

function _demoAnswer(q) {
  const ql = q.toLowerCase();
  if (ql.includes('late')||ql.includes('penalty')||ql.includes('جرمانہ'))
    return {en:'If you pay rent late, a 5% weekly penalty is charged, compounded monthly. One month late can cost 20%+ more.',ur:'اگر آپ نے کرایہ وقت پر نہیں دیا تو ہر ہفتے 5 فیصد جرمانہ لگے گا۔ ادائیگی میں تاخیر بڑی رقم بن سکتی ہے۔',src:'Clause 02 — Payment and Penalty'};
  if (ql.includes('evict')||ql.includes('terminate')||ql.includes('نکال'))
    return {en:'Yes — the landlord can evict with only 7 days notice and no stated reason. This is a High Risk clause.',ur:'ہاں، مالک مکان صرف 7 دن کے نوٹس پر بغیر وجہ بتائے آپ کو گھر خالی کروا سکتا ہے۔',src:'Clause 01 — Termination'};
  if (ql.includes('deposit')||ql.includes('واپس')||ql.includes('ڈپازٹ'))
    return {en:'The security deposit is 2 months rent, returned within 60 days of vacating minus any damage deductions.',ur:'دو مہینے کا ڈپازٹ واپسی کے 60 دن بعد ملے گا۔ جاتے وقت گھر کی تصویریں ضرور لیں۔',src:'Clause 08 — Security Deposit'};
  if (ql.includes('court')||ql.includes('arbitration')||ql.includes('عدالت'))
    return {en:'You have waived your right to civil court. All disputes go to binding arbitration, which usually favors the landlord.',ur:'آپ عدالت نہیں جا سکتے۔ صرف ثالثی کا راستہ ہے جو مالک مکان کے حق میں ہوتا ہے۔',src:'Clause 04 — Arbitration'};
  if (ql.includes('rent')||ql.includes('increase')||ql.includes('کرایہ'))
    return {en:'Rent can be increased up to 15% annually with 30 days notice. Over 2 years that is roughly 32% more.',ur:'مالک مکان ہر سال 15 فیصد تک کرایہ بڑھا سکتا ہے۔ پہلے سے بجٹ بنائیں۔',src:'Clause 06 — Rent Increase'};
  if (ql.includes('safe')||ql.includes('dangerous')||ql.includes('خطرناک')||ql.includes('محفوظ'))
    return {en:'Most dangerous: Termination (7 days), Arbitration (no court), Liability Waiver. Safe: Maintenance, Subletting, Security Deposit.',ur:'سب سے خطرناک: فسخ معاہدہ، ثالثی، ذمہ داری سے چھٹکارا۔ محفوظ: مرمت، ذیلی کرایہ، اور ڈپازٹ۔',src:'Overall Document Analysis'};
  return {en:'Based on the document: it contains 3 high risk, 2 medium risk, and 3 safe clauses. Review carefully before signing.',ur:'اس دستاویز میں 3 خطرناک، 2 درمیانی، اور 3 محفوظ شقیں ہیں۔ دستخط سے پہلے غور سے پڑھیں۔',src:'General Analysis'};
}

async function analyzeDocument(file) {
  if (USE_DEMO_MODE) {
    await _sleep(1800);
    return {
      document_id:   'demo-'+Date.now(),
      document_name: (file&&file.name)?file.name:'Rental_Agreement_Karachi_2024.pdf',
      clauses:       _DEMO_CLAUSES,
      summary:{total_clauses:8,high_risk:3,medium_risk:2,safe_risk:3},
    };
  }
  if (!(file instanceof File)) throw new Error('analyzeDocument requires a real File object in live mode');
  const formData = new FormData();
  formData.append('file', file);
  let response;
  try { response = await fetch(API_BASE_URL+'/api/analyze',{method:'POST',body:formData}); }
  catch(e){ throw new Error('Cannot reach backend at '+API_BASE_URL+' — is it running? ('+e.message+')'); }
  if (!response.ok) {
    let msg='HTTP '+response.status;
    try{const j=await response.json();msg=j.detail||j.message||msg;}catch(e2){}
    throw new Error(msg);
  }
  return await response.json();
}

async function askQuestion(question, documentId) {
  if (USE_DEMO_MODE) {
    await _sleep(900);
    const a=_demoAnswer(question);
    return {answer_en:a.en,answer_ur:a.ur,source_clause:a.src,confidence:0.91};
  }
  if (!documentId) throw new Error('No document loaded. Upload a document first.');
  let response;
  try { response = await fetch(API_BASE_URL+'/api/qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:question,document_id:documentId})}); }
  catch(e){ throw new Error('Cannot reach backend. Is it running? ('+e.message+')'); }
  if (!response.ok) {
    let msg='HTTP '+response.status;
    try{const j=await response.json();msg=j.detail||j.message||msg;}catch(e2){}
    throw new Error(msg);
  }
  return await response.json();
}

async function downloadReport(documentId, documentName) {
  if (USE_DEMO_MODE) {
    if (typeof showToast==='function') showToast('PDF download needs real backend. Set USE_DEMO_MODE = false and upload a real document.','info');
    return;
  }
  if (!documentId) throw new Error('No document loaded.');
  let response;
  try { response = await fetch(API_BASE_URL+'/api/report/'+documentId); }
  catch(e){ throw new Error('Cannot reach backend. ('+e.message+')'); }
  if (!response.ok) throw new Error('Report failed: '+response.status);
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='LegalEase_Report_'+((documentName||'document').replace(/\.[^.]+$/, ''))+'.pdf';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function _sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}

window.LegalEaseAPI={
  analyzeDocument:analyzeDocument,
  askQuestion:askQuestion,
  downloadReport:downloadReport,
  USE_DEMO_MODE:USE_DEMO_MODE,
  API_BASE_URL:API_BASE_URL,
};