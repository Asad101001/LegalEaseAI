from fastapi import APIRouter, Response, HTTPException
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak
from reportlab.lib.units import inch
import pickle
import os
import tempfile
from datetime import datetime
from typing import List, Dict

router = APIRouter()

STORAGE_PATH = "storage/faiss_indexes"

@router.get("/report/{document_id}")
async def generate_report(document_id: str):
    """
    Generate a comprehensive PDF report of all analyzed clauses.
    
    Report includes:
    - Header with document name, date, branding
    - Risk summary table
    - Color-coded rows based on risk level
    - Urdu explanations
    """
    meta_path = os.path.join(STORAGE_PATH, str(document_id), "meta.pkl")
    
    if not os.path.exists(meta_path):
        raise HTTPException(
            status_code=404,
            detail=f"Document {document_id} not found"
        )
    
    try:
        # Load clause metadata
        with open(meta_path, "rb") as f:
            clauses = pickle.load(f)
        
        if not clauses:
            raise HTTPException(status_code=400, detail="No clauses found in document")
        
        # Generate PDF
        pdf_buffer = _generate_pdf(clauses, document_id)
        
        return Response(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=LegalEase_Report_{document_id[:8]}.pdf"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {str(e)[:100]}"
        )

def _generate_pdf(clauses: List[Dict], document_id: str) -> bytes:
    """
    Generate PDF report using ReportLab.
    Works cross-platform (Windows, Linux, macOS).
    """
    # Use platform-independent temp directory
    temp_dir = tempfile.gettempdir()
    pdf_path = os.path.join(temp_dir, f"legalease_{document_id}.pdf")
    
    try:
        # Create PDF
        c = canvas.Canvas(pdf_path, pagesize=A4)
        width, height = A4
        
        # Color scheme
        COLOR_HIGH = HexColor("#b83232")
        COLOR_MEDIUM = HexColor("#c47c1a")
        COLOR_SAFE = HexColor("#2a7a4a")
        COLOR_GOLD = HexColor("#b8892a")
        COLOR_INK = HexColor("#111418")
        
        y = height - 40
        
        # ─── HEADER ───────────────────────────────────────
        c.setFont("Helvetica-Bold", 20)
        c.setFillColor(COLOR_INK)
        c.drawString(40, y, "LegalEase AI – Legal Risk Analysis Report")
        y -= 25
        
        # Subheader
        c.setFont("Helvetica", 10)
        c.setFillColor(HexColor("#7a7265"))
        c.drawString(40, y, f"Generated: {datetime.now().strftime('%d %B %Y at %H:%M:%S')}")
        y -= 15
        c.drawString(40, y, f"Document ID: {document_id[:8]}")
        y -= 30
        
        # ─── SUMMARY STATS ───────────────────────────────
        high_count = sum(1 for c in clauses if c.get("risk") == "high")
        med_count = sum(1 for c in clauses if c.get("risk") == "medium")
        safe_count = len(clauses) - high_count - med_count
        
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(COLOR_INK)
        c.drawString(40, y, "Summary Statistics")
        y -= 15
        
        c.setFont("Helvetica", 10)
        c.setFillColor(COLOR_HIGH)
        c.drawString(50, y, f"● High Risk Clauses: {high_count}")
        y -= 12
        
        c.setFillColor(COLOR_MEDIUM)
        c.drawString(50, y, f"● Medium Risk Clauses: {med_count}")
        y -= 12
        
        c.setFillColor(COLOR_SAFE)
        c.drawString(50, y, f"● Safe Clauses: {safe_count}")
        y -= 12
        
        c.setFillColor(COLOR_INK)
        c.drawString(50, y, f"● Total Clauses: {len(clauses)}")
        y -= 30
        
        # ─── CLAUSES TABLE ────────────────────────────────
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(COLOR_INK)
        c.drawString(40, y, "Detailed Clause Analysis")
        y -= 20
        
        # Table headers
        c.setFont("Helvetica-Bold", 9)
        c.drawString(40, y, "ID")
        c.drawString(70, y, "Type")
        c.drawString(220, y, "Risk")
        c.drawString(300, y, "Status")
        y -= 12
        
        # Separator line
        c.setStrokeColor(HexColor("#e2d9c8"))
        c.setLineWidth(0.5)
        c.line(40, y, 570, y)
        y -= 8
        
        # ─── CLAUSES LIST ─────────────────────────────────
        c.setFont("Helvetica", 9)
        
        for idx, clause in enumerate(clauses, start=1):
            if y < 80:  # New page if too close to bottom
                c.showPage()
                y = height - 40
            
            clause_id = clause.get("id", idx)
            clause_type = clause.get("type", "General")
            risk = clause.get("risk", "unknown")
            
            # Risk color
            if risk == "high":
                color = COLOR_HIGH
            elif risk == "medium":
                color = COLOR_MEDIUM
            else:
                color = COLOR_SAFE
            
            # Draw row
            c.setFillColor(color)
            c.drawString(40, y, f"{clause_id}")
            c.drawString(70, y, clause_type[:20])
            c.drawString(220, y, risk.upper())
            c.drawString(300, y, "⚠" if risk == "high" else ("!" if risk == "medium" else "✓"))
            
            y -= 12
        
        y -= 15
        
        # ─── FOOTER ───────────────────────────────────────
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#7a7265"))
        c.drawString(40, 20, "LegalEase AI – Urdu Legal Document Assistant for Pakistani Citizens")
        c.drawString(width - 100, 20, f"Page 1")
        
        # Save PDF
        c.save()
        
        # Read PDF as bytes
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        
        return pdf_bytes
        
    finally:
        # Clean up
        if os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
            except:
                pass