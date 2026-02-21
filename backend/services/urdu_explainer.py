from dotenv import load_dotenv
import os
import google.generativeai as genai
from fastapi import HTTPException

# Load .env
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

def explain_urdu(clause: str, clause_type: str = "", risk_level: str = "") -> str:
    """
    Generates a concise Urdu explanation for a legal clause.
    Tailored for Pakistani citizens with practical advice.
    
    Args:
        clause: The legal clause text
        clause_type: Type of clause (e.g., "Termination")
        risk_level: Risk level ("high", "medium", "safe")
    
    Returns:
        Urdu explanation string
    """
    if not clause or len(clause.strip()) < 20:
        return "یہ شق بہت مختصر ہے۔"
    
    try:
        # Build risk context for better explanation
        risk_context = ""
        if risk_level == "high":
            risk_context = "یہ ایک خطرناک شق ہے۔ براہ کرم توجہ دیں۔"
        elif risk_level == "medium":
            risk_context = "یہ شق احتیاط کی ضرورت ہے۔"
        else:
            risk_context = "یہ ایک محفوظ شق ہے۔"
        
        prompt = f"""You are a Pakistani legal assistant helping common citizens understand contracts in simple Urdu.

Clause Type: {clause_type}
Risk Level: {risk_level}

Explain this legal clause in VERY SIMPLE, SHORT Urdu (2-3 sentences max):
- Use everyday language that a farmer or shopkeeper can understand
- Add ONE practical tip for what to do
- Include the risk warning if applicable
- NO English words (use pure Urdu)
- NO legal jargon

Clause:
{clause}

Provide ONLY the Urdu explanation, nothing else. Start directly with the explanation."""

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=150,
                temperature=0.7,
            )
        )
        
        if not response or not response.text:
            return f"{risk_context} براہ کرم اس شق کو احتیاط سے پڑھیں۔"
        
        return response.text.strip()
        
    except Exception as e:
        # Fallback if API fails
        return f"خرابی: {str(e)[:50]}. براہ کرم اس شق کو دوبارہ چیک کریں۔"