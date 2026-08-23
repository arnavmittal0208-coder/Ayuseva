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
      (Modes available and their clinical guidance:
       
       - 'complete': Compile a meaningful longitudinal clinical history of the patient.
         * Tell a cohesive, doctor-friendly chronological story showing the progression of active, chronic, or ongoing conditions, AND recent clusters of clinical activity.
         * Prioritize diagnoses, prescriptions, treatment continuation, repeated occurrences, and how events connect over time.
         * Include recent resolved/acute episodes (like a viral fever from 10 days ago) if they occurred close in time to other recent evaluations, as they represent part of the patient's recent clinical story.
         * Omit or de-emphasize minor resolved short-term illnesses only if they are genuinely old (e.g. >3 months ago) and have no connection to current care.
         * Structure the `clinical_summary` chronologically, listing each key event with its date, findings, and treatment. E.g.:
           - [Date] — [Event/Diagnosis]: [Key Findings & Treatment]
           Followed by a paragraph summarizing the patient's overall clinical progression.
           Ensure the level of detail is dynamically adjusted: simple cases are concise, while complex longitudinal cases are fully detailed.

       - 'recent': Summarize what has recently changed in the patient's care.
         * Highlight recent diagnoses, updated prescriptions, new lab results, recent physician visits, and medication modifications.
         * Do not use a strict date cutoff (like 'last 15 days'); rather, combine chronological recency with clinical relevance (e.g., a medication dose change 30 days ago is highly relevant, whereas a resolved minor complaint 10 days ago is not).
         * Provide sufficient detail for complex changes, and keep simple updates brief.

       - 'disease': Focus strictly on the longitudinal history of the selected Clinical Context: {disease_focus if disease_focus else 'None'}.
         * Structure the `clinical_summary` chronologically using these sections:
           
           [Disease/Condition Name] SUMMARY
           
           Overview
           [A dynamic, case-dependent synthesis of the patient's overall condition and progression. Do NOT enforce a fixed word count or sentence limit. For simple cases, keep it to 2-3 concise sentences summarizing status. For complex cases with multiple records, diagnoses, medications, lab investigations, or clinical progression, expand the overview into a moderately longer, detail-rich clinical synthesis (e.g. 1-2 robust paragraphs) summarizing diagnostic findings, treatment changes, and the overall trajectory of the condition. Focus on summarizing the overall case rather than repeating just a single record, highlighting key clinical landmarks. Keep it practical, clinical, and factual without inventing any information.]
           
           CLINICAL PROGRESSION
           - [Date] — [Event/Diagnosis/Treatment]: [Detailed key findings, test results, diagnoses, or prescriptions from that record.]
           - [Date] — [Event/Diagnosis/Treatment]: [Details from subsequent records showing the progression/treatment.]
           
           CURRENT STATUS
           * Current Diagnosis: [Diagnosis name as per records]
           * Current Medications: [Active medications with doses/frequencies]
           
         * Include ALL records provided in the context; do not focus only on the latest prescription record. Chronologically link them from initial diagnostic evaluation to follow-up/treatment.
         * Do not invent information; do not say the condition is "long-standing" unless records explicitly state this.
      )
    
    - Target Specialty: {specialty}
    - Selected Clinical Context: {disease_focus if disease_focus else 'None'}
    - Reason for Current Visit: {current_visit_reason if current_visit_reason else 'None'}

    The JSON below contains the records to be processed. Do not invent other conditions. Everything in the summary must come from the actual records.
    
    ### Clinical Overview Generation Principles:
    - **Dynamic Case-Dependent Length**: Do NOT enforce a fixed word count, character limit, or fixed number of sentences. Adjust length based on case complexity.
    - **Concise vs. Detailed**: 
      * For a simple or limited clinical case, keep the summary highly concise (e.g. 2-3 sentences) focusing on key diagnostic findings and treatment.
      * For a complex clinical case with multiple records, diagnoses, medications, procedures, or ongoing progression, allow the summary to scale dynamically and become moderately longer (e.g. 1-2 detail-rich paragraphs) to convey a complete longitudinal picture. Avoid making it unnecessarily verbose.
    - **Synthesize Overall Case**: Summarize the overall case and clinical landmarks rather than repeating only one document.
    - **Factual Integrity**: Do not invent facts or assume timelines (e.g. "long-standing") unless explicitly documented in the records.
    
    ### Medical History JSON Context:
    {records_json_str}

    ### Output Schema Requirements:
    Your output MUST be a single structured JSON object matching this schema. Do not include markdown code block wrappers (e.g. ```json) or any surrounding text.

    JSON Schema:
    {{
        "specialty": "String",
        "summary_type": "String",
        "clinical_summary": "String (A clinically relevant synthesis of the patient's medical history, overview, progression, symptoms, laboratory/imaging findings, treatments, and procedures. This must follow the 'Clinical Overview Generation Principles' dynamically: concise for simple cases, and moderately detailed for complex cases, ensuring a doctor can understand the overall clinical picture without opening every document.)",
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
       - If Mode is 'complete':
         * Mark a record as 'High' if it represents a chronic or ongoing condition (e.g. Diabetes, Hypertension), or if it is part of a recent cluster of clinical activity (e.g. occurring close in time to other recent records, even if it is a resolved viral fever/symptom).
         * Mark a record as 'Low' ONLY if it is an isolated, resolved episode from a long time ago (e.g. >3 months ago) with no recurrence or current clinical connection.
       - If Mode is 'disease':
         * Mark a record as 'High' if it is directly relevant to the selected context.
       - If Mode is 'recent':
         * Mark a record as 'High' if it represents a recent change, prescription, or visit.
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
        
        # Clean common LLM formatting issues (e.g. multiline strings quoted with backticks)
        import re
        def replace_backtick_string(match):
            content = match.group(1)
            content_escaped = content.replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r')
            return f': "{content_escaped}"'
        cleaned_text = re.sub(r':\s*`([^`]*)`', replace_backtick_string, cleaned_text)
        
        brief_data = json.loads(cleaned_text.strip(), strict=False)
        return brief_data
    except Exception as e:
        raise ValueError(f"Failed to parse NVIDIA NIM response as JSON: {str(e)}. Raw content: {response_text}")
