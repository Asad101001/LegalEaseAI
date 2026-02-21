"""
Test script for LegalEase AI Backend API
Tests all endpoints with sample data
"""

import requests
import json
import time
from pathlib import Path

BASE_URL = "http://localhost:8000"

# Color codes for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
END = "\033[0m"

def print_section(title):
    print(f"\n{BLUE}{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}{END}\n")

def print_success(msg):
    print(f"{GREEN}✓ {msg}{END}")

def print_error(msg):
    print(f"{RED}✗ {msg}{END}")

def print_warning(msg):
    print(f"{YELLOW}⚠ {msg}{END}")

def test_health():
    """Test health check endpoint"""
    print_section("1. HEALTH CHECK")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print_success("Health check endpoint is running")
            print(json.dumps(response.json(), indent=2))
            return True
        else:
            print_error(f"Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Could not connect to backend: {e}")
        return False

def test_analyze():
    """Test document analysis endpoint"""
    print_section("2. DOCUMENT ANALYSIS")
    
    # Create a sample legal document
    sample_doc = """RENTAL AGREEMENT

1. TERMINATION: The landlord reserves the right to terminate this agreement with 7 days written notice for any reason deemed appropriate by the landlord at their sole discretion.

2. PAYMENT AND PENALTY: Late payment of monthly rent shall incur a financial penalty of five percent (5%) per week on the outstanding amount, compounded on a monthly basis.

3. MAINTENANCE: The landlord shall remain solely responsible for all structural repairs and general maintenance where the cost thereof exceeds Pakistani Rupees Ten Thousand (PKR 10,000).

4. ARBITRATION: Any disputes arising under this agreement shall be submitted exclusively to binding arbitration. The tenant hereby waives the right to pursue matters through civil courts of law.

5. LIABILITY WAIVER: The landlord shall not be held liable for any damages to the tenant's personal property arising from structural defects, water leaks, electrical failures, or utility disruptions.

6. RENT INCREASE: The landlord reserves the right to increase the monthly rent by up to fifteen percent (15%) annually, with thirty (30) days advance written notice to the tenant.

7. SUBLETTING: The tenant is strictly prohibited from subletting or sharing the premises with any third party without obtaining prior written consent from the landlord.

8. SECURITY DEPOSIT: A security deposit equivalent to two (2) months rent shall be retained by the landlord and returned within sixty (60) days of vacating, subject to deductions for damages.
"""
    
    # Write sample document to temporary file
    sample_file_path = "sample_agreement.txt"
    with open(sample_file_path, "w", encoding="utf-8") as f:
        f.write(sample_doc)
    
    try:
        with open(sample_file_path, "rb") as f:
            files = {"file": ("sample_agreement.txt", f, "text/plain")}
            response = requests.post(f"{BASE_URL}/api/analyze", files=files)
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Analysis completed successfully")
            print(f"  Document ID: {data['document_id']}")
            print(f"  Document Name: {data['document_name']}")
            print(f"  Total Clauses: {data['summary']['total_clauses']}")
            print(f"  High Risk: {data['summary']['high_risk']}")
            print(f"  Medium Risk: {data['summary']['medium_risk']}")
            print(f"  Safe: {data['summary']['safe_risk']}")
            print(f"\n  Sample Clause:")
            if data['clauses']:
                clause = data['clauses'][0]
                print(f"    ID: {clause['id']}")
                print(f"    Type: {clause['type']}")
                print(f"    Risk: {clause['risk']}")
                print(f"    Original: {clause['original'][:100]}...")
                print(f"    Urdu: {clause['urdu'][:100]}...")
            
            return data.get("document_id"), True
        else:
            print_error(f"Analysis failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None, False
    except Exception as e:
        print_error(f"Error during analysis: {e}")
        return None, False
    finally:
        # Clean up
        if Path(sample_file_path).exists():
            Path(sample_file_path).unlink()

def test_qa(document_id):
    """Test Q&A endpoint"""
    print_section("3. QUESTION & ANSWER")
    
    if not document_id:
        print_warning("Skipping Q&A test (no document_id)")
        return False
    
    questions = [
        "What happens if I pay rent late?",
        "کیا مالک مکان مجھے بغیر وجہ نکال سکتا ہے؟",
    ]
    
    try:
        for i, question in enumerate(questions, 1):
            print(f"\n  Question {i}: {question}")
            
            response = requests.post(
                f"{BASE_URL}/api/qa",
                json={
                    "question": question,
                    "document_id": document_id
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("Q&A processed successfully")
                print(f"    EN: {data.get('answer_en', 'N/A')[:100]}...")
                print(f"    UR: {data.get('answer_ur', 'N/A')[:100]}...")
                print(f"    Source: {data.get('source_clause', 'N/A')}")
                print(f"    Confidence: {data.get('confidence', 0):.2f}")
            else:
                print_error(f"Q&A failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
        
        return True
    except Exception as e:
        print_error(f"Error during Q&A: {e}")
        return False

def test_report(document_id):
    """Test PDF report generation"""
    print_section("4. PDF REPORT GENERATION")
    
    if not document_id:
        print_warning("Skipping report test (no document_id)")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/report/{document_id}",
            stream=True
        )
        
        if response.status_code == 200:
            file_path = "test_report.pdf"
            with open(file_path, "wb") as f:
                f.write(response.content)
            
            file_size = Path(file_path).stat().st_size
            print_success(f"PDF report generated successfully")
            print(f"  File: {file_path}")
            print(f"  Size: {file_size} bytes")
            
            # Clean up
            Path(file_path).unlink()
            return True
        else:
            print_error(f"Report generation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error during report generation: {e}")
        return False

def main():
    print(f"\n{BLUE}{'='*60}")
    print("  LegalEase AI Backend API - Integration Tests")
    print(f"{'='*60}{END}\n")
    
    print(f"Testing backend at: {BASE_URL}\n")
    
    # Test 1: Health check
    if not test_health():
        print_error("Cannot connect to backend. Make sure it's running with: uvicorn main:app --reload --port 8000")
        return
    
    # Test 2: Document analysis
    document_id, success = test_analyze()
    if not success:
        print_error("Document analysis failed. See error above.")
        return
    
    # Wait a bit before Q&A (Gemini API might need time)
    print(f"\n{YELLOW}Waiting 2 seconds before Q&A test...{END}")
    time.sleep(2)
    
    # Test 3: Q&A
    if not test_qa(document_id):
        print_error("Q&A test failed")
    
    # Test 4: Report
    if not test_report(document_id):
        print_error("Report generation failed")
    
    print_section("SUMMARY")
    print_success("All tests completed! ✓")
    print(f"\n{BLUE}Next steps:{END}")
    print("1. The frontend should now work with this backend")
    print("2. Upload a document through the frontend's home page")
    print("3. Review the analysis in the Analysis page")
    print("4. Ask questions in the Q&A page")
    print("5. Download the PDF report\n")

if __name__ == "__main__":
    main()
