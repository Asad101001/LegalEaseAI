import faiss
import pickle
import os
import numpy as np
from typing import List, Dict
from core.embeddings import embed
from fastapi import HTTPException

# FIX: Absolute path — same fix as vectorstore.py.
# Must match exactly so the index saved during /analyze is found during /qa.
BASE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "storage", "faiss_indexes"
)


def retrieve(document_id: str, query: str, top_k: int = 3) -> List[Dict]:
    """
    Retrieve top-k most relevant clauses for a query using FAISS similarity search.

    Args:
        document_id: From the /api/analyze response
        query: User question (Urdu or English)
        top_k: Number of relevant clauses to return

    Returns:
        List of clause dicts: id, type, risk, original, urdu
    """
    if not document_id or not query:
        raise HTTPException(status_code=400, detail="document_id and query are required")

    index_path = os.path.join(BASE, str(document_id), "index.faiss")
    meta_path  = os.path.join(BASE, str(document_id), "meta.pkl")

    if not os.path.exists(index_path) or not os.path.exists(meta_path):
        raise HTTPException(
            status_code=404,
            detail=f"Document {document_id} not found. Please re-upload and analyze the document."
        )

    try:
        index = faiss.read_index(index_path)

        with open(meta_path, "rb") as f:
            clauses = pickle.load(f)

        # Embed the query with the same model used during indexing
        query_embedding = embed([query])

        # Search FAISS — returns distances and indices arrays
        distances, indices = index.search(query_embedding.astype(np.float32), top_k)

        results = []
        for idx in indices[0]:
            if 0 <= idx < len(clauses):
                results.append(clauses[idx].copy())

        if not results:
            raise HTTPException(status_code=404, detail="No relevant clauses found for this query")

        return results

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG retrieval failed: {str(e)}")