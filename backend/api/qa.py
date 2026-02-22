# api/qa.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.rag import retrieve
from core.prompts import qa_prompt
from dotenv import load_dotenv
from google import genai
from google.genai import types
import asyncio
import os
import re

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env")

client = genai.Client(api_key=api_key)

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
    3. Call Gemini API (async via run_in_executor)
    4. Parse response (EN/UR/SOURCE/CONFIDENCE)
    5. Return structured JSON for frontend
    """
    if not req.question or not req.document_id:
        raise HTTPException(status_code=400, detail="question and document_id are required")

    try:
        chunks = retrieve(req.document_id, req.question, top_k=3)

        if not chunks:
            return {
                "answer_en": "No relevant clauses found in the document for this question.",
                "answer_ur": "آپ کے سوال کے لیے دستاویز میں متعلقہ شق نہیں ملی۔",
                "source_clause": None,
                "confidence": 0.0
            }

        prompt = qa_prompt(req.question, chunks)

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model="gemini-1.5-flash-latest",
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=400,
                    temperature=0.3,
                )
            )
        )

        if not response or not response.text:
            raise HTTPException(status_code=500, detail="Gemini returned an empty response")

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
            detail=f"Q&A processing failed: {str(e)[:200]}"
        )


def _parse_qa_response(response_text: str, chunks: list) -> tuple:
    """
    Parse Gemini response in format:
    [ENGLISH] ... [URDU] ... [SOURCE] ... [CONFIDENCE] ...
    Returns: (answer_en, answer_ur, source_clause, confidence)
    """
    try:
        en_match   = re.search(r'\[ENGLISH\](.*?)\[URDU\]',      response_text, re.DOTALL)
        ur_match   = re.search(r'\[URDU\](.*?)\[SOURCE\]',       response_text, re.DOTALL)
        src_match  = re.search(r'\[SOURCE\](.*?)\[CONFIDENCE\]', response_text, re.DOTALL)
        conf_match = re.search(r'\[CONFIDENCE\](.*?)$',           response_text, re.DOTALL)

        answer_en = en_match.group(1).strip()  if en_match  else response_text[:300]
        answer_ur = ur_match.group(1).strip()  if ur_match  else "جواب دستیاب نہیں۔"
        source    = src_match.group(1).strip() if src_match else (
            f"Clause {chunks[0]['id']} - {chunks[0]['type']}" if chunks else None
        )

        confidence = 0.85
        if conf_match:
            try:
                raw = ''.join(c for c in conf_match.group(1).strip() if c.isdigit() or c == '.')
                val = float(raw)
                confidence = val / 100 if val > 1 else val
                confidence = max(0.0, min(1.0, confidence))
            except Exception:
                confidence = 0.85

        return answer_en, answer_ur, source, confidence

    except Exception:
        return (
            response_text[:300] if response_text else "Could not process the answer.",
            "جواب دستیاب نہیں۔",
            f"Clause {chunks[0]['id']} - {chunks[0]['type']}" if chunks else None,
            0.5
        )