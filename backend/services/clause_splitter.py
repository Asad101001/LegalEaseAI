from langchain_text_splitters import RecursiveCharacterTextSplitter
from fastapi import HTTPException


def split_clauses(text: str) -> list:
    """
    Split document text into clauses for analysis.
    Uses sentence-boundary-aware splitting with context overlap.
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Extracted text is empty")

    text = " ".join(text.split())

    if len(text) < 100:
        raise HTTPException(
            status_code=400,
            detail="Document is too short. Provide at least 100 characters."
        )

    splitter = RecursiveCharacterTextSplitter(
        separators=["\n\n", "\n", ". ", " ", ""],
        chunk_size=600,
        chunk_overlap=100,
        length_function=len,
    )

    chunks = splitter.split_text(text)

    if not chunks:
        raise HTTPException(status_code=400, detail="Could not split document into clauses")

    chunks = [c.strip() for c in chunks if len(c.strip()) > 50]

    if not chunks:
        raise HTTPException(status_code=400, detail="No usable clauses found after filtering")

    # Cap at 100 clauses to avoid runaway Gemini costs
    if len(chunks) > 100:
        chunks = chunks[:100]

    return chunks