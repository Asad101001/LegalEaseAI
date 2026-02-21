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

# ─── CORS MIDDLEWARE ──────────────────────────────────────────
# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://legalease-ai.vercel.app",
        "*"  # Allow all for development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── GLOBAL ERROR HANDLER ─────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and return structured error response"""
    error_id = str(hash(exc))[-6:]
    
    print(f"[ERROR {error_id}] {type(exc).__name__}: {str(exc)}")
    traceback.print_exc()
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": str(exc)[:100],
            "error_id": error_id
        }
    )

# ─── VALIDATION ERROR HANDLER ──────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors"""
    # Convert errors to JSON-serializable format (remove exception objects)
    errors = exc.errors()
    serializable_errors = []
    for error in errors:
        err_dict = dict(error)
        # Remove 'ctx' which may contain non-serializable exception objects
        if 'ctx' in err_dict:
            del err_dict['ctx']
        serializable_errors.append(err_dict)
    
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "message": "Invalid request data",
            "details": serializable_errors
        }
    )

# ─── API ROUTERS ───────────────────────────────────────────────
app.include_router(analyze_router, prefix="/api", tags=["Analysis"])
app.include_router(qa_router, prefix="/api", tags=["Q&A"])
app.include_router(report_router, prefix="/api", tags=["Report"])

# ─── HEALTH CHECK ──────────────────────────────────────────────
@app.get("/")
def health_check():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "LegalEase AI Backend",
        "version": "1.0.0",
        "message": "API is operational"
    }

@app.get("/health")
def health():
    """Alternative health endpoint"""
    return {"status": "ok"}