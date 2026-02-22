import numpy as np

EMBEDDING_DIM = 128
_vectorizer = None

def _get_vectorizer():
    global _vectorizer
    if _vectorizer is None:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.decomposition import TruncatedSVD
        import pickle, os
        _vectorizer = {"tfidf": TfidfVectorizer(max_features=512), "svd": TruncatedSVD(n_components=EMBEDDING_DIM), "fitted": False}
    return _vectorizer

def embed(texts):
    if isinstance(texts, str):
        texts = [texts]
    texts = [t.strip() for t in texts if t and t.strip()]
    if not texts:
        raise ValueError("No valid texts to embed")
    
    v = _get_vectorizer()
    if not v["fitted"]:
        # Fit on whatever we have
        tfidf_matrix = v["tfidf"].fit_transform(texts)
        if tfidf_matrix.shape[0] >= EMBEDDING_DIM:
            v["svd"].fit(tfidf_matrix)
            vectors = v["svd"].transform(tfidf_matrix)
        else:
            vectors = tfidf_matrix.toarray()
            # Pad or truncate to EMBEDDING_DIM
            if vectors.shape[1] < EMBEDDING_DIM:
                vectors = np.pad(vectors, ((0,0),(0, EMBEDDING_DIM - vectors.shape[1])))
            else:
                vectors = vectors[:, :EMBEDDING_DIM]
        v["fitted"] = True
        v["last_texts"] = texts
        return vectors.astype(np.float32)
    else:
        tfidf_matrix = v["tfidf"].transform(texts)
        try:
            vectors = v["svd"].transform(tfidf_matrix)
        except Exception:
            vectors = tfidf_matrix.toarray()
            if vectors.shape[1] < EMBEDDING_DIM:
                vectors = np.pad(vectors, ((0,0),(0, EMBEDDING_DIM - vectors.shape[1])))
            else:
                vectors = vectors[:, :EMBEDDING_DIM]
        return vectors.astype(np.float32)

def get_embedding_dim():
    return EMBEDDING_DIM