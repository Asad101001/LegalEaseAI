def urdu_explanation_prompt(clause_text: str, clause_type: str = "", risk_level: str = "") -> str:
    """Build prompt for Urdu explanation (used as reference — actual call is in urdu_explainer.py)"""
    return f"""Explain this {clause_type} clause in VERY SIMPLE Urdu for a Pakistani citizen:

Clause:
{clause_text}

Requirements:
- Use 2-3 sentences maximum
- Use everyday Urdu (no English words except proper nouns)
- Add ONE practical tip
- No legal jargon
- If high risk, add a warning

Provide ONLY the Urdu explanation."""


def qa_prompt(question: str, chunks: list) -> str:
    """
    Build a structured RAG prompt for Q&A.
    chunks = list of clause dicts with keys: id, type, risk, original, urdu
    """
    clauses_text = "\n\n".join([
        f"[Clause {c.get('id', '?')} - {c.get('type', 'General')}]\n"
        f"Risk: {c.get('risk', 'unknown')}\n"
        f"Text: {c.get('original', '')}\n"
        f"Urdu: {c.get('urdu', '')}"
        for c in chunks
    ])

    return f"""You are a legal assistant helping Pakistani citizens understand contracts.

IMPORTANT: Answer ONLY based on the clauses provided. If the answer is not in these clauses, say you cannot answer.

User Question (in Urdu or English):
{question}

Relevant Document Clauses:
{clauses_text}

Provide your response in this exact format:
[ENGLISH]
<2-3 sentence answer in English>

[URDU]
<2-3 sentence answer in simple Urdu>

[SOURCE]
<Which clause(s) this answer is based on, e.g. "Clause 1 - Termination">

[CONFIDENCE]
<A number from 0 to 100 representing how confident you are this answer is correct>"""