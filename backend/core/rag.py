# core/rag.py
import faiss
import pickle
import os
import numpy as np
from typing import List, Dict
from core.embeddings import embed
from fastapi import HTTPException

STORAGE_PATH = "storage/faiss_indexes"

def retrieve(document_id: str, query: str, top_k: int = 3) -> List[Dict]:
    """
    Retrieve top-k most relevant clauses for a query using RAG.
    
    Args:
        document_id: Document ID from previous analysis
        query: User's question/query
        top_k: Number of relevant clauses to return
    
    Returns:
        List of relevant clause dictionaries with id, type, text, risk, urdu
    """
    if not document_id or not query:
        raise HTTPException(status_code=400, detail="document_id and query are required")
    
    index_path = os.path.join(STORAGE_PATH, str(document_id), "index.faiss")
    meta_path = os.path.join(STORAGE_PATH, str(document_id), "meta.pkl")
    
    # Check if document exists
    if not os.path.exists(index_path) or not os.path.exists(meta_path):
        raise HTTPException(
            status_code=404, 
            detail=f"Document {document_id} not found. Please re-upload and analyze the document."
        )
    
    try:
        # Load FAISS index and metadata
        index = faiss.read_index(index_path)
        with open(meta_path, "rb") as f:
            clauses = pickle.load(f)
        
        # Embed the query
        query_embedding = embed([query])
        
        # Search FAISS index
        distances, indices = index.search(query_embedding.astype(np.float32), top_k)
        
        # Retrieve matching clauses
        results = []
        for idx in indices[0]:
            if 0 <= idx < len(clauses):
                clause = clauses[idx].copy()
                results.append(clause)
        
        if not results:
            raise HTTPException(
                status_code=404,
                detail="No relevant clauses found for this query"
            )
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"RAG retrieval failed: {str(e)}"
        )