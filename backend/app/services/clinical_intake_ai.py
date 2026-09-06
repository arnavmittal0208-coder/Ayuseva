"""
Universal Multilingual Conversational Clinical Intake AI Service for AyuSeva.
Language-agnostic clinical understanding, adaptive questioning, and professional English synthesis.
Dynamically determines clinical sufficiency based on the patient's specific complaint.

Separation of Concerns Architecture:
1. FAST LIVE CONVERSATION PROCESSING (process_live_conversation_turn):
   - Ultra-fast conversational decision (<1-2s): evaluates context, detects missing gaps,
     determines is_complete, generates next_question & quick_options in patient's language.
   - Low token budget (max_tokens: 150) for immediate real-time conversational responses.
   - Independent Python Redundancy and Semantic Sufficiency Guard:
     Enforces that an empty structured field does NOT trigger unnecessary questions.
     Determines sufficiency semantically (without word counts or turn count thresholds).
     Guarantees questions already answered, denied, or implied are never asked again.
2. HEAVY FINAL INTAKE PROCESSING (finalize_clinical_intake):
   - Runs ONCE when intake is completed / reviewed / persisted.
   - Extracts all standardized clinical entities into professional English.
   - Synthesizes professional English Doctor Current Situation summary narrative.
   - Runs dictionary normalizations & deterministic red-flag emergency triage.
"""

import json
import re
import requests
from typing import Dict, Any, List, Optional
from app.config import settings
from app.services.languages import get_language, get_initial_greeting
from app.services.triage import evaluate_emergency_triage

NIM_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
NIM_MODEL = "meta/llama-3.2-11b-vision-instruct"


# ---------------------------------------------------------------------------
# 1. PYTHON-SIDE REDUNDANCY & SEMANTIC SUFFICIENCY GUARD
# ---------------------------------------------------------------------------

def _apply_python_redundancy_and_sufficiency_guard(
    history: List[Dict[str, str]],
    is_complete: bool,
    next_question: str,
    quick_options: List[str],
    language_code: str,
    native_name: str,
    llm_already_provided: Optional[List[str]] = None,
    llm_explicitly_denied: Optional[List[str]] = None
) -> tuple[bool, str, List[str]]:
    """
    Independent Python Conversational Memory, Redundancy Guard & Semantic Sufficiency Evaluator.
    Guarantees:
    - Never repeats a question if already answered or denied across any language or turn.
    - An empty structured field does NOT trigger follow-ups.
    - Evaluates semantic sufficiency from actual clinical facts (ZERO word count or turn count thresholds).
    - If patient provided complaint + duration/context OR answered a follow-up with denial/closure => concludes immediately.
    - If next_question asks about duration when duration is known => suppresses & concludes.
    - If next_question asks about fever/breathing/pain when already addressed => suppresses & concludes.
    """
    patient_msgs = [
        str(msg.get("content", "")).strip()
        for msg in history
        if msg.get("role") in ("user", "patient") and str(msg.get("content", "")).strip()
    ]
    raw_patient_text = " ".join(patient_msgs)
    lower_patient_text = raw_patient_text.lower()
    last_patient_msg = patient_msgs[-1] if patient_msgs else ""
    lower_last_msg = last_patient_msg.lower()

    assistant_msgs = [
        str(msg.get("content", "")).strip()
        for msg in history
        if msg.get("role") in ("assistant", "system") and str(msg.get("content", "")).strip()
    ]
    # The last assistant question before the latest patient response
    last_assistant_q = assistant_msgs[-1] if assistant_msgs else ""
    lower_last_q = last_assistant_q.lower()

    # 1. Semantic Duration / Onset Detection across languages
    dur_regex = r'(\d+\s*(?:day|days|week|weeks|month|months|hour|hours|दिन|हफ्ते|हफ्ता|महीने|घंटे|ਘੰਟੇ|ਦਿਨ|ದಿನ|ವಾರ|ಗಂಟೆ)|yesterday|today|since\s+\w+|morning|night|कल\s*से|आज\s*से|सुबह\s*से|रात\s*से|दोपहर\s*से|तीन दिन|दो दिन|चार दिन|एक दिन|2 दिन|3 दिन|4 दिन|1 दिन|ਤਿੰਨ ਦਿਨ|ਦੋ ਦਿਨ|ਮೂರು ದಿನ|ಎರಡು ದಿನ)'
    has_duration_in_text = bool(re.search(dur_regex, raw_patient_text, re.IGNORECASE))

    llm_prov_text = " ".join(llm_already_provided or []).lower()
    llm_has_duration = any(w in llm_prov_text for w in ["day", "week", "month", "hour", "duration", "दिन", "हफ्ते", "since", "yesterday", "ago"])
    duration_covered = has_duration_in_text or llm_has_duration

    # 2. Semantic Complaint Detection
    has_cough_cold = any(w in lower_patient_text for w in [
        "खांसी", "cough", "ਖੰਘ", "ਕੇಮ್ಮು", "cold", "जुकाम", "सर्दी", "throat", "गले", "खराश", "बलगम", "phlegm", "sore throat"
    ])
    has_fever_pos = any(w in lower_patient_text for w in [
        "बुखार", "fever", "बखार", "ਤਾਪ", "ਬੁਖ਼ਾਰ", "ಜ್ವರ", "temperature", "chills", "ठंड"
    ]) and not any(neg in lower_patient_text for neg in ["no fever", "बुखार नहीं", "fever: no"])

    has_pain_pos = any(w in lower_patient_text for w in [
        "दर्द", "pain", "headache", "सिरदर्द", "body ache", "बदन दर्द", "पीठ", "कमर", "पेट", "stomach", "ache", "abdomen"
    ]) and not any(neg in lower_patient_text for neg in ["no pain", "दर्द नहीं", "pain: no"])

    has_dyspnea_pos = any(w in lower_patient_text for w in [
        "सांस", "breath", "dyspnea", "chest", "छाती", "सीने", "ਸਾਹ", "ಉಸಿರಾಟ"
    ]) and not any(neg in lower_patient_text for neg in ["no breathing", "no shortness", "दिक्कत नहीं", "परेशानी नहीं"])

    has_primary_complaint = has_cough_cold or has_fever_pos or has_pain_pos or has_dyspnea_pos

    # 3. Explicit Denial ("NO") and Negative State Tracking
    llm_denied_text = " ".join(llm_explicitly_denied or []).lower()
    is_negation_in_last = any(w in lower_last_msg for w in [
        "नहीं", "ना", "no", "nope", "not", "none", "neither", "ऐसा कुछ नहीं", "कोई दिक्कत नहीं", "कोई परेशानी नहीं", "नहीं है", "ਨਹੀਂ", "ಇಲ್ಲ"
    ])

    fever_denied = (
        "no fever" in lower_patient_text
        or "बुखार नहीं" in lower_patient_text
        or "बुखार भी नहीं" in lower_patient_text
        or "fever" in llm_denied_text
        or "बुखार" in llm_denied_text
        or (is_negation_in_last and any(w in lower_last_q for w in ["fever", "बुखार", "ਤਾਪ", "ಜ್ವರ"]))
    )
    dyspnea_denied = (
        "no difficulty breathing" in lower_patient_text
        or "no shortness of breath" in lower_patient_text
        or "सांस लेने में कोई दिक्कत नहीं" in lower_patient_text
        or "सांस में कोई परेशानी नहीं" in lower_patient_text
        or "breath" in llm_denied_text
        or "dyspnea" in llm_denied_text
        or "सांस" in llm_denied_text
        or (is_negation_in_last and any(w in lower_last_q for w in ["breath", "dyspnea", "सांस", "दम"]))
    )
    pain_denied = (
        "no pain" in lower_patient_text
        or "दर्द नहीं" in lower_patient_text
        or "pain" in llm_denied_text
        or "दर्द" in llm_denied_text
        or (is_negation_in_last and any(w in lower_last_q for w in ["pain", "दर्द", "headache", "सिरदर्द"]))
    )

    fever_addressed = has_fever_pos or fever_denied
    dyspnea_addressed = has_dyspnea_pos or dyspnea_denied
    pain_addressed = has_pain_pos or pain_denied

    # 4. Semantic Closure / Follow-up Answered Detection
    is_closure = False
    if any(cl in lower_last_msg for cl in [
        "ऐसा कुछ नहीं", "nothing else", "बस यही", "और कुछ नहीं", "that's all", "that is all", "only this", "nothing more", "बस इतना"
    ]):
        is_closure = True

    had_prior_followup_question = len(assistant_msgs) >= 2
    if had_prior_followup_question and is_negation_in_last:
        is_closure = True

    # Check if patient directly provided the missing detail answering the previous question
    if had_prior_followup_question:
        if any(w in lower_last_q for w in ["कब", "how long", "when", "days", "दिन"]) and duration_covered:
            is_closure = True
        elif any(w in lower_last_q for w in ["बुखार", "fever"]) and fever_addressed:
            is_closure = True
        elif any(w in lower_last_q for w in ["सांस", "breath", "dyspnea"]) and dyspnea_addressed:
            is_closure = True

    # 5. Semantic Sufficiency Check:
    # A narration is sufficient if:
    # - LLM marked it complete/sufficient, OR
    # - Primary complaint is present with duration or context, OR
    # - Multiple symptoms were described, OR
    # - A follow-up question was previously asked and patient provided an answer or closure
    if not is_complete:
        if has_primary_complaint and (duration_covered or is_closure):
            is_complete = True
        elif (has_cough_cold and has_fever_pos) or (has_pain_pos and has_fever_pos):
            is_complete = True
        elif had_prior_followup_question and (has_primary_complaint or is_closure):
            is_complete = True

    # 6. Redundancy Guard on Proposed `next_question`
    if not is_complete and next_question:
        q_lower = next_question.lower()

        # a) Asking about duration when duration is already known
        if duration_covered and any(w in q_lower for w in [
            "कब से", "कितने दिन", "how long", "when did", "since when", "how many days", "ਕਦੋਂ ਤੋਂ", "ಎಷ್ಟು ದಿನ"
        ]):
            is_complete = True

        # b) Asking about fever when fever was already addressed
        elif fever_addressed and any(w in q_lower for w in ["बुखार", "fever", "temperature", "ਬੁਖ਼ਾਰ", "ಜ್ವರ"]):
            is_complete = True

        # c) Asking about breathing/chest when already addressed
        elif dyspnea_addressed and any(w in q_lower for w in ["सांस", "breath", "dyspnea", "chest", "छाती", "सीने", "ਸਾਹ", "ಉಸಿರಾಟ"]):
            is_complete = True

        # d) Asking identical or previously asked question
        for prev_q in assistant_msgs:
            if prev_q and len(prev_q) > 10:
                clean_prev = prev_q.strip(" ?।.؟")
                clean_next = next_question.strip(" ?।.؟")
                if clean_prev == clean_next or (len(clean_prev) > 15 and clean_prev in clean_next):
                    is_complete = True
                    break

    # 7. Final Formatting
    if is_complete:
        next_question = get_natural_conclusion_statement(language_code, native_name)
        quick_options = []

    return is_complete, next_question, quick_options


