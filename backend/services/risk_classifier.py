import re
from typing import Tuple

CLAUSE_TYPES = {
    "Termination": {
        "keywords": ["terminate", "termination", "evict", "eviction", "end", "shall end", "may end", "right to terminate"],
        "risk": "high"
    },
    "Arbitration": {
        "keywords": ["arbitration", "arbitrator", "dispute resolution", "binding arbitration", "waive", "court"],
        "risk": "high"
    },
    "Liability Waiver": {
        "keywords": ["liable", "liable for", "not responsible", "not held liable", "waive", "liability", "damage", "indemnity"],
        "risk": "high"
    },
    "Payment & Penalty": {
        "keywords": ["penalty", "fine", "penalty for", "penalty of", "late", "default", "breach", "compensation", "damages"],
        "risk": "medium"
    },
    "Rent Increase": {
        "keywords": ["rent increase", "increase the rent", "raise", "rental increase", "%", "percent", "annually"],
        "risk": "medium"
    },
    "Maintenance": {
        "keywords": ["maintenance", "repair", "structural", "landlord", "responsible for", "maintain"],
        "risk": "safe"
    },
    "Security Deposit": {
        "keywords": ["security deposit", "deposit", "retained", "return", "refund"],
        "risk": "safe"
    },
    "Subletting": {
        "keywords": ["subletting", "sublet", "sharing", "assign", "prohibited"],
        "risk": "safe"
    },
}


def classify_risk(text: str) -> Tuple[str, str]:
    """
    Classify a clause by risk level and type using keyword matching.

    Returns:
        (risk_level, clause_type) where risk_level is "high", "medium", or "safe"
    """
    if not text or len(text.strip()) < 20:
        return "medium", "General Clause"

    text_lower = text.lower()
    scores = {}

    for clause_type, patterns in CLAUSE_TYPES.items():
        match_count = sum(
            1 for keyword in patterns["keywords"]
            if re.search(r'\b' + re.escape(keyword) + r'\b', text_lower)
        )
        if match_count > 0:
            scores[clause_type] = (match_count, patterns["risk"])

    if scores:
        matched_type = max(scores, key=lambda k: scores[k][0])
        risk_level   = scores[matched_type][1]
    else:
        # Generic fallback
        if any(w in text_lower for w in ["shall", "must", "will", "may not", "cannot", "prohibited"]):
            risk_level = "medium"
        else:
            risk_level = "safe"
        matched_type = "General Clause"

    return risk_level, matched_type