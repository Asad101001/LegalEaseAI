<div align="center">

```
██╗     ███████╗ ██████╗  █████╗ ██╗     ███████╗ █████╗ ███████╗███████╗
██║     ██╔════╝██╔════╝ ██╔══██╗██║     ██╔════╝██╔══██╗██╔════╝██╔════╝
██║     █████╗  ██║  ███╗███████║██║     █████╗  ███████║███████╗█████╗  
██║     ██╔══╝  ██║   ██║██╔══██║██║     ██╔══╝  ██╔══██║╚════██║██╔══╝  
███████╗███████╗╚██████╔╝██║  ██║███████╗███████╗██║  ██║███████║███████╗
╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝
                                                                    A I
```

### **اردو قانونی معاون** — Urdu Legal Assistant

*Understanding legal documents should not require a law degree or a lawyer's fee.*

---

![Python](https://img.shields.io/badge/Python-3.11+-b8892a?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-111418?style=for-the-badge&logo=fastapi&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-RAG-b8892a?style=for-the-badge)
![FAISS](https://img.shields.io/badge/FAISS-Vector_DB-1c3f5e?style=for-the-badge)
![Gemini](https://img.shields.io/badge/Gemini_AI-LLM-111418?style=for-the-badge&logo=google&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-Frontend-b8892a?style=for-the-badge&logo=javascript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-1c3f5e?style=for-the-badge)

---

> 🏆 **Hackathon for HEC Generative AI Training Cohort 2** submission  
> Built in 72 hours by a team of six

</div>

---

## 📖 The Problem

Pakistan has over **220 million people**. More than 90% lack higher education. Yet every day, millions sign rental agreements, loan documents, employment contracts, and terms of service — all written in dense, technical **English legalese** they cannot understand.

The result? Tenants evicted with 7-day notices. Borrowers trapped by compounding penalty clauses. Workers signing away their rights without knowing it.

Lawyers charge **PKR 5,000–50,000** per consultation. That's a week's wage for most Pakistanis.

**LegalEase AI** bridges that gap.

---

## ✨ What It Does

Upload any legal document → get instant, plain-Urdu explanations of every clause, colour-coded risk ratings, and a full Q&A chatbot that answers your questions from the document itself.

<div align="center">

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│               Upload PDF / DOCX / TXT                      │
│                        │                                   │
│                        ▼                                   │
│         Text extraction (pdfplumber / python-docx)         │
│                        │                                   │
│                        ▼                                   │
│    Clause splitting (LangChain RecursiveTextSplitter)      │
│                        │                                   │
│                        ▼                                   │
│      FAISS vector index (sentence-transformers)            │
│                        │                                   │
│                        ▼                                   │
│       Risk classification (keyword + semantic)             │
│                        │                                   │
│                        ▼                                   │
│     Urdu explanation (Gemini AI, concurrent)               │
│                        │                                   │
│                        ▼                                   │
│       PDF Report + RAG Q&A Chatbot                         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

</div>

---

## 🎯 Key Features

<div align="center">

| Feature | Description |
|---|---|
| 🔴🟡🟢 **Risk Detection** | Clauses auto-classified as High / Medium / Safe |
| 🌐 **Urdu Explanations** | Every clause explained in plain, culturally appropriate Urdu |
| 💬 **RAG Chatbot** | Ask anything in Urdu or English — answers grounded in *your* document only |
| 📊 **PDF Report** | Downloadable colour-coded risk report via ReportLab |
| ⚡ **Concurrent Processing** | All Gemini calls fire simultaneously via `asyncio.gather()` |
| 🔒 **Privacy First** | Files processed in memory, never stored on disk |
| 📱 **Responsive UI** | Works on mobile, tablet, and desktop |

</div>

---

## 🚀 Run Locally

### Prerequisites

- Python 3.11+
- A [Google AI Studio](https://aistudio.google.com) API key (free tier works)
- Node.js not required — pure vanilla JS frontend

### 1. Clone the repo

```bash
git clone https://github.com/Asad101001/legalease-ai.git
cd legalease-ai
```

### 2. Set up the backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and add your keys:

```
# Primary — free, fast, generous limits
GROQ_API_KEY=your_groq_key_here

# Fallback — used if Groq fails or quota exhausted
GEMINI_API_KEY=your_gemini_key_here
```

Get your Groq key (recommended) → [console.groq.com](https://console.groq.com)  
Get your Gemini key (fallback) → [aistudio.google.com](https://aistudio.google.com)

The app works with just one key. Groq has much higher free-tier limits than Gemini.

### 4. Start the backend

```bash
python -m uvicorn main:app --reload --port 8000
```

You should see:
```
INFO: Application startup complete.
```

Health check: open [http://localhost:8000](http://localhost:8000) — you'll see `{"status": "running"}`.

### 5. Run the frontend

Open `frontend/index.html` with **Live Server** (VS Code extension) on port 5500.  
Or serve it any way you like — it's just HTML, CSS, and JS.

```
http://127.0.0.1:5500/frontend/index.html
```

### 6. Upload and analyze

Drop any PDF, DOCX, or TXT legal document into the upload card. The analysis takes 5–15 seconds depending on document size.

---

## 🗂️ Project Structure


```
legalease-ai/
│
├── backend/
│   ├── api/
│   │   ├── analyze.py       # POST /api/analyze — upload + full pipeline
│   │   ├── qa.py            # POST /api/qa — RAG Q&A (Groq → Gemini fallback)
│   │   └── report.py        # GET /api/report/{id} — ReportLab PDF generation
│   │
│   ├── core/
│   │   ├── embeddings.py    # TF-IDF + TruncatedSVD (128-dim) embeddings
│   │   ├── vectorstore.py   # FAISS IndexFlatL2 create/save/load
│   │   ├── rag.py           # Retrieve top-k clauses for Q&A context
│   │   └── prompts.py       # Prompt templates for Urdu explanation + Q&A
│   │
│   ├── services/
│   │   ├── text_extractor.py   # pdfplumber (PDF) + python-docx (DOCX) + TXT
│   │   ├── clause_splitter.py  # LangChain RecursiveCharacterTextSplitter
│   │   ├── risk_classifier.py  # Keyword + regex risk scoring (8 clause types)
│   │   └── urdu_explainer.py   # Groq llama-3.3-70b → Gemini fallback → static
│   │
│   ├── storage/
│   │   └── faiss_indexes/      # Per-document FAISS index + meta.pkl (runtime)
│   │
│   ├── main.py              # FastAPI app, CORS, error handlers, health check
│   ├── requirements.txt
│   ├── .env.example
│   └── .gitkeep
│
├── frontend/
│   ├── css/
│   │   ├── base.css         # Design tokens, fonts (Cormorant + DM Sans + Noto Nastaliq Urdu)
│   │   ├── animations.css   # 16 keyframes + scroll-reveal IntersectionObserver classes
│   │   ├── components.css   # Nav, buttons, cards, clause list, Q&A bubbles, toast
│   │   ├── pages.css        # Per-page layouts (home, analysis, Q&A, report, about)
│   │   └── responsive.css   # Mobile breakpoints at 1024px and 640px
│   │
│   ├── js/
│   │   ├── loader.js        # Fetches page fragments in parallel, boots initApp()
│   │   ├── api.js           # analyzeDocument / askQuestion / downloadReport + demo mode
│   │   └── app.js           # All state, render, filter, Q&A, toast, sessionStorage
│   │
│   ├── pages/               # HTML fragments loaded dynamically by loader.js
│   │   ├── home.html        # Hero, upload card, How It Works section
│   │   ├── analysis.html    # Split-panel: clause list + Urdu analysis cards
│   │   ├── qa.html          # Q&A layout: dark sidebar + chat messages + input
│   │   ├── report.html      # Risk summary table + PDF download button
│   │   └── about.html       # Problem statement, architecture diagram, team
│   │
│   └── index.html           # Entry point — loads CSS, injects #app-root, loads JS
│
├── docs/
│   ├── ARCHITECTURE.md      # System design, data flow, component deep-dives
│   └── API_REFERENCE.md     # All endpoints, request/response schemas, error codes
│
├── .gitignore
└── README.md
```


---

## 🛠️ Tech Stack


<div align="center">

### Backend

| Tool | Purpose |
|---|---|
| **FastAPI** | Async REST API, global error handlers, CORS |
| **Groq** | Primary LLM — `llama-3.3-70b-versatile`, free tier, high limits |
| **Google Gemini** | Fallback LLM — `gemini-2.0-flash-lite` when Groq is unavailable |
| **LangChain** | `RecursiveCharacterTextSplitter` for clause chunking (600 chars, 100 overlap) |
| **FAISS** | `IndexFlatL2` vector similarity search for RAG retrieval |
| **scikit-learn** | `TfidfVectorizer` + `TruncatedSVD` for 128-dim embeddings |
| **pdfplumber** | PDF text extraction |
| **python-docx** | DOCX text extraction |
| **ReportLab** | PDF risk report generation (Canvas API) |
| **asyncio** | Concurrent Groq/Gemini calls via `gather()` + `run_in_executor()` |

</div>

<div align="center">

### Frontend
  
| Tool | Purpose |
|---|---|
| **Vanilla JS** | Zero dependencies, pure ES6 |
| **CSS Custom Properties** | Design token system |
| **Noto Nastaliq Urdu** | Authentic Urdu typography |
| **Cormorant Garamond** | Elegant serif display font |
| **IntersectionObserver** | Scroll-triggered animations |

</div>

---

## 🔮 Planned Improvements

- [ ] **Voice input** — Speak your question in Urdu, transcribed via Whisper
- [ ] **Multi-document comparison** — Compare two contracts side by side
- [ ] **Punjabi / Sindhi support** — Expand beyond Urdu
- [ ] **Mobile app** — React Native wrapper
- [ ] **OCR support** — Scanned PDF handling via Tesseract
- [ ] **Clause negotiation suggestions** — AI-generated counter-clause recommendations
- [ ] **WhatsApp bot** — Send a document, get analysis back in chat
- [ ] **Lawyer referral network** — Connect high-risk documents to pro bono lawyers
- [ ] **Batch processing** — Analyze multiple documents in one session
- [ ] **User accounts** — Save and revisit past analyses

---

## 👥 Contributors

Farhana Faiz · Fazeelat Shaheen · Hammad Zahid · Muhammad Asad · Zain Ibrar · Zaryab Aamir

---

## ⚡ API Reference

### `POST /api/analyze`
Upload a document for analysis.

**Request:** `multipart/form-data` with `file` field (PDF / DOCX / TXT, max 10MB)

**Response:**
```json
{
  "document_id": "uuid-string",
  "document_name": "agreement.pdf",
  "clauses": [
    {
      "id": 1,
      "type": "Termination",
      "risk": "high",
      "original": "The landlord reserves the right to terminate...",
      "urdu": "مالک مکان بغیر وجہ کے نکال سکتا ہے...",
      "tooltip": "Negotiate for 60+ days notice minimum."
    }
  ],
  "summary": { "total_clauses": 8, "high_risk": 3, "medium_risk": 2, "safe_risk": 3 }
}
```

### `POST /api/qa`
Ask a question about an analyzed document.

**Request:**
```json
{ "question": "کیا مالک مجھے نکال سکتا ہے؟", "document_id": "uuid-string" }
```

**Response:**
```json
{
  "answer_en": "Yes, Clause 1 gives the landlord the right to...",
  "answer_ur": "ہاں، شق نمبر 1 کے مطابق مالک مکان...",
  "source_clause": "Clause 1 - Termination",
  "confidence": 0.91
}
```

### `GET /api/report/{document_id}`
Download the full PDF risk report.

---

## 📄 License

MIT — do whatever you want with it. Just don't use it to write unfair contracts.

---

<div align="center">

**Built with ❤️ for Pakistan · Hackathon for HEC Generative AI Training Cohort 2**

*قانونی دستاویزات کو سمجھنا اب مشکل نہیں*

</div>