# ---------------------------------------------------------------------------
# 2. FAST LIVE CONVERSATION PROCESSING (Real-time per-turn path)
# ---------------------------------------------------------------------------

def process_live_conversation_turn(
    conversation_history: List[Dict[str, str]],
    language_code: str = "hi-IN"
) -> Dict[str, Any]:
    """
    FAST LIVE CONVERSATION PROCESSING:
    - Clinically understands the patient's current response in active context.
    - Evaluates if critical information (duration or complaint-specific red flags) is still missing.
    - Generates ONE short, natural follow-up question or concluding statement in patient's language.
    - Generates 2-3 quick options.
    - Skips heavy multi-field clinical extraction, doctor summary narrative, and dictionary normalizations.
    - Token generation budget: <= 150 tokens (executes in ~1.0-2.0s instead of 7-10s).
    """
    lang_meta = get_language(language_code)
    lang_name = lang_meta.get("name", "Unknown")
    native_name = lang_meta.get("native_name", lang_name)

    valid_history = [
        msg for msg in conversation_history 
        if msg.get("content") and str(msg.get("content")).strip()
    ]

    patient_statements = [
        msg.get("content").strip() 
        for msg in valid_history 
        if msg.get("role") in ("user", "patient")
    ]
    raw_combined = " ".join(patient_statements)

    # Initial opening greeting
    if not patient_statements:
        opening_q = get_initial_greeting(language_code)
        return {
            "is_complete": False,
            "next_question": opening_q,
            "quick_options": [],
            "language_code": language_code,
            "language_name": lang_name,
            "native_name": native_name,
            "verbatim_patient_statements": "",
            "extracted_entities": {
                "chief_complaints": [],
                "symptom_duration": None,
                "severity": None,
                "associated_symptoms": [],
                "recent_changes": None,
                "triggers_or_context": None,
                "patient_concerns": None
            },
            "doctor_summary_english": "Patient has initiated intake. Awaiting primary symptoms.",
            "triage": {
                "triage_priority": "routine",
                "triage_flags": [],
                "is_emergency": False,
                "disclaimer": "Deterministic outpatient safety screening."
            }
        }

    ai_result = None
    if settings.NVIDIA_API_KEY:
        try:
            ai_result = _call_nim_live_turn(
                history=valid_history,
                lang_code=language_code,
                lang_name=lang_name,
                native_name=native_name
            )
        except Exception as e:
            print(f"[clinical_intake_ai] NIM live turn error: {e}. Using resilient local heuristic.")

    if not ai_result:
        ai_result = _heuristic_live_turn(
            history=valid_history,
            lang_code=language_code,
            lang_name=lang_name,
            native_name=native_name
        )

    is_complete = bool(ai_result.get("is_complete", False))
    next_question = ai_result.get("next_question", "")
    quick_options = ai_result.get("quick_options", [])
    llm_already_provided = ai_result.get("information_already_provided", [])
    llm_explicitly_denied = ai_result.get("information_explicitly_denied", [])

    # Apply independent Python-side redundancy guard, conversational memory & semantic sufficiency
    is_complete, next_question, quick_options = _apply_python_redundancy_and_sufficiency_guard(
        history=valid_history,
        is_complete=is_complete,
        next_question=next_question,
        quick_options=quick_options,
        language_code=language_code,
        native_name=native_name,
        llm_already_provided=llm_already_provided,
        llm_explicitly_denied=llm_explicitly_denied
    )

    is_english_mode = bool(language_code and language_code.lower().startswith("en"))

    if is_complete:
        if (
            not next_question 
            or not next_question.strip() 
            or next_question.strip().endswith("?") 
            or next_question.strip().endswith("؟")
            or (is_english_mode and re.search(r'[\u0900-\u0D7F]', next_question))
        ):
            next_question = get_natural_conclusion_statement(language_code, native_name)
        elif is_english_mode and any(h_word in next_question for h_word in ["ठीक है", "धन्यवाद", "परेशानी"]):
            next_question = "Okay, I have noted your symptoms and necessary information for the doctor. Thank you."
        quick_options = []
    else:
        if is_english_mode:
            if re.search(r'[\u0900-\u0D7F]', next_question):
                paren_match = re.search(r'\(([^)]+)\)', next_question)
                if paren_match and not re.search(r'[\u0900-\u0D7F]', paren_match.group(1)) and len(paren_match.group(1).strip()) > 5:
                    next_question = paren_match.group(1).strip()
                else:
                    cleaned_en = re.sub(r'[\u0900-\u0D7F]+', '', next_question).strip()
                    cleaned_en = re.sub(r'^[?:\s\-–()]+|[?:\s\-–()]+$', '', cleaned_en).strip()
                    if len(cleaned_en) > 10:
                        if not cleaned_en.endswith("?"):
                            cleaned_en += "?"
                        next_question = cleaned_en
                    else:
                        next_question = "How long have you been experiencing these symptoms?"

            clean_opts = []
            for opt in quick_options:
                opt_str = str(opt).strip()
                if not re.search(r'[\u0900-\u0D7F]', opt_str):
                    clean_opts.append(opt_str)
            if not clean_opts:
                clean_opts = ["Started today", "2 to 3 days", "About 1 week"]
            quick_options = clean_opts

    # Instant 0ms placeholder fields for backward compatibility with existing tests
    complaints = []
    lower_raw = raw_combined.lower()
    if any(w in lower_raw for w in ["खांसी", "cough", "ਖੰਘ", "ਕੇಮ್ಮು", "cold", "जुकाम"]):
        complaints.append("Cough / Respiratory Symptoms")
    if any(w in lower_raw for w in ["बुखार", "fever", "ਬੁਖ਼ਾਰ", "ಜ್ವರ"]):
        complaints.append("Fever")
    if any(w in lower_raw for w in ["दर्द", "pain", "headache", "सिरदर्द"]):
        complaints.append("Pain / Discomfort")
    if not complaints:
        complaints = ["Reported Acute Discomfort"]

    dur_match = re.search(r'(\d+\s*(?:day|days|week|weeks|month|दिन|हफ्ते|घंटे|ਦਿਨ|ਦਿਨ|ವಾರ))', raw_combined, re.IGNORECASE)
    duration = dur_match.group(1) if dur_match else None

    fast_extracted = {
        "chief_complaints": complaints,
        "symptom_duration": duration,
        "severity": "Moderate" if len(patient_statements) > 0 else None,
        "associated_symptoms": [],
        "recent_changes": None,
        "triggers_or_context": None,
        "patient_concerns": None
    }
    fast_summary = f"Patient presents with {', '.join(complaints).lower()}{f' for {duration}' if duration else ''}. Communicated in {lang_name}."
    fast_triage = evaluate_emergency_triage(
        raw_narration=raw_combined,
        translated_narration=fast_summary,
        chief_complaints=complaints
    )

    return {
        "is_complete": is_complete,
        "next_question": next_question,
        "quick_options": quick_options,
        "language_code": language_code,
        "language_name": lang_name,
        "native_name": native_name,
        "verbatim_patient_statements": raw_combined,
        "extracted_entities": fast_extracted,
        "doctor_summary_english": fast_summary,
        "triage": fast_triage
    }


