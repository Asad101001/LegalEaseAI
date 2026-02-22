from dotenv import load_dotenv
import os
import asyncio
from google import genai
from google.genai import types
from fastapi import HTTPException

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

client = genai.Client(api_key=GEMINI_API_KEY)

_GEN_CONFIG = types.GenerateContentConfig(
    max_output_tokens=150,
    temperature=0.7,
)


async def explain_urdu(clause: str, clause_type: str = "", risk_level: str = "") -> str:
    """
    Generate a concise Urdu explanation for a legal clause.
    Uses new google-genai SDK (google-generativeai is deprecated).
    Wrapped in run_in_executor so it doesn't block FastAPI's event loop.
    """
    if not clause or len(clause.strip()) < 20:
        return "یہ شق بہت مختصر ہے۔"

    prompt = f"""You are a Pakistani legal assistant helping common citizens understand contracts in simple Urdu.

Clause Type: {clause_type}
Risk Level: {risk_level}

Explain this legal clause in VERY SIMPLE, SHORT Urdu (2-3 sentences max):
- Use everyday language that a farmer or shopkeeper can understand
- Add ONE practical tip for what to do
- Include a risk warning if risk level is high
- NO English words (use pure Urdu)
- NO legal jargon

Clause:
{clause}

Provide ONLY the Urdu explanation, nothing else. Start directly with the explanation."""

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model="gemini-1.5-flash-latest",
                contents=prompt,
                config=_GEN_CONFIG,
            )
        )

        if not response or not response.text:
            return _fallback_urdu(risk_level)

        return response.text.strip()

    except Exception as e:
        print(f"[urdu_explainer] Gemini call failed: {e}")
        return _fallback_urdu(risk_level)


def _fallback_urdu(risk_level: str) -> str:
    """Return a safe fallback Urdu message if Gemini fails."""
    if risk_level == "high":
        return "یہ ایک خطرناک شق ہے۔ دستخط کرنے سے پہلے کسی ماہر سے مشورہ کریں۔"
    elif risk_level == "medium":
        return "یہ شق احتیاط کی ضرورت ہے۔ اس کو غور سے پڑھیں۔"
    return "یہ ایک محفوظ شق ہے۔"