"""
Run this inside your backend venv to see which model names are valid:
  python list_models.py
"""
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env")

client = genai.Client(api_key=api_key)

print("\nAvailable models that support generateContent:\n")
for m in client.models.list():
    # Only show models that support content generation
    if hasattr(m, 'supported_actions'):
        if 'generateContent' in (m.supported_actions or []):
            print(f"  {m.name}")
    else:
        # Older SDK versions — just print all
        print(f"  {m.name}")