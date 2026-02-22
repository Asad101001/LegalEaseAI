"""
api/qa.py

Uses same priority as urdu_explainer.py:
1. Groq (free, fast)
2. Gemini (backup)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.rag import retrieve
from core.prompts import qa_prompt
from dotenv import load_dotenv
import asyncio
import os
import re

load_dotenv()

GROQ_API_KEY   = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

_groq_client   = None
_gemini_client = None
_GEMINI_CONFIG = None

if GROQ_API_KEY:
    try:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception:
        pass

if GEMINI_API_KEY:
    try:
        from google import genai
        from google.genai import types as genai_types
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        _GEMINI_CONFIG = genai_types.GenerateContentConfig(
            max_output_tokens=400, temperature=0.3)
    except Exception:
        pass

router = APIRouter()


class QARequest(BaseModel):
    question: str
    document_id: str


@router.post("/qa")
async def ask_question(req: QARequest):
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
        response_text = None

        # Try Groq first
        if _groq_client:
            response_text = await _call_groq(prompt)

        # Fallback to Gemini
        if not response_text and _gemini_client:
            response_text = await _call_gemini(prompt)

        if not response_text:
            return {
                "answer_en": "AI service temporarily unavailable. Check your API keys in .env",
                "answer_ur": "AI سروس عارضی طور پر دستیاب نہیں۔ .env فائل میں API key چیک کریں۔",
                "source_clause": f"Clause {chunks[0]['id']} - {chunks[0]['type']}" if chunks else None,
                "confidence": 0.0
            }

        answer_en, answer_ur, source, confidence = _parse_qa_response(response_text, chunks)
        return {
            "answer_en": answer_en,
            "answer_ur": answer_ur,
            "source_clause": source,
            "confidence": confidence
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Q&A failed: {str(e)[:200]}")


async def _call_groq(prompt: str):
    try:
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, lambda: _groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.3,
        ))
        text = resp.choices[0].message.content
        return text.strip() if text and text.strip() else None
    except Exception as e:
        print(f"[qa] Groq failed: {e}")
        return None


async def _call_gemini(prompt: str):
    try:
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, lambda: _gemini_client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents=prompt,
            config=_GEMINI_CONFIG,
        ))
        if resp and resp.text and resp.text.strip():
            return resp.text.strip()
        return None
    except Exception as e:
        print(f"[qa] Gemini failed: {e}")
        return None


def _parse_qa_response(response_text: str, chunks: list) -> tuple:
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