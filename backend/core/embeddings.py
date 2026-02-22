import numpy as np
from fastapi import HTTPException

EMBEDDING_DIM = 384
_model = None

def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

def embed(texts):
    if not texts:
        raise HTTPException(status_code=400, detail="No texts to embed")
    if isinstance(texts, str):
        texts = [texts]
    texts = [t.strip() for t in texts if t.strip()]
    if not texts:
        raise HTTPException(status_code=400, detail="All texts are empty")
    try:
        return np.array(_get_model().encode(texts, convert_to_tensor=False), dtype=np.float32)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

def get_embedding_dim():
    return EMBEDDING_DIM