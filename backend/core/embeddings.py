from sentence_transformers import SentenceTransformer
import numpy as np
from fastapi import HTTPException

# Loaded once at import time (triggered at startup by main.py's on_event)
# all-MiniLM-L6-v2 is fully public — no HuggingFace token required
try:
    model = SentenceTransformer("all-MiniLM-L6-v2")
    EMBEDDING_DIM = 384
    print("[embeddings] SentenceTransformer model loaded.")
except Exception as e:
    raise RuntimeError(f"Failed to load embedding model: {str(e)}")


def embed(texts):
    """
    Convert a list of strings to embedding vectors.

    Args:
        texts: str or list of str

    Returns:
        numpy array of shape (len(texts), 384)
    """
    if not texts:
        raise HTTPException(status_code=400, detail="No texts to embed")

    if isinstance(texts, str):
        texts = [texts]

    texts = [t.strip() for t in texts if t and t.strip()]

    if not texts:
        raise HTTPException(status_code=400, detail="All texts are empty after filtering")

    try:
        embeddings = model.encode(texts, convert_to_tensor=False)
        return np.array(embeddings, dtype=np.float32)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")


def get_embedding_dim() -> int:
    return EMBEDDING_DIM