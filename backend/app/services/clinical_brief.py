import json
import requests
from app.config import settings

def generate_clinical_brief(
    records_data: list, 
    specialty: str = "General",
    summary_type: str = "complete",
    disease_focus: str = None,
    current_visit_reason: str = None
) -> dict:
    """
    Leverages NVIDIA NIM API to reason over the patient's longitudinal record history
    and generate a context-aware clinical summary, relevance classifications, 
    citations, and allergy/conflict warnings.
    """
    if not settings.NVIDIA_API_KEY:
        raise ValueError("NVIDIA_API_KEY is not configured in settings.")

    # Serialize record data for prompt context
    records_context = []
    for r in records_data:
        records_context.append({
            "record_id": r["id"],
            "record_type": r["record_type"],
            "date": r["date"],
            "parsed_json": r["parsed_json"]
        })

    records_json_str = json.dumps(records_context, indent=2)

    prompt = f"""
    You are an expert Clinical Decision Support System (CDSS) assistant. 
    Analyze this patient's longitudinal medical records and compile a context-aware clinical summary for a visiting doctor.

    ### Target Summary Configuration:
    - Summary Mode: {summary_type}
      (Modes available:
       - 'current_visit': Focus only on details matching the Reason for Current Visit.
       - 'disease': Focus on the longitudinal history of the Disease/Condition focus.
       - 'specialty': Focus on conditions relevant to the Target Specialty.
       - 'longitudinal': Focus on how conditions developed, progressed, or resolved over time.
       - 'recent': Focus primarily on recent events (e.g. latest records).
       - 'emergency': Focus strictly on critical warnings, allergies, active medications, and acute conditions.
       - 'complete': General summary of all historical records.)
    
    - Target Specialty: {specialty}
    - Disease/Condition Focus: {disease_focus if disease_focus else 'None'}
    - Reason for Current Visit: {current_visit_reason if current_visit_reason else 'None'}
    
    ### Medical History JSON Context:
    {records_json_str}

    ### Output Schema Requirements:
    Your output MUST be a single structured JSON object matching this schema. Do not include markdown code block wrappers (e.g. ```json) or any surrounding text.

    JSON Schema:
    {{
        "specialty": "String",
        "summary_type": "String",
        "clinical_summary": "String (A high-level paragraph summarizing only the clinically relevant history based on the summary configuration)",
        "active_problems": [
            "String (A bulleted list of active problems, e.g., 'Hypertension diagnosed on 2025-06-10 [Record #1]')"
        ],
        "current_medications": [
            {{
                "name": "String",
                "dosage": "String",
                "frequency": "String",
                "source": "String"
            }}
        ],
        "warnings": [
            {{
                "type": "Allergy Alert" | "Medication Conflict" | "Duplicate Treatment" | "Other",
                "message": "String"
            }}
        ],
        "treatment_gaps": [
            "String"
        ],
        "relevance_metrics": [
            {{
                "record_id": number,
                "record_title": "String (e.g., 'Prescription by Dr. Rahul Pathak (2022-02-22)')",
                "relevance": "High" | "Low",
                "explanation": "String (Clinical justification. E.g. 'Included because this HbA1c test is part of the patient's ongoing diabetes monitoring.' or 'Excluded because a resolved sore throat from 2024 has no clinical connection to the current cardiology visit.')"
            }}
        ]
    }}

    ### Strict Clinical Guidance:
    1. Relevance Classifications:
       - You MUST classify EVERY record in the provided context inside the `relevance_metrics` list.
       - If a record is relevant to the selected mode/specialty/disease, mark it as `"High"`.
       - If a record represents a resolved minor episode (e.g., a simple cold/fever from months ago) and has no connection to the current visit, mark it as `"Low"` and explain why it was excluded.
       - If an older record (e.g. fever) is connected to a later diagnosis (e.g. typhoid), mark it as `"High"` because it represents disease progression.
    2. Maintain citations: Every active problem, warning, and current medication entry MUST reference the source Record ID in brackets (e.g. `[Record #3]`).
    3. Cross-record validation:
       - Check for drug-allergy interactions.
       - Check for duplicate therapeutic classes.
    """

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "meta/llama-3.1-8b-instruct",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 2048,
        "top_p": 0.7
    }

    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 200:
        raise ValueError(f"NVIDIA NIM API error (status {response.status_code}): {response.text}")

    response_json = response.json()
    response_text = response_json["choices"][0]["message"]["content"]

    try:
        cleaned_text = response_text.strip()
        # Find outermost JSON object
        start_idx = cleaned_text.find('{')
        end_idx = cleaned_text.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned_text = cleaned_text[start_idx:end_idx+1]
        
        brief_data = json.loads(cleaned_text.strip())
        return brief_data
    except Exception as e:
        raise ValueError(f"Failed to parse NVIDIA NIM response as JSON: {str(e)}. Raw content: {response_text}")
