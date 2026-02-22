"""
services/urdu_explainer.py

Priority order:
1. Groq API  (FREE, fast, high limits) - get key at console.groq.com
2. Gemini    (free tier, lower limits) - get key at aistudio.google.com
3. Static fallback (always works, no API)

Setup: Add to backend/.env:
  GROQ_API_KEY=gsk_...   (recommended - free, generous limits)
  GEMINI_API_KEY=...     (backup)
"""
from dotenv import load_dotenv
import os
import asyncio

load_dotenv()

GROQ_API_KEY   = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

_groq_client   = None
_gemini_client = None
_GEMINI_CONFIG = None

# ── Initialize Groq ──────────────────────────────────────────
if GROQ_API_KEY:
    try:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
        print("[urdu_explainer] Groq initialized (llama-3.3-70b)")
    except ImportError:
        print("[urdu_explainer] groq not installed → pip install groq")
    except Exception as e:
        print(f"[urdu_explainer] Groq init error: {e}")

# ── Initialize Gemini ─────────────────────────────────────────
if GEMINI_API_KEY:
    try:
        from google import genai
        from google.genai import types as genai_types
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        _GEMINI_CONFIG = genai_types.GenerateContentConfig(
            max_output_tokens=150, temperature=0.7)
        print("[urdu_explainer] Gemini initialized (gemini-2.0-flash-lite)")
    except ImportError:
        print("[urdu_explainer] google-genai not installed → pip install google-genai")
    except Exception as e:
        print(f"[urdu_explainer] Gemini init error: {e}")

if not _groq_client and not _gemini_client:
    print("[urdu_explainer] No AI API → using static Urdu fallback")
    print("[urdu_explainer] Add GROQ_API_KEY to .env for real Urdu explanations")


async def explain_urdu(clause: str, clause_type: str = "", risk_level: str = "") -> str:
    if not clause or len(clause.strip()) < 20:
        return "یہ شق بہت مختصر ہے۔"

    prompt = (
        "You are a Pakistani legal assistant. Explain this legal clause in VERY SIMPLE Urdu "
        "(2-3 sentences max).\n\n"
        f"Clause Type: {clause_type}\nRisk Level: {risk_level}\n\n"
        "Rules:\n"
        "- Use everyday Urdu a farmer or shopkeeper understands\n"
        "- Add ONE practical tip\n"
        "- If high risk add a clear warning\n"
        "- NO English words except proper nouns\n"
        "- Start directly with the Urdu explanation\n\n"
        f"Clause: {clause}\n\nUrdu explanation:"
    )

    if _groq_client:
        result = await _try_groq(prompt)
        if result:
            return result

    if _gemini_client:
        result = await _try_gemini(prompt)
        if result:
            return result

    return _fallback_urdu(risk_level)


async def _try_groq(prompt: str):
    try:
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, lambda: _groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.7,
        ))
        text = resp.choices[0].message.content
        return text.strip() if text and text.strip() else None
    except Exception as e:
        print(f"[urdu_explainer] Groq failed: {e}")
        return None


async def _try_gemini(prompt: str):
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
        print(f"[urdu_explainer] Gemini failed: {e}")
        return None


def _fallback_urdu(risk_level: str) -> str:
    if risk_level == "high":
        return "یہ ایک خطرناک شق ہے۔ دستخط کرنے سے پہلے کسی ماہر سے مشورہ کریں اور اس شق کو تبدیل کروانے کی کوشش کریں۔"
    if risk_level == "medium":
        return "یہ شق احتیاط کی ضرورت ہے۔ اسے غور سے پڑھیں اور اپنے حقوق سمجھیں۔"
    return "یہ ایک معیاری اور محفوظ شق ہے۔"