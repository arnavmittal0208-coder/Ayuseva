import json
import re
import requests
from app.config import settings

from app.services.parser import clean_and_parse_json

def clean_and_parse_brief_json(text: str) -> dict:
    try:
        return clean_and_parse_json(text)
    except Exception as e:
        # Fallback: find outermost braces
        cleaned = text.strip()
        start = cleaned.find('{')
        end = cleaned.rfind('}')
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(cleaned[start:end+1], strict=False)
            except:
                pass
        raise ValueError(f"Failed to parse NVIDIA NIM response as JSON: {str(e)}. Raw content:\n{text}")


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
    citations, and allergy/conflict warnings at a fast 14k-gold standard.
    """
    if not settings.NVIDIA_API_KEY:
        raise ValueError("NVIDIA_API_KEY is not configured in settings.")

    # Compact record serialization: retain all clinical entities while removing empty/null boilerplate
    clean_records = []
    for r in records_data:
        pj = r.get("parsed_json") or {}
        compact_pj = {}
        for key in ["diagnoses", "medications", "lab_results", "allergies", "procedure_details"]:
            val = pj.get(key)
            if val:
                compact_pj[key] = val
        clean_records.append({
            "record_id": r.get("id"),
            "record_type": r.get("record_type"),
            "date": r.get("date"),
            "clinical_data": compact_pj
        })

    records_json_str = json.dumps(clean_records, separators=(',', ':'))

    # Mode-specific structural guidance to avoid prompt bloat
    if summary_type == "disease":
        mode_instructions = f"""- Mode: disease-focused on Clinical Context: '{disease_focus or "Active Condition"}'.
- In 'clinical_summary':
  * OVERVIEW: 2-3 concise clinical sentences on the patient's overall status for this condition.
  * CLINICAL PROGRESSION: Chronological list of events/findings/treatments.
  * CURRENT STATUS: Current diagnosis and active medications."""
    elif summary_type == "recent":
        mode_instructions = """- Mode: recent changes.
- In 'clinical_summary':
  * OVERVIEW: 1-2 concise sentences on the most recent clinical modifications.
  * CLINICAL PROGRESSION: Chronological list of recent evaluations."""
    elif summary_type == "current_visit":
        mode_instructions = f"""- Mode: current visit evaluation for reason: '{current_visit_reason or "General Consultation"}'.
- In 'clinical_summary':
  * OVERVIEW: 2-3 concise sentences evaluating the current visit reason against historical context.
  * CLINICAL PROGRESSION: Chronological list of relevant historical milestones."""
    else:  # complete / longitudinal
        mode_instructions = """- Mode: complete longitudinal history.
- In 'clinical_summary':
  * OVERVIEW: 2-3 concise, high-yield clinical sentences covering active diagnoses, key investigation findings, and treatment trajectory.
  * CLINICAL PROGRESSION: Chronological list linking dates, diagnoses, lab investigations with exact numbers/units, and treatment."""

    prompt = f"""You are an expert Clinical Decision Support System (CDSS) assistant.
Compile a professional, concise, 14k-gold standard clinical summary for a visiting doctor from this patient's medical records.

### Target Configuration:
- Specialty: {specialty}
- Summary Mode: {summary_type}
- Clinical Context Focus: {disease_focus or "None"}
- Current Visit Reason: {current_visit_reason or "None"}
{mode_instructions}

### Core Rules:
1. Maintain clinical facts, exact dates, lab numbers/units, diagnoses, and medication names/dosages.
2. Be information-dense, professional, and concise. Avoid unnecessary conversational prose.
3. Every active problem and warning must reference the source Record ID in brackets (e.g. [Record #1]).
4. Classify each record in 'relevance_metrics' with a concise 1-sentence justification.

### Patient Medical Records:
{records_json_str}

### Output Format:
Return ONLY valid JSON matching this schema:
{{
  "specialty": "{specialty}",
  "summary_type": "{summary_type}",
  "clinical_summary": {{
    "OVERVIEW": "2-3 concise sentences synthesizing clinical picture.",
    "CLINICAL PROGRESSION": [
      "- YYYY-MM-DD - Diagnosis/Event [Record #ID]: Key findings & treatment"
    ]{',\\n    "CURRENT STATUS": "Current Diagnosis: ... | Current Medications: ..."' if summary_type == "disease" else ''}
  }},
  "active_problems": ["Problem diagnosed on YYYY-MM-DD [Record #ID]"],
  "current_medications": [
    {{"name": "Medication", "dosage": "Dose", "frequency": "Freq", "source": "[Record #ID]"}}
  ],
  "warnings": [
    {{"type": "Allergy Alert" | "Medication Conflict" | "Duplicate Treatment" | "Other", "message": "Clinical alert text"}}
  ],
  "treatment_gaps": ["Clinical gap or monitoring recommendation"],
  "relevance_metrics": [
    {{"record_id": 1, "record_title": "Title", "relevance": "High" | "Low", "explanation": "Brief justification"}}
  ]
}}"""

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }

    # Dynamic token budgeting based on record count
    dynamic_max_tokens = min(2048, max(900, len(records_data) * 220 + 500))

    payload = {
        "model": "meta/llama-3.2-11b-vision-instruct",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": dynamic_max_tokens,
        "top_p": 0.7
    }

    response = requests.post(url, headers=headers, json=payload, timeout=90)
    if response.status_code != 200:
        raise ValueError(f"NVIDIA NIM API error (status {response.status_code}): {response.text}")

    response_json = response.json()
    response_text = response_json["choices"][0]["message"]["content"]

    return clean_and_parse_brief_json(response_text)
