import re
from typing import Tuple

# Define patterns for risk classification
TERMINATION_PATTERNS = {
    "keywords": ["terminate", "termination", "evict", "eviction", "end", "shall end", "may end", "right to terminate"],
    "risk": "high"
}

PENALTY_PATTERNS = {
    "keywords": ["penalty", "fine", "penalty for", "penalty of", "late", "default", "breach", "compensation", "damages"],
    "risk": "medium"
}

ARBITRATION_PATTERNS = {
    "keywords": ["arbitration", "arbitrator", "dispute resolution", "binding arbitration", "waive", "court"],
    "risk": "high"
}

LIABILITY_PATTERNS = {
    "keywords": ["liable", "liable for", "not responsible", "not held liable", "waive", "liability", "damage", "indemnity"],
    "risk": "high"
}

MAINTENANCE_PATTERNS = {
    "keywords": ["maintenance", "repair", "structural", "landlord", "responsible for", "maintain"],
    "risk": "safe"
}

SECURITY_DEPOSIT_PATTERNS = {
    "keywords": ["security deposit", "deposit", "retained", "return", "refund"],
    "risk": "safe"
}

SUBLETTING_PATTERNS = {
    "keywords": ["subletting", "sublet", "sharing", "assign", "prohibited"],
    "risk": "safe"
}

RENT_INCREASE_PATTERNS = {
    "keywords": ["rent increase", "increase the rent", "raise", "rental increase", "%", "percent", "annually"],
    "risk": "medium"
}

# Type classification
CLAUSE_TYPES = {
    "Termination": TERMINATION_PATTERNS,
    "Arbitration": ARBITRATION_PATTERNS,
    "Liability Waiver": LIABILITY_PATTERNS,
    "Payment & Penalty": PENALTY_PATTERNS,
    "Maintenance": MAINTENANCE_PATTERNS,
    "Security Deposit": SECURITY_DEPOSIT_PATTERNS,
    "Subletting": SUBLETTING_PATTERNS,
    "Rent Increase": RENT_INCREASE_PATTERNS,
}

def classify_risk(text: str) -> Tuple[str, str]:
    """
    Classify a clause by risk level and type.
    Returns: (risk_level, clause_type) where risk_level is "high", "medium", or "safe"
    """
    if not text or len(text.strip()) < 20:
        return "medium", "General Clause"
    
    text_lower = text.lower()
    
    # Track scores for each category
    scores = {}
    matched_type = "General Clause"
    
    # Check each clause type pattern
    for clause_type, patterns in CLAUSE_TYPES.items():
        match_count = 0
        for keyword in patterns["keywords"]:
            # Use word boundaries for more accurate matching
            if re.search(r'\b' + re.escape(keyword) + r'\b', text_lower):
                match_count += 1
        
        if match_count > 0:
            scores[clause_type] = (match_count, patterns["risk"])
    
    # Find the best match (highest keyword count)
    if scores:
        matched_type = max(scores.keys(), key=lambda k: scores[k][0])
        risk_level = scores[matched_type][1]
    else:
        # Check for generic indicators if no specific match
        if any(word in text_lower for word in ["shall", "must", "will", "may not", "cannot", "prohibited"]):
            risk_level = "medium"
        else:
            risk_level = "safe"
    
    return risk_level, matched_type