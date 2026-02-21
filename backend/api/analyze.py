from fastapi import APIRouter, UploadFile, File, HTTPException
import uuid
from services.text_extractor import extract_text
from services.clause_splitter import split_clauses
from services.risk_classifier import classify_risk
from services.urdu_explainer import explain_urdu
from core.vectorstore import create_index

router = APIRouter()

@router.post("/analyze")
async def analyze_document(file: UploadFile = File(...)):
    """
    Main document analysis endpoint.
    
    Flow:
    1. Extract text from uploaded file
    2. Split into clauses
    3. Classify risk for each clause
    4. Generate Urdu explanations
    5. Create FAISS index
    6. Return structured response
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate file size (10MB limit)
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 10MB limit")
    
    try:
        # Step 1: Extract text from file
        text = await extract_text(file)
        
        # Step 2: Split into clauses
        clauses_text = split_clauses(text)
        
        if not clauses_text:
            raise HTTPException(status_code=400, detail="Could not extract clauses from document")
        
        # Generate unique document ID
        document_id = str(uuid.uuid4())
        
        # Step 3-4: Process each clause (classify risk + generate Urdu)
        results = []
        for i, clause in enumerate(clauses_text, start=1):
            # Classify risk and determine type
            risk_level, clause_type = classify_risk(clause)
            
            # Generate Urdu explanation using Gemini
            urdu_explanation = explain_urdu(clause, clause_type, risk_level)
            
            # Add result
            results.append({
                "id": i,
                "type": clause_type,
                "risk": risk_level,
                "original": clause,
                "urdu": urdu_explanation,
                "tooltip": _get_tooltip(risk_level, clause_type)
            })
        
        # Prepare clauses for FAISS indexing
        index_data = [{
            "id": r["id"],
            "type": r["type"],
            "risk": r["risk"],
            "original": r["original"],
            "urdu": r["urdu"]
        } for r in results]
        
        # Step 5: Create FAISS index
        create_index(document_id, index_data)
        
        # Calculate summary statistics
        high_risk = sum(1 for r in results if r["risk"] == "high")
        medium_risk = sum(1 for r in results if r["risk"] == "medium")
        safe_risk = len(results) - high_risk - medium_risk
        
        return {
            "document_id": document_id,
            "document_name": file.filename or "document",
            "clauses": results,
            "summary": {
                "total_clauses": len(results),
                "high_risk": high_risk,
                "medium_risk": medium_risk,
                "safe_risk": safe_risk
            }
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)[:100]}"
        )

def _get_tooltip(risk_level: str, clause_type: str) -> str:
    """Generate helpful tooltip based on risk level"""
    tooltips = {
        ("high", "Termination"): "Landlord can evict with minimal notice. Try to negotiate for 60+ days and specific conditions.",
        ("high", "Arbitration"): "You lose your right to civil court. This strongly favors the wealthier party.",
        ("high", "Liability Waiver"): "Document move-in condition with photos. Landlord won't pay for damages from structural defects.",
        ("medium", "Payment & Penalty"): "Penalties can compound quickly. One missed month could cost 20%+ extra.",
        ("medium", "Rent Increase"): "Annual increases can add up. Negotiate a cap (e.g., 8-10% per year).",
    }
    
    key = (risk_level, clause_type)
    return tooltips.get(key) or (
        "Review this clause carefully before signing." if risk_level == "high"
        else "Consider negotiating the terms." if risk_level == "medium"
        else None
    )