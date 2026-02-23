# LegalEase AI — System Architecture

> Deep-dive into how the system works end to end: data flow, component responsibilities, design decisions, and gotchas discovered during development.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Request Lifecycle](#2-request-lifecycle)
3. [Text Extraction Layer](#3-text-extraction-layer)
4. [Clause Splitting](#4-clause-splitting)
5. [Risk Classification Engine](#5-risk-classification-engine)
6. [Embedding + Vector Store](#6-embedding--vector-store)
7. [LLM Layer — Groq + Gemini Fallback](#7-llm-layer--groq--gemini-fallback)
8. [RAG Q&A Pipeline](#8-rag-qa-pipeline)
9. [PDF Report Generation](#9-pdf-report-generation)
10. [Frontend SPA Architecture](#10-frontend-spa-architecture)
11. [State Management and Session Persistence](#11-state-management-and-session-persistence)
12. [Concurrency Model](#12-concurrency-model)
13. [Known Limitations](#13-known-limitations)

---

## 1. High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Vanilla JS SPA)                 │
│                                                                 │
│  home.html → analysis.html → qa.html → report.html             │
│  loader.js   api.js          app.js     sessionStorage          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP (fetch API)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (uvicorn)                     │
│                                                                 │
│  POST /api/analyze          POST /api/qa     GET /api/report    │
│       │                          │                │             │
│       ▼                          ▼                ▼             │
│  text_extractor            rag.py           report.py           │
│  clause_splitter           prompts.py       ReportLab           │
│  risk_classifier           Groq / Gemini                        │
│  urdu_explainer            ↑                                    │
│  vectorstore ──────────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                  ┌─────────┴──────────┐
                  ▼                    ▼
            Groq API            Google Gemini API
         (llama-3.3-70b)      (gemini-2.0-flash-lite)
         [PRIMARY]             [FALLBACK]
```

The backend is **stateless between requests** except for the FAISS indexes stored to disk at `backend/storage/faiss_indexes/{document_id}/`. Each document gets its own subdirectory with two files: `index.faiss` and `meta.pkl`.

---

## 2. Request Lifecycle

### Document Analysis (`POST /api/analyze`)

```
Client uploads file
        │
        ▼
extract_text(file)                    # pdfplumber / python-docx / TXT
        │
        ▼
split_clauses(text)                   # LangChain RecursiveCharacterTextSplitter
        │                             # chunk_size=600, overlap=100
        ▼
for each clause:
    classify_risk(clause)             # sync, fast — keyword regex match
        │                             # returns (risk_level, clause_type)
        ▼
asyncio.gather(*[                     # ALL Groq calls fire simultaneously
    explain_urdu(clause, type, risk)  # not one at a time
    for each clause
])
        │
        ▼
create_index(document_id, clauses)    # embed all clauses → FAISS IndexFlatL2
        │                             # also pickles clause metadata to disk
        ▼
return JSON response to client
```

This concurrency design is critical. For an 8-clause document, all 8 Groq API calls fire at the same time. Without `asyncio.gather()`, total time would be `8 × ~1.5s = 12s`. With it, total time is `~1.5s` (network round-trip for the slowest call).

### Q&A (`POST /api/qa`)

```
Client sends {question, document_id}
        │
        ▼
retrieve(document_id, question, top_k=3)
        │   ├── load FAISS index from disk
        │   ├── embed the question (TF-IDF + SVD)
        │   └── search → returns top 3 clause dicts
        ▼
qa_prompt(question, chunks)           # builds structured prompt with clause context
        │
        ▼
_call_groq(prompt)                    # try Groq first
        │  └── if fails → _call_gemini(prompt)
        ▼
_parse_qa_response(text, chunks)      # extract [ENGLISH] [URDU] [SOURCE] [CONFIDENCE]
        │
        ▼
return {answer_en, answer_ur, source_clause, confidence}
```

---

## 3. Text Extraction Layer

**File:** `backend/services/text_extractor.py`

Supports PDF, DOCX, DOC, and TXT. Files are written to a temporary directory (`tempfile.gettempdir()`), extracted, then immediately deleted. No file is ever persisted.

**PDF extraction** uses `pdfplumber` which handles multi-column layouts and tables better than PyPDF2. If the PDF contains no extractable text (i.e. it is a scanned image), the extractor raises a 400 error with a message directing the user to use OCR. This is a known limitation — Tesseract OCR integration is a planned improvement.

**TXT extraction** tries five encodings in order: UTF-8, UTF-16, Latin-1, CP1252, ISO-8859-1. This handles most Pakistani government document exports which often use Windows-1252.

**Error handling:** All three extractors raise `HTTPException` with descriptive messages that propagate to the client. The client surfaces these in the toast notification system.

---

## 4. Clause Splitting

**File:** `backend/services/clause_splitter.py`

Uses `langchain_text_splitters.RecursiveCharacterTextSplitter` with these parameters:

```python
separators = ["\n\n", "\n", ". ", " ", ""]
chunk_size    = 600   # characters
chunk_overlap = 100   # characters of context carried into next chunk
```

The separator priority means the splitter tries to break on paragraph boundaries first, then line breaks, then sentence endings. This preserves legal clause integrity better than splitting on arbitrary character count.

Chunks shorter than 50 characters are discarded (headers, page numbers, etc.). The maximum is capped at 100 chunks per document to prevent abuse and keep FAISS indexes manageable.

**Why not use sentence-transformers?** The `all-MiniLM-L6-v2` model requires `torch` which adds ~500MB to the deployment. We replaced it with scikit-learn TF-IDF + TruncatedSVD which is lighter and performs well enough for domain-specific legal text where keyword overlap is the primary signal.

---

## 5. Risk Classification Engine

**File:** `backend/services/risk_classifier.py`

Eight clause types are defined, each with a keyword list and a default risk level:

| Clause Type | Default Risk | Example Keywords |
|---|---|---|
| Termination | high | terminate, evict, shall end, right to terminate |
| Arbitration | high | arbitration, binding, waive, court |
| Liability Waiver | high | liable, not responsible, indemnity |
| Payment & Penalty | medium | penalty, fine, late, breach, damages |
| Rent Increase | medium | increase the rent, percent, annually |
| Maintenance | safe | maintenance, repair, structural, landlord |
| Security Deposit | safe | deposit, retained, return, refund |
| Subletting | safe | subletting, sublet, assign, prohibited |

Classification uses `re.search()` with `\b` word boundaries, not simple substring matching. Each clause is checked against all eight types and scored by keyword hit count. The type with the highest hit count wins. If no keywords match, the classifier falls back to detecting modal verbs (`shall`, `must`, `may not`) and assigns `medium`, otherwise `safe`.

**Known weakness:** The classifier does not understand negation. "The landlord is NOT responsible for maintenance" would score as `safe` (Maintenance match) when it should be `high` (Liability Waiver). Improving this with a small fine-tuned NER model is a planned improvement.

---

## 6. Embedding + Vector Store

**Files:** `backend/core/embeddings.py`, `backend/core/vectorstore.py`

### Embedding

A module-level `_vectorizer` dict holds a `TfidfVectorizer` and a `TruncatedSVD`. The TF-IDF is fit on the first batch of clauses from a document (when `fitted=False`). Subsequent queries (Q&A requests) call `transform()` on the already-fit vectorizer.

Output dimension is 128 (`EMBEDDING_DIM = 128`). This is intentionally small — FAISS search over 128-dim vectors for 8–100 clauses is effectively instantaneous.

**Important:** The vectorizer is module-level and shared across requests. This means embeddings from Document A are used to encode queries for Document B. This is a known limitation for multi-user deployments. In a production system, each document would need its own persisted vectorizer state alongside the FAISS index.

### Vector Store

FAISS `IndexFlatL2` performs exhaustive L2 distance search — no approximation. This is fine for documents up to a few hundred clauses. For larger corpora, `IndexIVFFlat` with `nlist` buckets would be appropriate.

Per-document storage structure:
```
storage/faiss_indexes/
└── {uuid}/
    ├── index.faiss    # FAISS binary index
    └── meta.pkl       # List of clause dicts (id, type, risk, original, urdu, tooltip)
```

The `meta.pkl` is also what the report endpoint reads. It does not use the FAISS index — it just loads all clauses directly.

---

## 7. LLM Layer — Groq + Gemini Fallback

**File:** `backend/services/urdu_explainer.py`

Both clients are initialized at module load time. If a key is missing or the package is not installed, that client is set to `None` and skipped silently.

```python
# Priority order
if _groq_client:
    result = await _try_groq(prompt)
    if result: return result

if _gemini_client:
    result = await _try_gemini(prompt)
    if result: return result

return _fallback_urdu(risk_level)   # always works, no API
```

**Groq model:** `llama-3.3-70b-versatile` — chosen for quality Urdu output and generous free-tier rate limits (14,400 requests/day on free tier vs Gemini's ~1,500).

**Gemini model:** `gemini-2.0-flash-lite` — the lightest Gemini model, used only as fallback. Note: free tier daily limits are per-project, shared across all models in the `gemini-2.0-*` family.

**Static fallback:** Three hardcoded Urdu strings (high / medium / safe) are returned if both APIs fail. This ensures the `/api/analyze` endpoint always returns 200 with usable data even in offline conditions.

**Why `run_in_executor`?** Both `groq` and `google-genai` SDKs are synchronous. Calling them directly in an `async def` FastAPI route would block the event loop, preventing other requests from being processed during the API call. `run_in_executor(None, lambda: ...)` offloads the blocking call to FastAPI's default thread pool executor.

---

## 8. RAG Q&A Pipeline

**Files:** `backend/core/rag.py`, `backend/core/prompts.py`, `backend/api/qa.py`

### Retrieval

```python
query_embedding = embed([question])               # 128-dim vector
distances, indices = index.search(query_embedding, top_k=3)
chunks = [clauses[i] for i in indices[0] if 0 <= i < len(clauses)]
```

Top-3 clauses are returned regardless of distance score. There is no distance threshold filtering — even a weak match is returned. In practice this works well because legal Q&A questions are domain-specific enough that even the third-best match is usually relevant.

### Prompt Structure

The Q&A prompt passes the question and three retrieved clauses to the LLM, with explicit instructions to answer ONLY from the provided clauses:

```
[Clause 1 - Termination]
Risk: high
Text: The landlord reserves the right to terminate...
Urdu: مالک مکان بغیر وجہ...

User Question: کیا مالک مجھے نکال سکتا ہے؟

Respond in format:
[ENGLISH] ... [URDU] ... [SOURCE] ... [CONFIDENCE] ...
```

### Response Parsing

`_parse_qa_response()` uses `re.search()` with `re.DOTALL` to extract each tagged section. If any tag is missing (LLM hallucinated a different format), it falls back gracefully: English answer becomes the first 300 chars of the response, Urdu becomes a generic "answer not available" string, source falls back to the first retrieved clause ID.

---

## 9. PDF Report Generation

**File:** `backend/api/report.py`

Uses ReportLab's low-level `canvas.Canvas` API (not the higher-level Platypus flowables). This gives pixel-precise control over layout but requires manual Y-coordinate tracking.

The report reads `meta.pkl` directly — it does not re-run the analysis pipeline. Page overflow is handled with a simple Y threshold check (`if y < 80: showPage()`).

The PDF is written to `tempfile.gettempdir()`, read into bytes, then immediately deleted. The bytes are returned as a `Response` with `application/pdf` content type and `Content-Disposition: attachment` header so the browser triggers a download.

**Known issue:** Arabic/Urdu text (RTL) in ReportLab requires `arabic-reshaper` and `python-bidi` libraries to render correctly. Without them, Nastaliq characters appear disconnected. The current report only includes English clause types and risk levels for this reason. Urdu in the PDF report is a planned improvement.

---

## 10. Frontend SPA Architecture

The frontend is a hand-rolled SPA with no framework. Five HTML page fragments are loaded in parallel by `loader.js` using `Promise.all(PAGES.map(fetch))` and injected into `#app-root`. After all fragments are injected, `initApp()` is called.

```
index.html
    └── #app-root
          ├── #page-home      (from pages/home.html)
          ├── #page-analysis  (from pages/analysis.html)
          ├── #page-qa        (from pages/qa.html)
          ├── #page-report    (from pages/report.html)
          └── #page-about     (from pages/about.html)
```

Only one page has `display: flex` at a time (class `active`). Navigation calls `showPage(name)` which toggles the `active` class and re-triggers CSS animations.

**CSS architecture:** Five files with clear responsibilities. Design tokens live in `base.css` as CSS custom properties (`--gold`, `--ink`, etc.). No CSS preprocessor — variables and `calc()` handle all dynamic values. The `Noto Nastaliq Urdu` font is loaded from Google Fonts and applied only to elements with Urdu content (`direction: rtl`).

---

## 11. State Management and Session Persistence

All UI state lives in a single `state` object in `app.js`:

```javascript
const state = {
  currentPage: 'home',
  documentId: null,
  documentName: null,
  clauses: [],
  activeFilter: 'all',
  searchQuery: '',
  currentClauseIndex: 0,
};
```

After a successful document analysis, the document state is saved to `sessionStorage`:

```javascript
sessionStorage.setItem('legalease_state', JSON.stringify({
  documentId, documentName, clauses
}));
```

On every page load, `initApp()` checks sessionStorage first. If a previous document exists, it restores state and renders the analysis page directly, skipping the home page. This survives Live Server hot-reloads during development.

The FAISS index on the backend does **not** survive a backend restart. If the backend is restarted, the `document_id` in sessionStorage becomes invalid. The Q&A endpoint will return a 404 and the frontend will surface the error via toast.

---

## 12. Concurrency Model

FastAPI runs on `uvicorn` with a single-process event loop by default. The concurrency model is:

- **I/O-bound tasks** (HTTP calls to Groq/Gemini): handled via `run_in_executor` → thread pool
- **CPU-bound tasks** (TF-IDF embedding, FAISS indexing): also run via `run_in_executor` to avoid blocking the event loop
- **Multiple clause explanations**: `asyncio.gather()` fires all executor tasks simultaneously

For the hackathon demo, this is sufficient. In production, `uvicorn --workers 4` with `gunicorn` as the process manager would be recommended for multi-core utilization.

---

## 13. Known Limitations

| Issue | Impact | Planned Fix |
|---|---|---|
| Shared TF-IDF vectorizer across documents | Q&A semantic accuracy degrades in multi-user scenarios | Per-document vectorizer pickle |
| No OCR support | Scanned PDFs return 400 error | Tesseract integration |
| Urdu not rendering in PDF | Report shows English only | `arabic-reshaper` + `python-bidi` |
| Risk classifier ignores negation | "NOT liable" classified as safe liability | Fine-tuned NER model |
| FAISS index lost on backend restart | Q&A fails after restart | Redis or persistent embedding cache |
| No authentication | Any client can upload documents | JWT or API key middleware |
| No file size streaming | 10MB limit blocks large contracts | Chunked upload + streaming extraction |
