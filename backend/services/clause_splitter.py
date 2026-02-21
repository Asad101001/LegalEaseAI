from langchain_text_splitters import RecursiveCharacterTextSplitter
from fastapi import HTTPException

def split_clauses(text):
    """
    Split document text into clauses/chunks for analysis.
    Respects sentence boundaries and maintains context.
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Extracted text is empty")
    
    # Remove excessive whitespace
    text = " ".join(text.split())
    
    if len(text) < 100:
        raise HTTPException(
            status_code=400, 
            detail="Document is too short. Provide at least 100 characters."
        )
    
    # RecursiveCharacterTextSplitter respects sentence boundaries
    splitter = RecursiveCharacterTextSplitter(
        separators=["\n\n", "\n", ". ", " ", ""],
        chunk_size=600,      # Size of each clause
        chunk_overlap=100,   # Context overlap between clauses
        length_function=len,
    )
    
    chunks = splitter.split_text(text)
    
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not split document into clauses")
    
    # Filter out very short chunks
    chunks = [c.strip() for c in chunks if len(c.strip()) > 50]
    
    if len(chunks) > 100:
        # Warn but don't fail - just take first 100
        chunks = chunks[:100]
    
    return chunks