# api/qa.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.rag import retrieve
from core.prompts import qa_prompt
from dotenv import load_dotenv
import google.generativeai as genai
import os
import re

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env")

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-1.5-flash")

router = APIRouter()

class QARequest(BaseModel):
    question: str
    document_id: str

@router.post("/qa")
async def ask_question(req: QARequest):
    """
    Process Q&A request using RAG + Gemini.
    
    Flow:
    1. Retrieve top-3 relevant clauses from FAISS
    2. Build prompt with user question + clauses
    3. Call Gemini API
    4. Parse response (EN/UR/SOURCE/CONFIDENCE)
    5. Return structured JSON for frontend
    """
    if not req.question or not req.document_id:
        raise HTTPException(status_code=400, detail="question and document_id are required")
    
    try:
        # Retrieve relevant clauses
        chunks = retrieve(req.document_id, req.question, top_k=3)
        
        if not chunks:
            return {
                "answer_en": "No relevant clauses found in the document for this question.",
                "answer_ur": "آپ کے سوال کے لیے دستاویز میں متعلقہ شق نہیں ملی۔",
                "source_clause": None,
                "confidence": 0.0
            }
        
        # Build prompt
        prompt = qa_prompt(req.question, chunks)
        
        # Call Gemini
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=300,
                temperature=0.3,
            )
        )
        
        if not response or not response.text:
            raise HTTPException(status_code=500, detail="Gemini response is empty")
        
        # Parse structured response
        answer_en, answer_ur, source, confidence = _parse_qa_response(response.text, chunks)
        
        return {
            "answer_en": answer_en,
            "answer_ur": answer_ur,
            "source_clause": source,
            "confidence": confidence
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Q&A processing failed: {str(e)[:100]}"
        )

def _parse_qa_response(response_text: str, chunks: list) -> tuple:
    """
    Parse Gemini response in format:
    [ENGLISH]
    ...
    [URDU]
    ...
    [SOURCE]
    ...
    [CONFIDENCE]
    ...
    
    Returns: (answer_en, answer_ur, source_clause, confidence)
    """
    try:
        # Extract sections using regex
        en_match = re.search(r'\[ENGLISH\](.*?)\[URDU\]', response_text, re.DOTALL)
        ur_match = re.search(r'\[URDU\](.*?)\[SOURCE\]', response_text, re.DOTALL)
        src_match = re.search(r'\[SOURCE\](.*?)\[CONFIDENCE\]', response_text, re.DOTALL)
        conf_match = re.search(r'\[CONFIDENCE\](.*?)$', response_text, re.DOTALL)
        
        answer_en = en_match.group(1).strip() if en_match else response_text[:200]
        answer_ur = ur_match.group(1).strip() if ur_match else "جواب دستیاب نہیں۔"
        source = src_match.group(1).strip() if src_match else f"Clause {chunks[0]['id']} - {chunks[0]['type']}"
        
        # Parse confidence
        confidence_str = conf_match.group(1).strip() if conf_match else "0.85"
        try:
            confidence = float(''.join(c for c in confidence_str if c.isdigit() or c == '.')) / 100
            confidence = max(0.0, min(1.0, confidence))
        except:
            confidence = 0.85
        
        return answer_en, answer_ur, source, confidence
        
    except Exception as e:
        # Fallback parsing if regex fails
        return (
            response_text[:200] or "Could not process the answer.",
            "جواب دستیاب نہیں۔",
            f"Clause {chunks[0]['id']} - {chunks[0]['type']}" if chunks else None,
            0.5
        )