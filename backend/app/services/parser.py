import json
import base64
import io
import re
import requests
from pypdf import PdfReader
from app.config import settings

def clean_and_parse_json(text: str) -> dict:
    cleaned = text.strip()
    
    # Try regex match for ```json ... ```
    json_match = re.search(r'```json\s*(\{.*?\})\s*```', cleaned, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1).strip(), strict=False)
        except Exception:
            pass

    # Try regex match for ``` ... ```
    json_match = re.search(r'```\s*(\{.*?\})\s*```', cleaned, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1).strip(), strict=False)
        except Exception:
            pass

    # Try finding outer braces
    start_idx = cleaned.find('{')
    end_idx = cleaned.rfind('}')
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        try:
            return json.loads(cleaned[start_idx:end_idx+1].strip(), strict=False)
        except Exception:
            pass

    # Fallback to direct parse
    return json.loads(cleaned, strict=False)

def parse_medical_document(file_bytes: bytes, mime_type: str) -> dict:
    """
    Sends medical report image/PDF bytes to NVIDIA NIM API (Llama 3.2 Vision or Llama 3.1)
    to perform parsing and extract structured clinical entities.
    """
    if not settings.NVIDIA_API_KEY:
        raise ValueError("NVIDIA_API_KEY is not configured in settings.")

    prompt = """
    You are an expert clinical medical scribe and handwriting OCR expert specialized in transcribing handwritten doctor prescriptions and medical records.
    Your task is to analyze the medical document image and extract all clinical details into a single structured JSON object.

    ### CRITICAL HANDWRITING & OCR INSTRUCTIONS:
    1. Look closely at cursive script. In Indian prescriptions:
       - Tab/Caps/Syr/Inj/Gargle refer to Tablet, Capsule, Syrup, Injection, Gargle.
       - Common abbreviations for frequency:
         - OD: Once daily
         - BD/BID: Twice daily (every 12 hours)
         - TDS/TID: Three times daily (every 8 hours)
         - QDS/QID: Four times daily
         - HS: At bedtime
         - PRN: As needed
         - AC: Before food
         - PC: After food
       - Common Indian ENT/General medications include: Montair-LC, Centric-L, Dolo, Paracetamol, Amoxicillin (Amox), Cefuroxime, Betadine, Fluticasone.
    2. Do NOT confuse patient names, relative descriptions (e.g., "relatives"), or clinical instructions (e.g., "avoid cold food") with diagnoses or medication names!
    3. Look for the "Rx" symbol which starts the medication list.
    4. Diagnoses are usually written near the top left under the patient's name, often preceded by "Dx", "C/O" (complains of), or written as "Ch." (chronic), e.g. "Ch. Allergic Rhinitis".

    ### FEW-SHOT MEDICAL HANDWRITING EXAMPLE:
    If the prescription has the header "Dr. K.L. Pathak Memorial Pathak Clinic" and is written for "Mr. Arnav":
    - Hospital Name: "Dr. K.L. Pathak Memorial Pathak Clinic & Nursing Home"
    - Doctor Name: "Dr. Rahul Pathak" (or "Dr. V.A.K. Pathak")
    - Date: "2022-02-22" (from "22-2-22")
    - Diagnoses: ["Chronic Allergic Rhinitis", "Granular Pharyngitis"]
    - Medications:
      - Name: "Centric-L", Dosage: "1 tablet", Frequency: "At bedtime (HS)", Duration: "10 days"
      - Name: "Lozzy", Dosage: "1 lozenge", Frequency: "Three times daily (TDS)", Duration: "5 days"
      - Name: "Amox-Clav", Dosage: "1 capsule", Frequency: "Twice daily (BD)", Duration: "5 days"
      - Name: "Betadine Gargle", Dosage: "Gargle", Frequency: "Twice daily (BD)", Duration: "Continuous"
      - Name: "Fluticasone Nasal Spray", Dosage: "1 puff", Frequency: "Twice daily (BD)", Duration: "Continuous"
    - Allergies: []
    - Surgery Advised: false

    Return ONLY a JSON object matching this schema. Do not include any markdown wrappers or conversational text. If a field is not found in the document, set it to null or an empty list.

    JSON Schema:
    {
        "record_type": "Prescription" | "Lab Report" | "Discharge Summary" | "Other",
        "date": "YYYY-MM-DD" (extracted date of the visit/report),
        "hospital_name": "String or null",
        "doctor_name": "String or null",
        "diagnoses": ["String" (list of active medical conditions/diagnoses)],
        "medications": [
            {
                "name": "String (medicine name)",
                "dosage": "String (e.g., 500mg)",
                "frequency": "String (e.g., Once daily, BD, TDS, before food)",
                "duration": "String (e.g., 14 days, continuous)"
            }
        ],
        "lab_results": [
            {
                "test_name": "String (e.g., HbA1c, Creatinine)",
                "result": "String or number (e.g., 7.8, 1.2)",
                "unit": "String (e.g., %, mg/dL)",
                "reference_range": "String (e.g., 4.0-5.6)"
            }
        ],
        "allergies": ["String" (any drug or substance allergies recorded)],
        "surgery_advised": true | false,
        "procedure_details": {
            "name": "String or null (e.g., Total Knee Replacement)",
            "estimated_cost": number or null,
            "hospital": "String or null",
            "admission_date": "String (YYYY-MM-DD) or null"
        }
    }
    """

    extracted_text = ""
    is_pdf = "pdf" in mime_type.lower()

    if is_pdf:
        try:
            pdf_file = io.BytesIO(file_bytes)
            reader = PdfReader(pdf_file)
            for page in reader.pages:
                extracted_text += page.extract_text() or ""
        except Exception as e:
            print(f"Failed to extract PDF text digitally: {str(e)}")

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }

    # If it is a PDF and has extracted text, send it to the text model Llama 3.1 8B
    if is_pdf and len(extracted_text.strip()) > 50:
        payload = {
            "model": "meta/llama-3.1-8b-instruct",
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Here is the text extracted from the medical PDF document:\n\n{extracted_text}"}
            ],
            "temperature": 0.2,
            "max_tokens": 2048,
            "top_p": 0.7
        }
    else:
        # Otherwise, treat it as an image (or scanned document) and send to Llama 3.2 Vision
        # (NVIDIA NIM meta/llama-3.2-11b-vision-instruct requires base64 format for image_url)
        base64_data = base64.b64encode(file_bytes).decode("utf-8")
        
        # If the file was a scanned PDF with no text, we default the vision mime-type to image/jpeg for the model
        final_mime = "image/jpeg" if is_pdf else mime_type

        payload = {
            "model": "meta/llama-3.2-11b-vision-instruct",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt + "\n\nIMPORTANT: You must output ONLY a JSON object. Do not output any conversational introductions, summaries, or descriptions. Start with '{' and end with '}'."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{final_mime};base64,{base64_data}"
                            }
                        }
                    ]
                }
            ],
            "temperature": 0.2,
            "max_tokens": 2048
        }

    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 200:
        raise ValueError(f"NVIDIA NIM parser API error (status {response.status_code}): {response.text}")

    response_json = response.json()
    response_text = response_json["choices"][0]["message"]["content"]

    try:
        parsed_data = clean_and_parse_json(response_text)
        return parsed_data
    except Exception as e:
        print(f"Initial JSON parse failed. Invoking Llama-3.1-8b formatting fallback. Error: {str(e)}")
        # Double-agent fallback: use Llama 3.1 8B text model to format the transcription to JSON
        try:
            fallback_payload = {
                "model": "meta/llama-3.1-8b-instruct",
                "messages": [
                    {
                        "role": "system", 
                        "content": "You are a JSON formatter. Parse the provided medical document transcription and output a single structured JSON object matching the requested schema. Do not include markdown code block wrappers or other conversational text."
                    },
                    {
                        "role": "user", 
                        "content": f"Schema:\n{prompt}\n\nDocument Transcription:\n{response_text}"
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 2048
            }
            fallback_res = requests.post(url, headers=headers, json=fallback_payload)
            if fallback_res.status_code == 200:
                fallback_text = fallback_res.json()["choices"][0]["message"]["content"]
                return clean_and_parse_json(fallback_text)
        except Exception as fallback_err:
            print(f"Double-agent fallback also failed: {str(fallback_err)}")
        
        # If all else fails, raise the original exception
        raise ValueError(f"Failed to parse NVIDIA NIM response as JSON: {str(e)}. Raw response: {response_text}")

def extract_insurer_email_from_text(text: str) -> str:
    if not text:
        return None
    # Find all email patterns
    email_matches = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text)
    if not email_matches:
        return None
        
    # Check each email for provider-like keywords in the email itself
    provider_keywords = ["insurance", "care", "support", "tpa", "claim", "wellness", "info", "customer", "starhealth", "maxlife", "religare", "icici", "hdfc", "lic", "service", "provider"]
    for email in email_matches:
        email_lower = email.lower()
        if any(kw in email_lower for kw in provider_keywords):
            return email
            
    # As a secondary fallback, search the lines around the emails for provider context
    lines = text.split("\n")
    for idx, line in enumerate(lines):
        line_lower = line.lower()
        for email in email_matches:
            if email in line:
                # check context of this line and neighboring lines
                context_lines = []
                if idx > 0:
                    context_lines.append(lines[idx-1].lower())
                context_lines.append(line_lower)
                if idx < len(lines) - 1:
                    context_lines.append(lines[idx+1].lower())
                    
                context_text = " ".join(context_lines)
                if any(kw in context_text for kw in ["insurer", "provider", "insurance", "tpa", "company", "claims", "wellness", "support", "contact"]):
                    return email
                    
    return None

def parse_insurance_document(file_bytes: bytes, mime_type: str) -> dict:
    """
    Sends health insurance policy document PDF/image bytes to NVIDIA NIM API
    to parse and extract structured policy information.
    """
    if not settings.NVIDIA_API_KEY:
        raise ValueError("NVIDIA_API_KEY is not configured in settings.")

    prompt = """
    You are an expert insurance policy auditor. Analyze the provided health insurance policy document (image or text) and extract all relevant policy details into a single structured JSON object.

    ### CRITICAL INSTRUCTIONS:
    1. Do NOT invent/hallucinate any information that is not present in the document.
    2. If a field cannot be found or is not present in the document, set it to null.
    3. Do NOT guess or create placeholder/dummy values.
    4. For sum_insured or coverage amounts, extract it as a numeric float value.
    5. For checkups_per_year, extract it as an integer value.
    6. For dates (start_date, end_date), preserve them as text (preferably YYYY-MM-DD or DD-MM-YYYY format as found).

    Return ONLY a JSON object matching this schema. Do not include any conversational text or markdown wrappers.

    JSON Schema:
    {
        "record_type": "INSURANCE_POLICY",
        "insurer": "String or null (Insurance company/provider name, e.g. Star Health, Max Life, Religare, etc.)",
        "insurer_email": "String or null (Insurance company contact or customer care email address, e.g. customercare@starhealth.in)",
        "policy_number": "String or null (Policy number)",
        "policyholder_name": "String or null (Policyholder / Proposer name)",
        "patient_name": "String or null (Patient / Insured member name)",
        "member_id": "String or null (Member ID or Customer ID)",
        "policy_type": "String or null (Plan name / policy type, e.g. Family Floater, Individual Health Plan, Optima Restore)",
        "start_date": "String or null (Policy inception/start date)",
        "end_date": "String or null (Policy expiry/end date)",
        "sum_insured": "number or null (Sum insured / coverage limit)",
        "preventive_eligible": "boolean or null (True if document mentions covered/free annual checkups or preventive health checkups, False if explicitly not covered, or null if not mentioned)",
        "checkups_per_year": "number or null (Number of free/covered preventive checkups per year, or null)",
        "benefits_coverage": ["String" (list of key benefits or coverage highlights extracted from the policy)],
        "conditions_limitations": ["String" (list of notable exclusions, copayments, waiting periods, or limits)]
    }
    """

    extracted_text = ""
    is_pdf = "pdf" in mime_type.lower()

    if is_pdf:
        try:
            pdf_file = io.BytesIO(file_bytes)
            reader = PdfReader(pdf_file)
            for page in reader.pages:
                extracted_text += page.extract_text() or ""
        except Exception as e:
            print(f"Failed to extract PDF text digitally: {str(e)}")

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }

    if is_pdf and len(extracted_text.strip()) > 50:
        payload = {
            "model": "meta/llama-3.1-8b-instruct",
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Here is the text extracted from the insurance PDF document:\n\n{extracted_text}"}
            ],
            "temperature": 0.1,
            "max_tokens": 2048,
            "top_p": 0.7
        }
    else:
        base64_data = base64.b64encode(file_bytes).decode("utf-8")
        final_mime = "image/jpeg" if is_pdf else mime_type

        payload = {
            "model": "meta/llama-3.2-11b-vision-instruct",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt + "\n\nIMPORTANT: You must output ONLY a JSON object. Do not output any conversational introductions. Start with '{' and end with '}'."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{final_mime};base64,{base64_data}"
                            }
                        }
                    ]
                }
            ],
            "temperature": 0.1,
            "max_tokens": 2048
        }

    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 200:
        raise ValueError(f"NVIDIA NIM parser API error (status {response.status_code}): {response.text}")

    response_json = response.json()
    response_text = response_json["choices"][0]["message"]["content"]

    try:
        parsed_data = clean_and_parse_json(response_text)
        if isinstance(parsed_data, dict) and not parsed_data.get("insurer_email"):
            email_val = extract_insurer_email_from_text(extracted_text)
            if email_val:
                parsed_data["insurer_email"] = email_val
        return parsed_data
    except Exception as e:
        print(f"Initial JSON parse failed. Invoking double-agent fallback. Error: {str(e)}")
        try:
            fallback_payload = {
                "model": "meta/llama-3.1-8b-instruct",
                "messages": [
                    {
                        "role": "system", 
                        "content": "You are a JSON formatter. Parse the provided insurance policy transcription and output a single structured JSON object matching the requested schema. Do not include markdown code block wrappers or other conversational text."
                    },
                    {
                        "role": "user", 
                        "content": f"Schema:\n{prompt}\n\nDocument Transcription:\n{response_text}"
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 2048
            }
            fallback_res = requests.post(url, headers=headers, json=fallback_payload)
            if fallback_res.status_code == 200:
                fallback_text = fallback_res.json()["choices"][0]["message"]["content"]
                parsed_data = clean_and_parse_json(fallback_text)
                if isinstance(parsed_data, dict) and not parsed_data.get("insurer_email"):
                    email_val = extract_insurer_email_from_text(extracted_text)
                    if email_val:
                        parsed_data["insurer_email"] = email_val
                return parsed_data
        except Exception as fallback_err:
            print(f"Double-agent fallback also failed: {str(fallback_err)}")
        raise ValueError(f"Failed to parse NVIDIA NIM response as JSON: {str(e)}. Raw response: {response_text}")

