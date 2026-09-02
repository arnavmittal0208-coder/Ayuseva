import json
import requests
from app.config import settings

def analyze_cashless_claim_context(
    patient_data: dict,
    policy_data: dict,
    records_data: list,
    clinical_context: str
) -> dict:
    """
    Leverages NVIDIA NIM API to reason over the patient's EMR history and insurance policy
    to identify relevant records, check policy details, and scaffold a pre-authorization form.
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
    
    policy_json_str = json.dumps({
        "insurer": policy_data.get("insurer"),
        "policy_number": policy_data.get("policy_number"),
        "policyholder_name": policy_data.get("policyholder_name"),
        "patient_name": policy_data.get("patient_name"),
        "member_id": policy_data.get("member_id"),
        "policy_type": policy_data.get("policy_type"),
        "sum_insured": policy_data.get("sum_insured"),
        "benefits_coverage": policy_data.get("benefits_coverage"),
        "conditions_limitations": policy_data.get("conditions_limitations")
    }, indent=2)

    prompt = f"""
    You are an expert health insurance claims analyst and clinical auditor.
    Your task is to analyze the patient's medical records and active insurance policy to prepare a cashless/pre-authorization claim specifically for the selected clinical context: "{clinical_context}".

    ### INPUT DATA:
    1. Patient Demographics:
       - Name: {patient_data.get("name")}
       - Local UID: {patient_data.get("id")}
       - DOB: {patient_data.get("dob")}
       - Phone: {patient_data.get("phone")}

    2. Active Insurance Policy:
       {policy_json_str}

    3. Patient EMR Records:
       {records_json_str}

    ### EXPLICIT BOUNDARY / RELEVANCE INSTRUCTIONS:
    - You must evaluate every EMR record for relevance to the selected clinical context "{clinical_context}".
    - Mark relevance as "High" ONLY if the record is directly related to the selected context (e.g. diagnosis, doctor prescription, surgery estimate, lab/scan related to this treatment episode).
    - Mark relevance as "Low" if the record is unrelated (e.g., if the context is "Brain Surgery / Major Accident", then records of an old diabetes checkup or eye prescription from months ago are unrelated).
    - Provide a short, clinical explanation for each record's relevance classification.

    ### POLICY ELIGIBILITY CHECK:
    - Inspect the policy terms (coverage benefits, exclusions, limits, waiting periods) and check how they apply to the selected context.
    - Provide an eligibility assessment status: select exactly one of: `Appears Eligible`, `Needs Review`, `Potentially Excluded`, `Missing Information`, `Missing Document`, `Coverage/Limit Concern`.
    - Extract relevant coverage summary details, and highlight any exclusions, sub-limits, co-pays or waiting periods relevant to this procedure/treatment.
    - List any required pre-authorisation documents mentioned in the policy (e.g. "Identity Proof", "Estimate Sheet").

    ### MISSING INFORMATION CHECK:
    - Identify what critical clinical or financial information is missing from the EMR records to complete a cashless claim for this context (e.g., if estimated cost is missing, if admission date is missing, if radiology report is missing).
    - Do NOT say information is present if it is not in the records.

    ### FORM PREPARATION:
    - Extract fields from actual records to pre-fill the claim form.
    - For `diagnosis`, extract the clinical diagnosis related to this context.
    - For `treatment_procedure`, extract the advised procedure/treatment name (e.g. "Craniotomy", "Knee Replacement").
    - For `admission_date` and `estimated_cost`, extract them if they are found in the record (e.g. in a surgery estimate record). If they are not found in any record, set them to "Not available in current records". Do NOT invent them!
    - Provide a brief summary of `clinical_findings` supporting the claim.

    ### EMAIL PREVIEW:
    - Generate a professional covering email to the insurer.
    - The recipient should be the insurer's email: {policy_data.get("insurer_email") or "Not available in current records"}.
    - Subject should follow this format: "Pre-Auth Cashless Claim Request [AyuSeva] - [Procedure Name] - [Patient UID]".
    - Body should be professional and summarize patient, policy, treatment, estimated cost, and list of attached documents.

    ### OUTPUT SCHEMA:
    Return ONLY a single JSON object matching this schema. Do not include markdown code block wrappers (e.g. ```json) or any surrounding text.

    JSON Schema:
    {{
        "relevant_records": [
            {{
                "record_id": number,
                "relevance": "High" | "Low",
                "explanation": "String (clinical justification)"
            }}
        ],
        "policy_check": {{
            "status": "Appears Eligible" | "Needs Review" | "Potentially Excluded" | "Missing Information" | "Missing Document" | "Coverage/Limit Concern",
            "coverage_summary": "String",
            "exclusions_found": ["String" (any relevant exclusions, sub-limits, copays, or waiting periods)],
            "required_documents": ["String"]
        }},
        "missing_info": [
            "String (e.g., 'Proposed admission date not found', 'Surgery estimate sheet missing')"
        ],
        "cashless_form": {{
            "diagnosis": "String",
            "treatment_procedure": "String",
            "admission_date": "String (YYYY-MM-DD or 'Not available in current records')",
            "estimated_cost": "number or 'Not available in current records'",
            "clinical_findings": "String (clinical findings summary)"
        }},
        "email_preview": {{
            "recipient": "String",
            "subject": "String",
            "body": "String"
        }}
    }}
    """

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "meta/llama-3.2-11b-vision-instruct",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 2500,
        "top_p": 0.7
    }

    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 200:
        raise ValueError(f"NVIDIA NIM API error (status {response.status_code}): {response.text}")

    response_json = response.json()
    response_text = response_json["choices"][0]["message"]["content"]

    try:
        cleaned_text = response_text.strip()
        start_idx = cleaned_text.find('{')
        end_idx = cleaned_text.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned_text = cleaned_text[start_idx:end_idx+1]
        
        # Clean common LLM formatting issues
        import re
        def replace_backtick_string(match):
            content = match.group(1)
            content_escaped = content.replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r')
            return f': "{content_escaped}"'
        cleaned_text = re.sub(r':\s*`([^`]*)`', replace_backtick_string, cleaned_text)
        
        return json.loads(cleaned_text.strip(), strict=False)
    except Exception as e:
        raise ValueError(f"Failed to parse NVIDIA NIM response as JSON: {str(e)}. Raw content: {response_text}")

def extract_meaningful_condition_name(parsed_doc: dict) -> str:
    if not parsed_doc:
        return "Medical Episode"
        
    # 1. Check diagnoses list
    diagnoses = parsed_doc.get("diagnoses")
    if isinstance(diagnoses, list) and diagnoses:
        clean_diag = [str(d).strip() for d in diagnoses if d and str(d).strip()]
        if clean_diag:
            return simplify_clinical_name(clean_diag[0])
            
    # 2. Check procedure name
    proc_details = parsed_doc.get("procedure_details") or {}
    if isinstance(proc_details, dict) and proc_details.get("name"):
        return simplify_clinical_name(str(proc_details.get("name")))
        
    # 3. Check medications
    meds = parsed_doc.get("medications")
    if isinstance(meds, list) and meds:
        m_names = []
        for m in meds:
            if isinstance(m, dict) and m.get("name"):
                m_names.append(str(m.get("name")).strip())
            elif isinstance(m, str) and m.strip():
                m_names.append(m.strip())
        if m_names:
            return simplify_clinical_name(f"{m_names[0]} Treatment")

    # 4. Check symptoms
    symptoms = parsed_doc.get("symptoms")
    if isinstance(symptoms, list) and symptoms:
        clean_sympt = [str(s).strip() for s in symptoms if s and str(s).strip()]
        if clean_sympt:
            return simplify_clinical_name(clean_sympt[0])

    # 5. Check record_type
    r_type = parsed_doc.get("record_type")
    if r_type and str(r_type).lower() not in ["other", "prescription", "report", "billing document", "lab report"]:
        return simplify_clinical_name(str(r_type))

    return "Medical Episode"


def simplify_clinical_name(name: str) -> str:
    if not name or name.strip().lower() in ["medical episode", "unclassified medical episode", "other"]:
        return "Medical Episode"
        
    modifiers = {
        "type", "essential", "primary", "secondary", "unspecified", "acute", "chronic", "mild", "moderate", "severe", 
        "uncomplicated", "illness", "disease", "disorder", "syndrome", "treatment", "management", "report", "care", 
        "billing", "invoice", "prescription", "detail", "document", "record", "note", "mellitus", "febrile", "likely",
        "emergency", "elective", "advised", "procedure", "general", "medical", "episode", "profile", "clinic", "clinical",
        "history", "summary", "patient", "uid", "active", "resolved", "ongoing", "status", "check", "sheet", "note"
    }
    
    import re
    words = re.findall(r'[a-zA-Z0-9]+', name)
    
    clean_words = []
    for w in words:
        if w.isdigit():
            continue
        if w.lower() not in modifiers:
            clean_words.append(w.capitalize())
            
    if clean_words:
        return " ".join(clean_words)
        
    fallback_words = [w.capitalize() for w in words if not w.isdigit()]
    if fallback_words:
        return " ".join(fallback_words)
        
    return name.strip()


def match_name_to_contexts(cond_name: str, existing_contexts: list) -> int or None:
    c_lower = cond_name.lower()
    
    # 1. Exact match
    for ctx in existing_contexts:
        if ctx["name"].lower() == c_lower:
            return ctx["id"]
            
    # 2. Key clinical overlap words (excluding common terms like "episode", "illness", "uncomplicated")
    ignore_words = {"episode", "illness", "uncomplicated", "general", "medical", "treatment", "management", "report", "care"}
    c_words = [w for w in c_lower.replace("/", " ").replace("-", " ").split() if len(w) > 3 and w not in ignore_words]
    
    for ctx in existing_contexts:
        ctx_lower = ctx["name"].lower()
        ctx_words = [w for w in ctx_lower.replace("/", " ").replace("-", " ").split() if len(w) > 3 and w not in ignore_words]
        
        common = set(c_words).intersection(set(ctx_words))
        if common:
            return ctx["id"]
            
        # 3. Soft match for known clinical terms
        for kw in ["diabetes", "hypertension", "fever", "surgery", "accident", "brain", "cardiac", "fracture", "pneumonia", "injury", "head"]:
            if kw in c_lower and kw in ctx_lower:
                return ctx["id"]
                
    return None


def run_heuristic_consolidation(records_list: list) -> dict:
    contexts_map = {} # label -> list of record IDs
    
    for r in records_list:
        p_json = r.get("parsed_json") or {}
        cond_name = extract_meaningful_condition_name(p_json or r)
        
        matched_key = None
        c_lower = cond_name.lower()
        ignore_words = {"episode", "illness", "uncomplicated", "general", "medical", "treatment", "management", "report", "care"}
        c_words = [w for w in c_lower.replace("/", " ").replace("-", " ").split() if len(w) > 3 and w not in ignore_words]
        
        for key in list(contexts_map.keys()):
            key_lower = key.lower()
            key_words = [w for w in key_lower.replace("/", " ").replace("-", " ").split() if len(w) > 3 and w not in ignore_words]
            
            common = set(c_words).intersection(set(key_words))
            if common:
                matched_key = key
                break
                
            for kw in ["diabetes", "hypertension", "fever", "surgery", "accident", "brain", "cardiac", "fracture", "pneumonia", "injury", "head"]:
                if kw in c_lower and kw in key_lower:
                    matched_key = key
                    break
            if matched_key:
                break
                
        if matched_key:
            contexts_map[matched_key].append(r["id"])
        else:
            contexts_map[cond_name] = [r["id"]]
            
    suggested_contexts = []
    for name, ids in contexts_map.items():
        suggested_contexts.append({
            "name": name,
            "kind": "acute_active" if any(w in name.lower() for w in ["fever", "accident", "surgery", "acute", "fracture", "injury"]) else "chronic_ongoing",
            "reason": f"Heuristically consolidated clinical context for {name}",
            "record_ids": ids
        })
    return {"contexts": suggested_contexts}


def match_document_to_clinical_context(
    existing_contexts: list,
    parsed_doc: dict
) -> dict:
    """
    Leverages NVIDIA NIM Llama 3.2 to match an incoming document to an existing clinical context,
    or identify it as a genuinely different medical episode. Falls back to a smart local heuristic parser.
    """
    cond_name = extract_meaningful_condition_name(parsed_doc)
    
    if not settings.NVIDIA_API_KEY:
        matched_id = match_name_to_contexts(cond_name, existing_contexts)
        if matched_id:
            return {
                "matched_context_id": matched_id,
                "suggested_context_name": None,
                "suggested_context_kind": None,
                "reason": f"Fallback Match: Associated with existing context via clinical overlap: '{cond_name}'"
            }
        else:
            return {
                "matched_context_id": None,
                "suggested_context_name": cond_name,
                "suggested_context_kind": "acute_active" if any(w in cond_name.lower() for w in ["fever", "accident", "surgery", "fracture", "injury"]) else "chronic_ongoing",
                "reason": f"Fallback Match: Identified as a new clinical episode: '{cond_name}'"
            }

    contexts_json = json.dumps(existing_contexts, indent=2)
    doc_json = json.dumps(parsed_doc, indent=2)

    prompt = f"""
    You are an advanced medical clinical auditor.
    Your task is to determine whether a newly uploaded medical document belongs to an existing clinical context (medical episode) for the patient, or represents a genuinely different medical episode.

    ### EXISTING CLINICAL CONTEXTS:
    {contexts_json}

    ### NEW UPLOADED DOCUMENT DETAILS:
    {doc_json}

    ### CLASSIFICATION RULES:
    1. A clinical context represents a broader underlying primary medical condition or episode (e.g. "Diabetes", "Hypertension", "Viral Fever", "Brain Surgery / Head Injury").
    2. Check the full available evidence from inside the document: diagnoses, procedures/treatments, dates, medications, and document content.
    3. Do NOT create a new clinical context simply because the document type, filename, or diagnosis subtype is different. If a medicine bill, scan, or billing estimate references the same event/episode/condition as an existing context, they belong to the SAME context.
    4. Compare the document's condition against existing contexts. If an existing broader context matches (e.g. existing context is "Diabetes" and new document contains "Type 2 Diabetes" or "Metformin"), you MUST match it to that existing context ID.
    5. If matched: set `matched_context_id` to the integer ID of the matching context.
    6. If it represents a genuinely new/different medical episode: set `matched_context_id` to null, and suggest a professional name representing the broader underlying medical condition (e.g. "Diabetes" instead of "Type 2 Diabetes Mellitus"; "Hypertension" instead of "Essential Hypertension"; "Brain Injury" instead of "Subdural Hematoma") and kind ('chronic_ongoing', 'acute_active', 'acute_resolved'). Do NOT use generic names like "Medical Episode" unless no clinical condition can be identified from the document content.

    ### OUTPUT SCHEMA:
    Return ONLY a single JSON object. No markdown wrappers, no backticks.
    {{
        "matched_context_id": number or null,
        "suggested_context_name": "String or null",
        "suggested_context_kind": "chronic_ongoing" | "acute_active" | "acute_resolved" | null,
        "reason": "String (clinical justification)"
    }}
    """

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "meta/llama-3.2-11b-vision-instruct",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 1000
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        if response.status_code != 200:
            raise ValueError(f"Nvidia status {response.status_code}")
        text_resp = response.json()["choices"][0]["message"]["content"].strip()
        start = text_resp.find('{')
        end = text_resp.rfind('}')
        if start != -1 and end != -1:
            text_resp = text_resp[start:end+1]
        return json.loads(text_resp)
    except Exception as e:
        print(f"[claims_ai] match_document_to_clinical_context AI request error: {e}. Falling back to local heuristic.")
        matched_id = match_name_to_contexts(cond_name, existing_contexts)
        if matched_id:
            return {
                "matched_context_id": matched_id,
                "suggested_context_name": None,
                "suggested_context_kind": None,
                "reason": f"AI Error Fallback Match: Associated with existing context: '{cond_name}'"
            }
        else:
            return {
                "matched_context_id": None,
                "suggested_context_name": cond_name,
                "suggested_context_kind": "acute_active" if any(w in cond_name.lower() for w in ["fever", "accident", "surgery", "fracture", "injury"]) else "chronic_ongoing",
                "reason": f"AI Error Fallback: Created new context: '{cond_name}'"
            }


def consolidate_existing_patient_records_ai(
    patient_demographics: dict,
    records_list: list
) -> dict:
    """
    Groups a list of existing legacy EMR records into a set of clean, distinct clinical context episodes.
    """
    if not settings.NVIDIA_API_KEY or not records_list:
        return run_heuristic_consolidation(records_list)

    records_json = json.dumps(records_list, indent=2)
    prompt = f"""
    You are an expert clinical coding and records auditor.
    Your task is to cluster all EMR records for patient {patient_demographics.get('name')} ({patient_demographics.get('id')}) into distinct clinical context episodes.

    ### INPUT RECORDS:
    {records_json}

    ### RULES FOR CLUSTERING:
    1. A single clinical context (medical episode) should represent a broader underlying primary medical condition (e.g., "Diabetes", "Hypertension", "Viral Fever", "Brain Surgery / Head Injury").
    2. Cluster related prescriptions, laboratory tests, billing estimates, discharge summaries, and radiology scans together if they refer to the same clinical event or medical episode.
    3. Do NOT create separate contexts for every file. If they are part of the same episode (e.g. brain surgery clinical report, brain surgery billing estimate, brain surgery medications), they belong to ONE context.
    4. Provide a distinct clinical name representing the broader primary underlying condition (e.g. "Diabetes", "Hypertension", "Viral Fever", "Brain Surgery / Head Injury") and kind ('chronic_ongoing', 'acute_active', 'acute_resolved') for each context. Do NOT use overly specific subtype names or generic names like "Medical Episode" unless the condition is completely unidentifiable.

    ### OUTPUT SCHEMA:
    Return ONLY a single JSON object. No markdown wrappers.
    {{
        "contexts": [
            {{
                "name": "String (e.g., 'Brain Surgery / Head Injury', 'Diabetes')",
                "kind": "chronic_ongoing" | "acute_active" | "acute_resolved",
                "reason": "String (clinical summary explanation)",
                "record_ids": [number]
            }}
        ]
    }}
    """

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "meta/llama-3.2-11b-vision-instruct",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 2000
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        text_resp = response.json()["choices"][0]["message"]["content"].strip()
        start = text_resp.find('{')
        end = text_resp.rfind('}')
        if start != -1 and end != -1:
            text_resp = text_resp[start:end+1]
        return json.loads(text_resp)
    except Exception as e:
        print(f"[claims_ai] consolidate_existing_patient_records_ai AI request error: {e}. Falling back to local heuristic.")
        return run_heuristic_consolidation(records_list)
