import pdfplumber
import docx
import tempfile
import os
from fastapi import HTTPException

async def extract_text(file) -> str:
    """
    Extract text from uploaded file (PDF, DOCX, TXT).

    FIX: Changed file.file.read() to await file.read()
    The original used a synchronous read inside an async function,
    which returned empty bytes on some servers and caused upload failures.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    suffix = file.filename.lower()

    if not any(suffix.endswith(ext) for ext in [".pdf", ".docx", ".doc", ".txt"]):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Use PDF, DOCX, DOC, or TXT"
        )

    temp_path = None
    try:
        # FIX: await file.read() — this is the critical fix for the upload bug
        content = await file.read()

        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        # Write to temp file for library processing
        ext = os.path.splitext(suffix)[1] or ".tmp"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            temp_path = tmp.name

        if suffix.endswith(".pdf"):
            return _extract_pdf(temp_path)
        elif suffix.endswith((".docx", ".doc")):
            return _extract_docx(temp_path)
        elif suffix.endswith(".txt"):
            return _extract_txt(temp_path)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File extraction failed: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


def _extract_pdf(path: str) -> str:
    try:
        with pdfplumber.open(path) as pdf:
            if len(pdf.pages) == 0:
                raise HTTPException(status_code=400, detail="PDF file is empty")
            text = "\n".join((page.extract_text() or "") for page in pdf.pages)
            if not text.strip():
                raise HTTPException(
                    status_code=400,
                    detail="PDF contains no extractable text. Scanned images need OCR."
                )
            return text
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF processing failed: {str(e)}")


def _extract_docx(path: str) -> str:
    try:
        doc = docx.Document(path)
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        if not text.strip():
            raise HTTPException(status_code=400, detail="DOCX file contains no text")
        return text
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"DOCX parsing error: {str(e)}")


def _extract_txt(path: str) -> str:
    encodings = ["utf-8", "utf-16", "latin-1", "cp1252", "iso-8859-1"]
    for encoding in encodings:
        try:
            with open(path, "r", encoding=encoding) as f:
                text = f.read()
            if text.strip():
                return text
        except (UnicodeDecodeError, LookupError):
            continue
    raise HTTPException(status_code=400, detail="TXT file is empty or uses an unsupported encoding")