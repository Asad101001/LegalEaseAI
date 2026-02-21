from sentence_transformers import SentenceTransformer
import numpy as np
from fastapi import HTTPException

# Load the embedding model once (cached in memory)
try:
    model = SentenceTransformer("all-MiniLM-L6-v2")
    EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 produces 384-dimensional embeddings
except Exception as e:
    raise RuntimeError(f"Failed to load embedding model: {str(e)}")

def embed(texts):
    """
    Convert texts to embeddings (vectors).
    
    Args:
        texts: List of text strings
    
    Returns:
        numpy array of shape (len(texts), 384)
    """
    if not texts:
        raise HTTPException(status_code=400, detail="No texts to embed")
    
    # Ensure texts is a list
    if isinstance(texts, str):
        texts = [texts]
    
    # Filter out empty strings
    texts = [t.strip() for t in texts if t.strip()]
    
    if not texts:
        raise HTTPException(status_code=400, detail="All texts are empty after filtering")
    
    try:
        # Generate embeddings
        embeddings = model.encode(texts, convert_to_tensor=False)
        
        # Return as numpy array
        return np.array(embeddings, dtype=np.float32)
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Embedding generation failed: {str(e)}"
        )

def get_embedding_dim():
    """Return the dimension of embeddings produced by this model"""
    return EMBEDDING_DIM