import faiss
import os
import pickle
import numpy as np
from core.embeddings import embed, get_embedding_dim
from fastapi import HTTPException

# FIX: Use absolute path based on this file's location.
# A relative path like "storage/faiss_indexes" breaks on hosted servers
# (Railway, Render) because the working directory varies.
BASE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "storage", "faiss_indexes"
)


def create_index(document_id: str, clauses: list) -> dict:
    """
    Create and persist a FAISS index for a document's clauses.

    Args:
        document_id: Unique identifier for the document session
        clauses: List of dicts with keys: id, type, risk, original, urdu

    Returns:
        Dict with document_id, num_clauses, status
    """
    if not clauses:
        raise HTTPException(status_code=400, detail="No clauses to index")

    texts = [c.get("original", "") for c in clauses]

    if not any(t.strip() for t in texts):
        raise HTTPException(status_code=400, detail="No extractable text from clauses")

    try:
        # Generate embeddings for all clause texts
        vectors = embed(texts)

        expected_dim = get_embedding_dim()
        if vectors.shape[1] != expected_dim:
            raise HTTPException(
                status_code=500,
                detail=f"Embedding dimension mismatch: got {vectors.shape[1]}, expected {expected_dim}"
            )

        # Build FAISS flat L2 index
        index = faiss.IndexFlatL2(vectors.shape[1])
        index.add(vectors.astype(np.float32))

        # Persist to disk
        doc_path = os.path.join(BASE, str(document_id))
        os.makedirs(doc_path, exist_ok=True)

        faiss.write_index(index, os.path.join(doc_path, "index.faiss"))

        with open(os.path.join(doc_path, "meta.pkl"), "wb") as f:
            pickle.dump(clauses, f)

        return {
            "document_id": document_id,
            "num_clauses": len(clauses),
            "status": "indexed"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FAISS indexing failed: {str(e)}")