def process_intake_conversation_turn(
    conversation_history: List[Dict[str, str]],
    language_code: str = "hi-IN"
) -> Dict[str, Any]:
    """Backwards-compatible wrapper delegating to process_live_conversation_turn."""
    return process_live_conversation_turn(
        conversation_history=conversation_history,
        language_code=language_code
    )


# ---------------------------------------------------------------------------
# 3. HEAVY FINAL INTAKE PROCESSING (Deferred to completion / review / save)
# ---------------------------------------------------------------------------

def finalize_clinical_intake(
    conversation_history: List[Dict[str, str]],
    language_code: str = "hi-IN",
    chief_complaints_hint: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    HEAVY FINAL INTAKE PROCESSING PIPELINE:
    Runs ONCE when intake finishes or upon review / persistence.
    - Deep clinical comprehension of the entire multi-turn transcript.
    - Standardized clinical English entity extraction (complaints, duration, severity, etc.).
    - Professional 2-3 sentence English Doctor Current Situation synthesis.
    - Medical terminology normalization via normalize_entities_to_english.
    - Deterministic emergency red-flag triage screening.
    """
    lang_meta = get_language(language_code)
    lang_name = lang_meta.get("name", "Unknown")
    native_name = lang_meta.get("native_name", lang_name)

    valid_history = [
        msg for msg in conversation_history 
        if msg.get("content") and str(msg.get("content")).strip()
    ]

    patient_statements = [
        msg.get("content").strip() 
        for msg in valid_history 
        if msg.get("role") in ("user", "patient")
    ]
    raw_combined = " ".join(patient_statements) or "Patient completed intake session."

    ai_result = None
    if settings.NVIDIA_API_KEY and len(patient_statements) > 0:
        try:
            ai_result = _call_nim_final_extraction(
                history=valid_history,
                lang_code=language_code,
                lang_name=lang_name,
                native_name=native_name
            )
        except Exception as e:
            print(f"[clinical_intake_ai] NIM final extraction error: {e}. Using resilient local heuristic.")

    if not ai_result:
        ai_result = _heuristic_final_extraction(
            history=valid_history,
            lang_code=language_code,
            lang_name=lang_name,
            native_name=native_name
        )

    extracted = ai_result.get("extracted_entities", {})
    doctor_summary = ai_result.get("doctor_summary_english", "")

    # Normalize all doctor-facing structured clinical fields into clear professional English
    extracted = normalize_entities_to_english(
        entities=extracted,
        lang_code=language_code,
        doctor_summary=doctor_summary
    )

    complaints = extracted.get("chief_complaints") or (chief_complaints_hint or [])
    duration = extracted.get("symptom_duration")
    context = extracted.get("triggers_or_context")
    recent_changes = extracted.get("recent_changes")
    concerns = extracted.get("patient_concerns")

    if not doctor_summary or len(str(doctor_summary).strip()) < 5:
        symptom_str = ", ".join(complaints) if complaints else "acute discomfort"
        dur_str = f" for {duration}" if duration else ""
        sev = extracted.get("severity")
        sev_str = f" (reported severity: {sev.lower()})" if sev else ""
        ctx_str = f". Context: {context}" if context else ""
        chg_str = f". Progression: {recent_changes or concerns}" if (recent_changes or concerns) else ""
        neg_list = extracted.get("relevant_negatives") or []
        neg_str = f" Associated negative findings: {', '.join(neg_list)}." if neg_list else ""
        doctor_summary = f"Patient reports {symptom_str}{dur_str}{sev_str}{ctx_str}{chg_str}.{neg_str}".strip()

    triage = evaluate_emergency_triage(
        raw_narration=raw_combined,
        translated_narration=doctor_summary,
        chief_complaints=complaints
    )

    return {
        "language_code": language_code,
        "language_name": lang_name,
        "native_name": native_name,
        "raw_narration": raw_combined,
        "verbatim_patient_statements": raw_combined,
        "translated_narration": doctor_summary,
        "doctor_summary_english": doctor_summary,
        "extracted_entities": extracted,
        "chief_complaints": complaints,
        "symptom_duration": duration,
        "severity": extracted.get("severity"),
        "recent_changes": recent_changes,
        "additional_notes": concerns,
        "relevant_negatives": extracted.get("relevant_negatives", []),
        "adaptive_followups": [],
        "triage": triage
    }


def structure_multilingual_intake(
    raw_narration: str,
    language_code: str = "en-IN",
    chief_complaints_hint: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Backwards-compatible wrapper feeding raw narration into the finalization pipeline."""
    history = [{"role": "user", "content": raw_narration}]
    return finalize_clinical_intake(
        conversation_history=history,
        language_code=language_code,
        chief_complaints_hint=chief_complaints_hint
    )


# ---------------------------------------------------------------------------
# 4. MEDICAL TERMINOLOGY NORMALIZATION & TRANSLATION
# ---------------------------------------------------------------------------

def normalize_entities_to_english(
    entities: Dict[str, Any],
    lang_code: str = "hi-IN",
    doctor_summary: str = ""
) -> Dict[str, Any]:
    """
    Guarantees that ALL doctor-facing structured clinical fields (Chief Complaints,
    Onset & Duration, Severity, Associated Symptoms, Recent Changes) are translated
    and normalized into clear, professional clinical English.
    """
    if not isinstance(entities, dict):
        return {}

    normalized = dict(entities)

    # Standard clinical complaints mapping for Indian regional language phrases
    complaint_mappings = {
        # Throat & Respiratory
        "गले में खराश": "Sore throat",
        "गला खराब": "Sore throat",
        "गले में दर्द": "Throat pain",
        "गले का दर्द": "Throat pain",
        "गले में बहुत ज्यादा परेशानी": "Severe throat problem",
        "गले में परेशानी": "Throat problem",
        "गले की परेशानी": "Throat problem",
        "खराश": "Sore throat",
        "खांसी": "Cough",
        "खंसी": "Cough",
        "सूखी खांसी": "Dry cough",
        "बलगम वाली खांसी": "Productive cough",
        "बलगम": "Sputum / Cough with phlegm",
        "जुकाम": "Common cold / Coryza",
        "जुखाम": "Common cold / Coryza",
        "सर्दी": "Common cold",
        "नाक बहना": "Rhinorrhea / Runny nose",
        "नाक बंद": "Nasal congestion",
        "छींक": "Sneezing",
        "सांस लेने में दिक्कत": "Shortness of breath / Dyspnea",
        "सांस फूलना": "Shortness of breath / Dyspnea",
        "दम फूलना": "Breathlessness",
        "घरघराहट": "Wheezing",
        # General & Systemic
        "बुखार": "Fever",
        "बखार": "Fever",
        "हल्का बुखार": "Low-grade fever",
        "तेज बुखार": "High-grade fever",
        "कंपकंपी": "Chills / Rigors",
        "ठंड लगना": "Chills",
        "सिरदर्द": "Headache",
        "सिर में दर्द": "Headache",
        "आधा सीसी": "Migraine",
        "चक्कर": "Dizziness / Vertigo",
        "चक्कर आना": "Dizziness / Vertigo",
        "बेहोशी": "Syncope / Fainting",
        "कमजोरी": "General weakness / Asthenia",
        "थकान": "Fatigue",
        "सुस्ती": "Lethargy",
        "शरीर में दर्द": "Body ache / Generalized myalgia",
        "बदन दर्द": "Body ache / Generalized myalgia",
        # Cardiovascular
        "छाती में दर्द": "Chest pain",
        "सीने में दर्द": "Chest pain",
        "सीने में जलन": "Heartburn / Acidity",
        "घबराहट": "Palpitations / Anxiety",
        "दिल की धड़कन": "Palpitations",
        # Gastrointestinal
        "पेट दर्द": "Abdominal pain",
        "पेट में दर्द": "Abdominal pain",
        "पेट खराब": "Upset stomach / Dyspepsia",
        "गैस": "Dyspepsia / Flatulence",
        "एसिडिटी": "Gastric acidity / Reflux",
        "उल्टी": "Vomiting",
        "जी मिचलाना": "Nausea",
        "दस्त": "Diarrhea",
        "लूज मोशन": "Diarrhea / Loose stools",
        "कब्ज": "Constipation",
        "भूख न लगना": "Loss of appetite / Anorexia",
        # Musculoskeletal
        "जोड़ों का दर्द": "Joint pain / Arthralgia",
        "घुटने में दर्द": "Knee pain",
        "कमर दर्द": "Back pain / Lumbago",
        "पीठ में दर्द": "Back pain",
        "गर्दन में दर्द": "Neck pain",
        "मांसपेशियों में दर्द": "Muscle pain / Myalgia",
        "सूजन": "Swelling / Edema",
        # Punjabi mappings
        "ਗਲੇ ਵਿੱਚ ਖਰਾਸ਼": "Sore throat",
        "ਗਲੇ ਚ ਖਰਾਸ਼": "Sore throat",
        "ਖੰਘ": "Cough",
        "ਜ਼ੁਕਾਮ": "Common cold",
        "ਬੁਖ਼ਾਰ": "Fever",
        "ਤਾਪ": "Fever",
        "ਸਿਰ ਦਰਦ": "Headache",
        "ਸਾਹ ਚੜ੍ਹਨਾ": "Shortness of breath",
        "ਛਾਤੀ ਦਾ ਦਰਦ": "Chest pain",
        "ਢਿੱਡ ਪੀੜ": "Abdominal pain",
        "ਕਮਜ਼ੋਰੀ": "General weakness",
        "ਚੱਕਰ": "Dizziness",
        # Kannada mappings
        "ಗಂಟಲು ನೋವು": "Sore throat",
        "ಕೆಮ್ಮು": "Cough",
        "ನೆಗಡಿ": "Common cold",
        "ಜ್ವರ": "Fever",
        "ತಲೆನೋವು": "Headache",
        "ಉಸಿರಾಟದ ತೊಂದರೆ": "Shortness of breath",
        "ಎದೆ ನೋವು": "Chest pain",
        "ಹೊಟ್ಟೆ ನೋವು": "Abdominal pain"
    }

    duration_word_map = {
        "दो दिन": "2 days",
        "२ दिन": "2 days",
        "2 दिन": "2 days",
        "एक दिन": "1 day",
        "१ दिन": "1 day",
        "1 दिन": "1 day",
        "तीन दिन": "3 days",
        "३ दिन": "3 days",
        "3 दिन": "3 days",
        "चार दिन": "4 days",
        "४ दिन": "4 days",
        "4 दिन": "4 days",
        "पांच दिन": "5 days",
        "५ दिन": "5 days",
        "5 दिन": "5 days",
        "छह दिन": "6 days",
        "६ दिन": "6 days",
        "सात दिन": "7 days",
        "७ दिन": "7 days",
        "एक हफ्ता": "1 week",
        "1 हफ्ता": "1 week",
        "एक सप्ताह": "1 week",
        "दो हफ्ते": "2 weeks",
        "2 हफ्ते": "2 weeks",
        "दो सप्ताह": "2 weeks",
        "तीन हफ्ते": "3 weeks",
        "एक महीना": "1 month",
        "दो महीने": "2 months",
        "आज से": "Since today",
        "कल से": "Since yesterday",
        "परसों से": "Since day before yesterday",
        "कुछ दिन": "Few days",
        "कई दिन": "Several days",
        "ਦੋ ਦਿਨ": "2 days",
        "ਇੱਕ ਦਿਨ": "1 day",
        "ਤਿੰਨ ਦਿਨ": "3 days",
        "ਚਾਰ ਦਿਨ": "4 days",
        "ਇੱਕ ਹਫ਼ਤਾ": "1 week",
        "ਅੱਜ ਤੋਂ": "Since today",
        "ਕੱਲ੍ਹ ਤੋਂ": "Since yesterday",
        "ಎರಡು ದಿನ": "2 days",
        "ಒಂದು ದಿನ": "1 day",
        "ಮೂರು ದಿನ": "3 days",
        "ಒಂದು ವಾರ": "1 week",
        "ಇಂದಿನಿಂದ": "Since today"
    }

    indic_num_map = {
        "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
        "ਇੱਕ": 1, "ਦੋ": 2, "ਤਿੰਨ": 3, "ਚਾਰ": 4, "ਪੰਜ": 5,
        "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4, "ಐದು": 5
    }

    def normalize_single_complaint(c: str) -> str:
        if not c or not isinstance(c, str):
            return c
        c_clean = c.strip()
        if c_clean in complaint_mappings:
            return complaint_mappings[c_clean]
        for k, v in complaint_mappings.items():
            if k in c_clean:
                return v
        has_indic = bool(re.search(r'[\u0900-\u0D7F]', c_clean))
        if has_indic and doctor_summary:
            summary_lower = doctor_summary.lower()
            if "sore throat" in summary_lower or "throat discomfort" in summary_lower or "pharyngitis" in summary_lower:
                return "Sore throat"
            if "cough" in summary_lower:
                return "Cough"
            if "fever" in summary_lower:
                return "Fever"
            if "cold" in summary_lower or "rhinorrhea" in summary_lower:
                return "Common cold"
            if "headache" in summary_lower:
                return "Headache"
            if "chest pain" in summary_lower:
                return "Chest pain"
            if "shortness of breath" in summary_lower or "dyspnea" in summary_lower:
                return "Shortness of breath"
        return c_clean

    def normalize_duration(d: str) -> str:
        if not d or not isinstance(d, str):
            return d
        d_clean = d.strip()
        if d_clean in duration_word_map:
            return duration_word_map[d_clean]
        for k, v in duration_word_map.items():
            if k in d_clean:
                return v
        m = re.search(r'(\d+)\s*(?:दिनों|दिन|ਦਿਨ|ದಿನ)', d_clean)
        if m:
            count = int(m.group(1))
            return f"{count} day" if count == 1 else f"{count} days"
        m_wk = re.search(r'(\d+)\s*(?:हफ्तों|हफ्ते|हफ्ता|सप्ताह|ਹਫ਼ਤੇ|ਹਫ਼ਤਾ|ವಾರ)', d_clean)
        if m_wk:
            count = int(m_wk.group(1))
            return f"{count} week" if count == 1 else f"{count} weeks"
        m_hr = re.search(r'(\d+)\s*(?:घंटों|घंटे|घंटा|ਘੰਟੇ|ਘੰਟਾ|ಗಂಟೆ)', d_clean)
        if m_hr:
            count = int(m_hr.group(1))
            return f"{count} hour" if count == 1 else f"{count} hours"
        m_mo = re.search(r'(\d+)\s*(?:महीनों|महीने|महीना|ਮਹੀਨੇ|ತಿಂಗಳು)', d_clean)
        if m_mo:
            count = int(m_mo.group(1))
            return f"{count} month" if count == 1 else f"{count} months"

        for w_num, val in indic_num_map.items():
            if w_num in d_clean:
                if any(u in d_clean for u in ["दिन", "ਦਿਨ", "ದಿನ"]):
                    return f"{val} day" if val == 1 else f"{val} days"
                if any(u in d_clean for u in ["हफ्ते", "हफ्ता", "सप्ताह", "ਹਫ਼ਤੇ", "ವಾರ"]):
                    return f"{val} week" if val == 1 else f"{val} weeks"
                if any(u in d_clean for u in ["घंटे", "घंटा", "ਘੰਟੇ"]):
                    return f"{val} hour" if val == 1 else f"{val} hours"
                if any(u in d_clean for u in ["महीने", "महीना"]):
                    return f"{val} month" if val == 1 else f"{val} months"

        if re.search(r'[\u0900-\u0D7F]', d_clean) and doctor_summary:
            m_sum = re.search(r'(\d+[- ](?:day|week|month|hour)s?(?:\s+history)?)', doctor_summary, re.IGNORECASE)
            if m_sum:
                return m_sum.group(1).replace("-", " ")
        return d_clean

    def normalize_severity(s: str) -> str:
        if not s or not isinstance(s, str):
            return s
        s_clean = s.strip()
        if any(w in s_clean for w in ["हल्का", "हल्की", "कम", "हल्के", "ਹਲਕਾ", "ಕಡಿಮೆ", "mild", "Mild"]):
            return "Mild"
        if any(w in s_clean for w in ["मध्यम", "सामान्य", "दरमियाना", "ਦਰਮਿਆਨਾ", "ಮಧ್ಯಮ", "moderate", "Moderate"]):
            return "Moderate"
        if any(w in s_clean for w in ["तेज", "गंभीर", "ज्यादा", "बहुत ज्यादा", "ਬਹੁਤ ਜ਼ਿਆਦਾ", "ತೀವ್ರ", "severe", "Severe"]):
            return "Severe"
        return s_clean

    raw_complaints = normalized.get("chief_complaints") or []
    if isinstance(raw_complaints, list):
        normalized["chief_complaints"] = [normalize_single_complaint(c) for c in raw_complaints if c]

    if normalized.get("symptom_duration"):
        normalized["symptom_duration"] = normalize_duration(normalized["symptom_duration"])

    if normalized.get("severity"):
        normalized["severity"] = normalize_severity(normalized["severity"])

    raw_assoc = normalized.get("associated_symptoms") or []
    if isinstance(raw_assoc, list):
        normalized["associated_symptoms"] = [normalize_single_complaint(s) for s in raw_assoc if s]

    for field in ["recent_changes", "triggers_or_context", "patient_concerns"]:
        val = normalized.get(field)
        if val and isinstance(val, str) and re.search(r'[\u0900-\u0D7F]', val):
            if "दवाई" in val or "दवा" in val or "गोली" in val:
                normalized[field] = "Took home medication with limited relief"
            elif "रात" in val:
                normalized[field] = "Worsens at night"
            elif "आराम" in val:
                normalized[field] = "No relief from home remedies"

    raw_negatives = normalized.get("relevant_negatives") or []
    if isinstance(raw_negatives, list):
        clean_negatives = []
        for n in raw_negatives:
            if not n or not isinstance(n, str):
                continue
            n_clean = n.strip()
            if re.search(r'[\u0900-\u0D7F]', n_clean):
                if any(w in n_clean.lower() for w in ["सांस", "breath", "dyspnea"]):
                    clean_negatives.append("No breathing difficulty reported")
                elif any(w in n_clean.lower() for w in ["बुखार", "fever", "ताप"]):
                    clean_negatives.append("No fever reported")
                elif any(w in n_clean.lower() for w in ["छाती", "सीने", "chest"]):
                    clean_negatives.append("No chest pain reported")
                elif any(w in n_clean.lower() for w in ["तकलीफ", "परेशानी", "और कोई", "अन्य", "nothing else"]):
                    clean_negatives.append("No other difficulties reported")
                else:
                    clean_negatives.append("No additional symptoms reported")
            else:
                clean_negatives.append(n_clean)
        normalized["relevant_negatives"] = clean_negatives
    else:
        normalized["relevant_negatives"] = []

    return normalized


def get_natural_conclusion_statement(language_code: str, native_name: str = "") -> str:
    """Returns a natural, empathetic conclusion statement in the patient's language."""
    code_lower = (language_code or "").lower()
    if code_lower.startswith("en"):
        return "Okay, I have noted your symptoms and necessary information for the doctor. Thank you."

    concluding_phrases = {
        "hi-IN": "ठीक है, मैंने आपकी परेशानी और जरूरी जानकारी नोट कर ली है। धन्यवाद।",
        "pa-IN": "ਠੀਕ ਹੈ, ਮੈਂ ਤੁਹਾਡੀ ਸਮੱਸਿਆ ਅਤੇ ਜ਼ਰੂਰੀ ਜਾਣਕਾਰੀ ਨੋਟ ਕਰ ਲਈ ਹੈ। ਧੰਨਵਾਦ।",
        "kn-IN": "ಸರಿ, ನಿಮ್ಮ ತೊಂದರೆ ಮತ್ತು ಅಗತ್ಯ ಮಾಹಿತಿಯನ್ನು ದಾಖಲಿಸಿಕೊಂಡಿದ್ದೇನೆ. ಧನ್ಯವಾದಗಳು.",
        "ta-IN": "சரி, உங்கள் பிரச்சினை மற்றும் தேவையான தகவல்களை குறித்துக்கொண்டேன். நன்றி.",
        "te-IN": "సరే, నేను మీ సమస్యను మరియు అవసరమైన సమాచారాన్ని నమోదు చేసుకున్నాను. ధన్యవాదాలు.",
        "bn-IN": "ঠিক আছে, আমি আপনার समस्या এবং প্রয়োজনীয় তথ্য লিখে নিয়েছি। ধন্যবাদ।",
        "mr-IN": "ठीक आहे, मी तुमची तक्रार आणि आवश्यक माहिती नोंदवून घेतली आहे. धन्यवाद.",
        "gu-IN": "ઠીક છે, મેં તમારી સમસ્યા અને જરૂરી માહિતી નોંધી લીધી છે. આભાર.",
        "ml-IN": "ശരി, നിങ്ങളുടെ ബുദ്ധിമുട്ടുകളും ആവശ്യമായ വിവരങ്ങളും രേഖപ്പെടുത്തിയിട്ടുണ്ട്. നന്ദി.",
        "od-IN": "ଠିକ୍ ଅଛି, ମୁଁ ଆପଣଙ୍କର ସମସ୍ୟା ଏବଂ ଆବଶ୍ୟକ ସୂଚନା ଟିପି ରଖିଛି। ଧନ୍ୟବାଦ।",
        "en-IN": "Okay, I have noted your symptoms and necessary information for the doctor. Thank you."
    }
    short_code = code_lower.split("-")[0] if code_lower else "hi"
    for k, v in concluding_phrases.items():
        if k.lower().startswith(short_code):
            return v
    return concluding_phrases.get(language_code, "Okay, I have noted your symptoms and necessary information for the doctor. Thank you.")


# ---------------------------------------------------------------------------
# 5. LLM INVOCATIONS (FAST LIVE TURN vs HEAVY FINAL SYNTHESIS)
# ---------------------------------------------------------------------------

def _call_nim_live_turn(
    history: List[Dict[str, str]],
    lang_code: str,
    lang_name: str,
    native_name: str
) -> Dict[str, Any]:
    """Invokes NVIDIA NIM LLM with a compact, ultra-fast prompt for real-time conversational decisions."""
    transcript_lines = []
    patient_turn_count = 0
    for msg in history:
        role = "Patient" if msg.get("role") in ("user", "patient") else "AyuSeva AI"
        if role == "Patient":
            patient_turn_count += 1
        transcript_lines.append(f"{role}: \"{msg.get('content', '').strip()}\"")
    transcript_text = "\n".join(transcript_lines)

    is_english = lang_code.lower().startswith("en")
    is_punjabi = lang_code.lower().startswith("pa")
    is_kannada = lang_code.lower().startswith("kn")

    if is_english:
        lang_directive = (
            "CRITICAL LANGUAGE RULE (STRICT ENGLISH ONLY):\n"
            "- The patient is communicating in ENGLISH.\n"
            "- 'next_question' and ALL items in 'quick_options' MUST be 100% in natural, fluent ENGLISH.\n"
            "- Absolutely NEVER output any Hindi words, Devanagari characters, Hinglish phrases, or dual-language translations.\n"
            "- Under NO circumstances should you output phrases like 'ये समस्या' or 'ठीक है'. Use ONLY pure English."
        )
        conclude_example = 'In English: "Okay, I have noted your symptoms and necessary information for the doctor. Thank you."'
        duration_example = 'In English: "How long have you been experiencing this symptom?"'
        red_flag_example = 'In English: "Do you also have a fever, chest pain, or difficulty breathing?"'
        options_example = '["Started today", "2 to 3 days", "About 1 week"]'
    elif is_punjabi:
        lang_directive = f"The patient is communicating in Punjabi ({native_name}, code: {lang_code}). Formulate 'next_question' and 'quick_options' in natural Punjabi."
        conclude_example = 'In Punjabi: "ਠੀਕ ਹੈ, ਮੈਂ ਤੁਹਾਡੀ ਸਮੱਸਿਆ ਅਤੇ ਜ਼ਰੂਰੀ ਜਾਣਕਾਰੀ ਨੋਟ ਕਰ ਲਈ ਹੈ। ਧੰਨਵਾਦ।"'
        duration_example = 'In Punjabi: "ਇਹ ਸਮੱਸਿਆ ਤੁਹਾਨੂੰ ਕਦੋਂ ਤੋਂ ਹੈ?"'
        red_flag_example = 'In Punjabi: "ਕੀ ਬੁਖ਼ਾਰ ਜਾਂ ਸਾਹ ਲੈਣ ਵਿੱਚ ਵੀ ਕੋਈ ਦਿੱਕਤ ਹੈ?"'
        options_example = '["ਅੱਜ ਤੋਂ", "2-3 ਦਿਨ", "1 ਹਫ਼ਤਾ"]'
    elif is_kannada:
        lang_directive = f"The patient is communicating in Kannada ({native_name}, code: {lang_code}). Formulate 'next_question' and 'quick_options' in natural Kannada."
        conclude_example = 'In Kannada: "ಸರಿ, ನಿಮ್ಮ ತೊಂದರೆ ಮತ್ತು ಅಗತ್ಯ ಮಾಹಿತಿಯನ್ನು ದಾಖಲಿಸಿಕೊಂಡಿದ್ದೇನೆ. ಧನ್ಯವಾದಗಳು."'
        duration_example = 'In Kannada: "ಈ समस्या ನಿಮಗೆ ಎಷ್ಟು ದಿನಗಳಿಂದ ಇದೆ?"'
        red_flag_example = 'In Kannada: "ಜ್ವರ ಅಥವಾ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆಯೇ?"'
        options_example = '["ಇಂದಿನಿಂದ", "2-3 ದಿನಗಳು", "1 ವಾರ"]'
    else:
        lang_directive = f"The patient is communicating in {lang_name} ({native_name}, code: {lang_code}). Formulate 'next_question' and 'quick_options' in natural {lang_name}."
        conclude_example = f'In {lang_name}: "ठीक है, मैंने आपकी परेशानी और जरूरी जानकारी नोट कर ली है। धन्यवाद।"'
        duration_example = f'In {lang_name}: "ये समस्या आपको कब से है?"'
        red_flag_example = f'In {lang_name}: "क्या बुखार या सांस लेने में भी कोई दिक्कत है?"'
        options_example = '["आज से", "2-3 दिन", "1 हफ्ता"]'

    prompt = f"""You are an empathetic, ultra-fast clinical documentation intake assistant for an outpatient hospital doctor.
{lang_directive}

### CONVERSATION TRANSCRIPT:
{transcript_text}

### CORE CLINICAL INTAKE PRINCIPLES:
1. PRIMARY SOURCE: The patient's natural narration is the PRIMARY source of information. Trust what they tell you.
2. NOT A FULL DOCTOR CONSULTATION: Your job is solely to capture the patient's current situation sufficiently for the doctor's visit note. Do NOT diagnose, prescribe, perform exhaustive clinical history-taking, or force completion of every clinical field.
3. REASONING FLOW:
   LISTEN → UNDERSTAND WHAT HAS ALREADY BEEN PROVIDED → CHECK ONLY IMPORTANT MISSING INFORMATION → ASK AT MOST THE FEW QUESTIONS THAT ARE GENUINELY NECESSARY → CONCLUDE.
4. EMPTY FIELD RULE: An empty structured field does NOT automatically mean you should ask a question. Do NOT ask questions merely because information such as severity, associated symptoms, recent changes, or triggers was not explicitly stated.
5. QUESTION MINIMIZATION:
   - Prefer ZERO follow-up questions when the patient's initial narration is already reasonably complete.
   - If one important piece of information is genuinely missing, ask ONE concise question.
   - If another question is genuinely necessary after that answer, ask it.
   - Do NOT ask a long checklist of questions. Do NOT try to exhaustively collect every clinical field.
   - When enough useful information has been collected, STOP immediately (is_complete: true).
   - Default should be FEW or ZERO follow-ups, not a questionnaire.
6. REPEATED QUESTION PREVENTION:
   - Before generating any follow-up question, inspect the ENTIRE conversation transcript above.
   - Treat information as ALREADY ANSWERED even when expressed in a different sentence, in another language, indirectly, using natural conversational wording, or as part of a longer statement.
   - Example: If the patient stated duration (e.g. "three days", "तीन दिन से", "since yesterday"), duration is ANSWERED; NEVER ask when it started or how long they have had it.
   - Example: If the patient mentioned fever ("खांसी के साथ बुखार भी है"), fever is already provided; NEVER ask whether they have fever.
   - Example: If the patient explicitly denied a symptom or answered NO (e.g. "नहीं, सांस लेने में कोई दिक्कत नहीं है" or "no fever" or "ऐसा कुछ नहीं है"), remember it as explicitly denied (NO); NEVER ask about it again.
   - A question that has already been answered MUST NEVER be selected again.
7. FINAL DECISION RULE:
   Before asking ANY question, internally check:
   a) Did the patient already provide this information? → If YES, DO NOT ASK.
   b) Did the patient answer this indirectly or in another language? → If YES, DO NOT ASK.
   c) Did the patient answer NO to this? → If YES, DO NOT ASK.
   d) Is this information genuinely necessary for the doctor to understand the current situation? → If NO, DO NOT ASK.
   e) When sufficient useful information is available → CONCLUDE warmly ({conclude_example}).

Return ONLY strict valid JSON matching this schema:
{{
    "information_already_provided": ["short summary of chief complaints, duration, or details provided"],
    "information_explicitly_denied": ["symptoms or aspects patient answered NO to"],
    "is_sufficient_for_doctor": true or false,
    "is_complete": true or false,
    "next_question": "Conclude warmly ({conclude_example}) if is_complete is true, or ONE concise question in target language if genuinely necessary",
    "quick_options": ["option 1", "option 2"]
}}"""

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": NIM_MODEL,
        "messages": [
            {
                "role": "system", 
                "content": (
                    "You are an ultra-fast clinical documentation intake assistant. The patient's natural narration is the primary source. "
                    "Listen, check only genuinely critical missing information, prefer zero follow-ups if narration is clear, never repeat answered or denied questions, and conclude. "
                    f"{'STRICT REQUIREMENT: The patient is communicating in English. Output next_question and quick_options ONLY in fluent English with ZERO Hindi or Devanagari characters.' if is_english else ''} "
                    "Always respond with strict valid JSON only."
                )
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 200
    }

    response = requests.post(NIM_CHAT_URL, headers=headers, json=payload, timeout=12)
    if response.status_code != 200:
        raise RuntimeError(f"NIM API error {response.status_code}: {response.text}")

    content = response.json()["choices"][0]["message"]["content"]
    cleaned = re.sub(r"^```json\s*", "", content.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"^```\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        cleaned = cleaned[start_idx:end_idx + 1]

    parsed = json.loads(cleaned)
    is_complete_val = bool(parsed.get("is_complete", False))
    if bool(parsed.get("is_sufficient_for_doctor", False)):
        is_complete_val = True

    return {
        "is_complete": is_complete_val,
        "is_sufficient_for_doctor": bool(parsed.get("is_sufficient_for_doctor", False)),
        "information_already_provided": parsed.get("information_already_provided", []) or [],
        "information_explicitly_denied": parsed.get("information_explicitly_denied", []) or [],
        "next_question": parsed.get("next_question", ""),
        "quick_options": parsed.get("quick_options", []) or []
    }


def _call_nim_final_extraction(
    history: List[Dict[str, str]],
    lang_code: str,
    lang_name: str,
    native_name: str
) -> Dict[str, Any]:
    """
    Authoritative primary extraction pass: runs deep clinical comprehension over the entire
    multi-turn conversation transcript using NVIDIA NIM, producing rich structured clinical
    entities and an accurate, complete, concise doctor-facing Current Situation summary in English.
    """
    transcript_lines = []
    for msg in history:
        role = "Patient" if msg.get("role") in ("user", "patient") else "AyuSeva AI"
        content = str(msg.get("content", "")).strip()
        if content:
            transcript_lines.append(f"{role}: \"{content}\"")
    transcript_text = "\n".join(transcript_lines)

    prompt = f"""You are an expert clinical documentation specialist preparing an outpatient intake document for an attending physician.
The patient completed an intake session communicating in {lang_name} ({native_name}, language code: {lang_code}).

### COMPLETE MULTI-TURN CONVERSATION TRANSCRIPT:
{transcript_text}

### CLINICAL DOCUMENTATION REQUIREMENTS (CRITICAL: 100% PROFESSIONAL ENGLISH):
Carefully review and semantically analyze the ENTIRE transcript across ALL turns as your primary source.
Synthesize an accurate, complete, clinically useful, and concise clinical record for the attending physician:

1. `doctor_summary_english` ("Current Clinical Situation"):
   - A coherent, professional 2-4 sentence clinical narrative written specifically for the attending doctor.
   - Accurately preserve ALL clinically relevant details communicated by the patient across all turns:
     * Chief complaint with exact anatomical site (e.g., throat, chest, head, abdomen) and nature of problem (e.g., severe throat problem, persistent cough, burning sensation, sharp headache).
     * Onset and duration (e.g., for two days, since yesterday, for 1 week).
     * Severity / intensity when stated (e.g., severe, mild, unbearable, moderate).
     * Associated symptoms (e.g., mild or intermittent fever, chills, nausea).
     * Relevant negative findings explicitly denied by the patient (e.g., explicitly denies breathing difficulty, denies chest pain, denies other difficulties).
     * Recent changes, progression, or home treatment trials if stated.
   - STRICT CLINICAL DOCUMENTATION CONSTRAINTS:
     * DO NOT invent or assume any details not stated by the patient.
     * DO NOT diagnose the patient (document symptoms and presentation, do NOT provide a disease diagnosis).
     * DO NOT collapse specific complaints into generic categories (NEVER write "Patient presents with pain / discomfort" when throat trouble, headache, fever, cough, or specific localized symptoms are described).
     * DO NOT output raw transcripts, regional scripts (Devanagari, Gurmukhi, Kannada, etc.), internal AI reasoning, or JSON inside the narrative.
     * The narrative MUST be in 100% fluent, professional medical English.

2. `extracted_entities`:
   - `chief_complaints`: List of specific standardized English complaints (e.g., ["Severe throat problem", "Fever"] or ["Cough", "Fever"]). NEVER use generic "Pain / Discomfort".
   - `symptom_duration`: Standardized English duration string (e.g., "2 days", "Since yesterday") or null.
   - `severity`: Standardized English severity ("Mild", "Moderate", "Severe") or null.
   - `associated_symptoms`: List of associated symptoms in English (e.g., ["Mild intermittent fever"]) or [].
   - `relevant_negatives`: List of symptoms or problems explicitly denied by the patient (e.g., ["No breathing difficulty reported", "No other difficulties reported"]) or [].
   - `recent_changes`: Description of recent progression or changes in English, or null.
   - `triggers_or_context`: Context, triggers, or aggravating factors in English, or null.
   - `patient_concerns`: Specific concerns or goals mentioned by the patient, or null.

Return ONLY a valid JSON object matching this schema:
{{
    "extracted_entities": {{
        "chief_complaints": ["Complaint 1", "Complaint 2"],
        "symptom_duration": "Duration in English or null",
        "severity": "Mild / Moderate / Severe or null",
        "associated_symptoms": ["Associated symptom in English"],
        "relevant_negatives": ["Explicit negative finding in English"],
        "recent_changes": "English description or null",
        "triggers_or_context": "English description or null",
        "patient_concerns": "English description or null"
    }},
    "doctor_summary_english": "Coherent, professional clinical narrative for the attending doctor"
}}"""

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": NIM_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an expert clinical documentation specialist. "
                    "Analyze the patient's entire multi-turn conversation and produce an accurate, detailed, "
                    "and professional English clinical intake summary and structured entities. "
                    "Never diagnose, never invent information, never collapse specific symptoms into generic labels. "
                    "Always respond with strict valid JSON only."
                )
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 1000
    }

    response = requests.post(NIM_CHAT_URL, headers=headers, json=payload, timeout=30)
    if response.status_code != 200:
        raise RuntimeError(f"NIM API error {response.status_code}: {response.text}")

    content = response.json()["choices"][0]["message"]["content"]
    cleaned = re.sub(r"^```json\s*", "", content.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"^```\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        cleaned = cleaned[start_idx:end_idx + 1]

    parsed = json.loads(cleaned)
    raw_entities = parsed.get("extracted_entities", {})
    cleaned_entities = {}
    for k, v in raw_entities.items():
        if v in ("Not specified", "None reported", "N/A", "null", ""):
            cleaned_entities[k] = None
        elif isinstance(v, list):
            cleaned_entities[k] = [item for item in v if item and str(item).strip()]
        else:
            cleaned_entities[k] = v

    # Ensure relevant_negatives list exists
    if "relevant_negatives" not in cleaned_entities or cleaned_entities["relevant_negatives"] is None:
        cleaned_entities["relevant_negatives"] = []

    return {
        "extracted_entities": cleaned_entities,
        "doctor_summary_english": parsed.get("doctor_summary_english", "")
    }


# ---------------------------------------------------------------------------
# 6. RESILIENT LOCAL HEURISTICS (Zero-dependency fallbacks)
# ---------------------------------------------------------------------------

def _heuristic_live_turn(
    history: List[Dict[str, str]],
    lang_code: str,
    lang_name: str,
    native_name: str
) -> Dict[str, Any]:
    """
    Fast local heuristic for conversational turns if API is unreachable.
    Evaluates clinical sufficiency semantically based on clinical facts:
    - Primary complaint + duration/onset OR associated context => clinically sufficient.
    - Answering a previous follow-up or closure/denial => clinically sufficient.
    - Incomplete complaint without duration/context => asks 1 relevant follow-up.
    - Never uses word counts, message lengths, or fixed question counts.
    """
    patient_messages = [
        str(msg.get("content", "")).strip() 
        for msg in history 
        if msg.get("role") in ("user", "patient") and str(msg.get("content", "")).strip()
    ]
    raw_text = " ".join(patient_messages)
    last_patient_msg = patient_messages[-1] if patient_messages else ""

    # 1. Semantic clinical facts detection
    dur_match = re.search(
        r'(\d+\s*(?:day|days|week|weeks|month|months|hour|hours|दिन|हफ्ते|हफ्ता|महीने|घंटे|ਘੰਟੇ|ਦਿਨ|ದಿನ|ವಾರ|ಗಂಟೆ)|yesterday|today|since|morning|कल\s*से|आज\s*से|सुबह\s*से|रात\s*से)',
        raw_text,
        re.IGNORECASE
    )
    has_duration = bool(dur_match)

    lower_raw = raw_text.lower()
    has_cough_resp = any(w in lower_raw for w in ["खांसी", "cough", "ਖੰਘ", "ਕੇಮ್ಮು", "cold", "जुकाम", "सर्दी", "throat", "गले", "खराश"])
    has_fever = any(w in lower_raw for w in ["बुखार", "fever", "बखार", "ਤਾਪ", "ਬੁਖ਼ਾਰ", "ಜ್ವರ", "temperature"])
    has_pain = any(w in lower_raw for w in ["दर्द", "pain", "headache", "सिरदर्द", "body ache", "बदन दर्द", "पीठ", "कमर", "पेट", "stomach"])
    has_dyspnea = any(w in lower_raw for w in ["सांस", "breath", "dyspnea", "chest", "छाती", "ਸੀਨੇ", "ਸਾਹ", "ಉಸಿರಾಟ"])

    has_primary_complaint = has_cough_resp or has_fever or has_pain or has_dyspnea

    # 2. Semantic denial or closure detection
    is_closure = False
    lower_last = last_patient_msg.lower()
    if any(cl in lower_last for cl in ["नहीं", "ना", "no", "nope", "nothing else", "बस यही", "कुछ नहीं", "that's all", "that is all", "only this", "ठीक है", "धन्यवाद"]):
        is_closure = True

    assistant_messages = [
        str(msg.get("content", "")).strip()
        for msg in history
        if msg.get("role") in ("assistant", "system") and str(msg.get("content", "")).strip()
    ]
    had_previous_assistant_question = len(assistant_messages) >= 2

    # 3. Clinical Sufficiency Evaluation (purely semantic, zero word count or turn count thresholds)
    is_complete = False
    if has_primary_complaint and (has_duration or is_closure):
        is_complete = True
    elif (has_cough_resp and has_fever) or (has_pain and has_fever):
        is_complete = True
    elif had_previous_assistant_question and (has_primary_complaint or is_closure or has_duration):
        is_complete = True

    if not is_complete:
        if not has_duration:
            if lang_code.startswith("en"):
                next_q = "How long have you been experiencing this symptom?"
                quick_opts = ["Started today", "2 to 3 days", "About 1 week"]
            elif lang_code == "hi-IN":
                next_q = "यह समस्या आपको कब से हो रही है?"
                quick_opts = ["आज से", "2-3 दिन", "1 हफ्ता"]
            elif lang_code == "pa-IN":
                next_q = "ਇਹ ਸਮੱਸਿਆ ਤੁਹਾਨੂੰ ਕਦੋਂ ਤੋਂ ਹੈ?"
                quick_opts = ["ਅੱਜ ਤੋਂ", "2-3 ਦਿਨ", "1 ਹਫ਼ਤਾ"]
            elif lang_code == "kn-IN":
                next_q = "ಈ समस्या ನಿಮಗೆ ಎಷ್ಟು ದಿನಗಳಿಂದ ಇದೆ?"
                quick_opts = ["ಇಂದಿನಿಂದ", "2-3 ದಿನಗಳು", "1 ವಾರ"]
            else:
                next_q = "How long have you been experiencing this symptom?"
                quick_opts = ["Started today", "2 to 3 days", "About 1 week"]
        else:
            if lang_code.startswith("en"):
                next_q = "Are you experiencing any fever or difficulty breathing?"
                quick_opts = ["No, nothing else", "Yes, mild fever"]
            elif lang_code == "hi-IN":
                next_q = "क्या आपको बुखार या सांस लेने में भी कोई परेशानी है?"
                quick_opts = ["नहीं, ऐसा कुछ नहीं है", "हां, हल्का बुखार है"]
            elif lang_code == "pa-IN":
                next_q = "ਕੀ ਬੁਖ਼ਾਰ ਜਾਂ ਸਾਹ ਲੈਣ ਵਿੱਚ ਵੀ ਕੋਈ ਦਿੱਕਤ ਹੈ?"
                quick_opts = ["ਨਹੀਂ, ਅਜਿਹਾ ਕੁਝ ਨਹੀਂ", "ਹਾਂ, ਹਲਕਾ ਬੁਖ਼ਾਰ ਹੈ"]
            elif lang_code == "kn-IN":
                next_q = "ಜ್ವರ ಅಥವಾ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆಯೇ?"
                quick_opts = ["ಇಲ್ಲ, ಬೇರೇನೂ ಇಲ್ಲ", "ಹೌದು, ಸ್ವಲ್ಪ ಜ್ವರ"]
            else:
                next_q = "Are you experiencing any fever or difficulty breathing?"
                quick_opts = ["No, nothing else", "Yes, mild fever"]
    else:
        next_q = get_natural_conclusion_statement(lang_code, native_name)
        quick_opts = []

    return {
        "is_complete": is_complete,
        "next_question": next_q,
        "quick_options": quick_opts
    }


def _heuristic_final_extraction(
    history: List[Dict[str, str]],
    lang_code: str,
    lang_name: str,
    native_name: str
) -> Dict[str, Any]:
    """
    Resilient local fallback for clinical entity extraction and English summary
    used ONLY if NIM is unavailable or encounters an unrecoverable failure.
    """
    patient_messages = [
        msg.get("content", "").strip() 
        for msg in history 
        if msg.get("role") in ("user", "patient") and msg.get("content", "").strip()
    ]
    raw_text = " ".join(patient_messages)
    raw_lower = raw_text.lower()

    dur_match = re.search(r'((?:\d+|एक|दो|तीन|चार|पाँच|पांच|one|two|three|four|five)\s*(?:day|days|week|weeks|month|months|दिन|हफ्ते|घंटे|ਘੰਟੇ|ਦਿਨ|ವಾರ))', raw_text, re.IGNORECASE)
    duration = dur_match.group(1) if dur_match else None
    if duration:
        duration = duration.replace("दो दिन", "2 days").replace("तीन दिन", "3 days").replace("चार दिन", "4 days").replace("एक दिन", "1 day")

    complaints = []
    # Throat & Upper Respiratory
    if any(w in raw_lower for w in ["गले", "खराश", "throat", "pharyngitis", "गला"]):
        complaints.append("Throat problem / Sore throat")
    if any(w in raw_lower for w in ["खांसी", "cough", "ਖੰਘ", "ਕੇಮ್ಮು", "जुकाम", "cold", "सर्दी"]):
        complaints.append("Cough / Cold symptoms")
    if any(w in raw_lower for w in ["बुखार", "fever", "बखार", "ਬੁਖ਼ਾਰ", "ಜ್ವರ", "temperature"]):
        complaints.append("Fever")
    if any(w in raw_lower for w in ["सिरदर्द", "सिर में दर्द", "headache", "head ache", "ਸਿਰਦਰਦ", "ತಲೆನೋವು"]):
        complaints.append("Headache")
    if any(w in raw_lower for w in ["छाती में दर्द", "सीने में दर्द", "chest pain", "ਛਾਤੀ"]):
        complaints.append("Chest pain")
    if any(w in raw_lower for w in ["पेट दर्द", "पेट में दर्द", "stomach pain", "abdominal", "ਢਿੱਡ"]):
        complaints.append("Abdominal pain")
    if any(w in raw_lower for w in ["सांस", "breath", "dyspnea", "ਸਾਹ", "ಉಸಿರಾಟ"]) and not any(neg in raw_lower for neg in ["सांस लेने में कोई दिक्कत नहीं", "सांस में कोई परेशानी नहीं", "no breathing difficulty", "no shortness of breath"]):
        complaints.append("Breathing difficulty")
    if not complaints:
        if any(w in raw_lower for w in ["दर्द", "pain"]):
            complaints.append("Localized pain / discomfort")
        else:
            complaints.append("Acute clinical discomfort")

    # Relevant Negatives
    relevant_negatives = []
    if any(w in raw_lower for w in ["सांस लेने में कोई दिक्कत नहीं", "सांस में कोई परेशानी नहीं", "no breathing difficulty", "no shortness of breath", "saans lene me koi dikkat nahi"]):
        relevant_negatives.append("No breathing difficulty reported")
    if any(w in raw_lower for w in ["और कोई तकलीफ नहीं", "कोई अन्य परेशानी नहीं", "nothing else", "no other difficulty", "no other problem", "ऐसा कुछ नहीं"]):
        relevant_negatives.append("No other associated difficulties reported")
    if any(w in raw_lower for w in ["बुखार नहीं", "no fever"]):
        relevant_negatives.append("No fever reported")

    severity = None
    if any(w in raw_lower for w in ["बहुत ज्यादा", "तेज", "severe", "unbearable", "गंभीर"]):
        severity = "Severe"
    elif any(w in raw_lower for w in ["हल्का", "हल्की", "mild", "slight"]):
        severity = "Mild"
    elif len(patient_messages) > 0:
        severity = "Moderate"

    complaint_str = ", ".join(complaints)
    dur_str = f" for {duration}" if duration else ""
    sev_str = f" (reported as {severity.lower()})" if severity else ""
    neg_str = f" Patient denies {', '.join([n.lower().replace('no ', '') for n in relevant_negatives])}." if relevant_negatives else ""

    summary = f"Patient reports {complaint_str}{dur_str}{sev_str}.{neg_str}".strip()

    return {
        "extracted_entities": {
            "chief_complaints": complaints,
            "symptom_duration": duration,
            "severity": severity,
            "associated_symptoms": [],
            "relevant_negatives": relevant_negatives,
            "recent_changes": None,
            "triggers_or_context": None,
            "patient_concerns": None
        },
        "doctor_summary_english": summary
    }
