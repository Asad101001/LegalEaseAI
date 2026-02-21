import faiss
import os
import pickle
import numpy as np
from core.embeddings import embed, get_embedding_dim
from fastapi import HTTPException

BASE = "storage/faiss_indexes"

def create_index(document_id, clauses):
    """
    Create and store a FAISS index for a document.
    
    Args:
        document_id: Unique identifier for the document
        clauses: List of dicts with matching structure (id, type, risk, original, urdu, tooltip)
    """
    if not clauses:
        raise HTTPException(status_code=400, detail="No clauses to index")
    
    # Extract clause texts for embedding
    texts = [c.get("original", "") for c in clauses]
    
    if not any(texts):
        raise HTTPException(status_code=400, detail="No extractable text from clauses")
    
    try:
        # Generate embeddings
        vectors = embed(texts)
        
        # Validate embedding dimension
        if vectors.shape[1] != get_embedding_dim():
            raise HTTPException(
                status_code=500,
                detail=f"Embedding dimension mismatch: {vectors.shape[1]} vs {get_embedding_dim()}"
            )
        
        # Create FAISS index
        index = faiss.IndexFlatL2(vectors.shape[1])
        index.add(vectors.astype(np.float32))
        
        # Create storage directory
        path = os.path.join(BASE, str(document_id))
        os.makedirs(path, exist_ok=True)
        
        # Save FAISS index
        faiss.write_index(index, os.path.join(path, "index.faiss"))
        
        # Save clause metadata
        with open(os.path.join(path, "meta.pkl"), "wb") as f:
            pickle.dump(clauses, f)
        
        return {
            "document_id": document_id,
            "num_clauses": len(clauses),
            "status": "indexed"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"FAISS indexing failed: {str(e)}"
        )
