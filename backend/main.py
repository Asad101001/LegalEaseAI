from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import traceback

from api.analyze import router as analyze_router
from api.qa import router as qa_router
from api.report import router as report_router

app = FastAPI(
    title="LegalEase AI Backend",
    description="Urdu Legal Document Analysis API for Pakistani Citizens",
    version="1.0.0"
)

# ─── CORS ─────────────────────────────────────────────────────
# FIX: Cannot combine allow_origins=["*"] with allow_credentials=True
# Using specific origins with credentials=True (correct approach)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://legalease-ai.vercel.app",
        "null",  # browsers send 'null' origin when opening index.html as a local file
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ─── PRE-LOAD EMBEDDING MODEL AT STARTUP ──────────────────────
# FIX: Load sentence-transformers model at startup, not on first request.
# Without this, the first upload request times out waiting for the ~90MB model to download.
@app.on_event("startup")
async def startup_event():
    try:
        from core.embeddings import model as _embedding_model
        print("[STARTUP] Embedding model loaded successfully.")
    except Exception as e:
        print(f"[STARTUP WARNING] Could not pre-load embedding model: {e}")

# ─── GLOBAL ERROR HANDLER ─────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_id = str(abs(hash(str(exc))))[-6:]
    print(f"[ERROR {error_id}] {type(exc).__name__}: {str(exc)}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": str(exc)[:200],
            "error_id": error_id
        }
    )

# ─── VALIDATION ERROR HANDLER ─────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    serializable_errors = []
    for error in errors:
        err_dict = dict(error)
        err_dict.pop("ctx", None)  # Remove non-serializable exception context
        serializable_errors.append(err_dict)
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "message": "Invalid request data",
            "details": serializable_errors
        }
    )

# ─── ROUTERS ──────────────────────────────────────────────────
app.include_router(analyze_router, prefix="/api", tags=["Analysis"])
app.include_router(qa_router,     prefix="/api", tags=["Q&A"])
app.include_router(report_router, prefix="/api", tags=["Report"])

# ─── HEALTH ───────────────────────────────────────────────────
@app.get("/")
def health_check():
    return {
        "status": "running",
        "service": "LegalEase AI Backend",
        "version": "1.0.0",
        "message": "API is operational"
    }

@app.get("/health")
def health():
    return {"status": "ok"}