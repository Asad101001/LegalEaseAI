import pdfplumber
import docx
import tempfile
import os
from fastapi import HTTPException
from typing import Union

async def extract_text(file) -> str:
    """
    Extract text from uploaded file (PDF, DOCX, TXT).
    Handles multiple encodings and file types safely.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    suffix = file.filename.lower()
    
    # Validate file type
    if not any(suffix.endswith(ext) for ext in [".pdf", ".docx", ".doc", ".txt"]):
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Use PDF, DOCX, DOC, or TXT"
        )
    
    temp_path = None
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(suffix)[1]) as tmp:
            content = file.file.read()
            tmp.write(content)
            temp_path = tmp.name
        
        # Extract text based on file type
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
        # Clean up temporary file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass

def _extract_pdf(path: str) -> str:
    """Extract text from PDF file"""
    try:
        with pdfplumber.open(path) as pdf:
            if len(pdf.pages) == 0:
                raise HTTPException(status_code=400, detail="PDF file is empty")
            text = "\n".join(
                (page.extract_text() or "") for page in pdf.pages
            )
            if not text.strip():
                raise HTTPException(
                    status_code=400, 
                    detail="PDF contains no extractable text. Scanned images need OCR."
                )
            return text
    except pdfplumber.exceptions.PDFException as e:
        raise HTTPException(status_code=400, detail=f"PDF parsing error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF processing failed: {str(e)}")

def _extract_docx(path: str) -> str:
    """Extract text from DOCX file"""
    try:
        doc = docx.Document(path)
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        if not text.strip():
            raise HTTPException(status_code=400, detail="DOCX file contains no text")
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"DOCX parsing error: {str(e)}")

def _extract_txt(path: str) -> str:
    """Extract text from TXT file with encoding detection"""
    encodings = ["utf-8", "utf-16", "latin-1", "cp1252", "iso-8859-1"]
    text = None
    
    for encoding in encodings:
        try:
            with open(path, "r", encoding=encoding) as f:
                text = f.read()
            if text.strip():
                return text
        except (UnicodeDecodeError, LookupError):
            continue
    
    raise HTTPException(status_code=400, detail="TXT file is empty or unreadable")
