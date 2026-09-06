from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient, VisitIntake
from app.services.languages import get_supported_languages, get_language
from app.services.speech import transcribe_audio_sarvam, synthesize_speech_sarvam
from app.services.triage import evaluate_emergency_triage
from app.services.clinical_intake_ai import (
    structure_multilingual_intake,
    process_intake_conversation_turn,
    process_live_conversation_turn,
    finalize_clinical_intake,
    normalize_entities_to_english
)

router = APIRouter(tags=["visit_intakes"])

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class ProcessTextRequest(BaseModel):
    raw_narration: str
    patient_language: str = "en-IN"
    chief_complaints: Optional[List[str]] = None

class SynthesizeSpeechRequest(BaseModel):
    text: str
    language_code: str = "hi-IN"
    speaker: Optional[str] = None

class ConversationTurnRequest(BaseModel):
    conversation_history: List[Dict[str, str]]
    language_code: str = "hi-IN"
    synthesize_audio: bool = True

class FinalizeIntakeRequest(BaseModel):
    conversation_history: List[Dict[str, str]]
    language_code: str = "hi-IN"
    chief_complaints: Optional[List[str]] = None

class CreateVisitIntakeRequest(BaseModel):
    patient_language: str = "en-IN"
    raw_narration: str = ""
    translated_narration: Optional[str] = None
    chief_complaints: Optional[List[str]] = None
    symptom_duration: Optional[str] = None
    severity: Optional[str] = None
    recent_changes: Optional[str] = None
    additional_notes: Optional[str] = None
    source: str = "patient_app"  # "patient_app" or "medikiosk"
    extracted_entities: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, str]]] = None
    doctor_summary_english: Optional[str] = None

class DoctorVerifyRequest(BaseModel):
    doctor_notes: Optional[str] = None
    status: str = "Reviewed"


# ---------------------------------------------------------------------------
# Voice & Multilingual Registry Endpoints
# ---------------------------------------------------------------------------

@router.get("/api/voice/languages")
def list_languages():
    """
    Returns declarative list of all supported Indian & regional languages.
    Provider-driven and extensible.
    """
    return {
        "languages": get_supported_languages(),
        "default": "hi-IN"
    }


@router.post("/api/voice/transcribe")
async def transcribe_voice(
    file: UploadFile = File(...),
    language_code: str = Form("hi-IN")
):
    """
    Receives voice audio from patient recording, routes to Sarvam AI STT
    with selected language code, and returns transcript.
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes or len(audio_bytes) < 100:
            raise HTTPException(status_code=400, detail="Empty or invalid audio recording received.")

        content_type = file.content_type or "audio/wav"
        result = transcribe_audio_sarvam(
            audio_bytes=audio_bytes,
            content_type=content_type,
            language_code=language_code
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Speech-to-text processing failed: {str(e)}"
        )


@router.post("/api/voice/synthesize-speech")
def synthesize_voice_speech(payload: SynthesizeSpeechRequest):
    """
    Synthesizes speech audio from text using Sarvam AI Text-to-Speech API.
    Dynamically resolves the speaker based on request, language preference, or defaults.
    Returns base64 WAV audio for immediate playback in the patient's language.
    """
    try:
        return synthesize_speech_sarvam(
            text=payload.text,
            language_code=payload.language_code,
            speaker=payload.speaker
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Speech synthesis failed: {str(e)}"
        )


# ---------------------------------------------------------------------------
# Conversational Intake & Real-time AI Turn Processing
# ---------------------------------------------------------------------------

@router.post("/api/patients/{patient_id}/intakes/conversation-turn")
def handle_conversation_turn(
    patient_id: str,
    payload: ConversationTurnRequest,
    db: Session = Depends(get_db)
):
    """
    Core engine for voice-first conversational MediKiosk and intake.
    Evaluates patient responses dynamically:
    - Clinically understands natural speech in patient's selected tongue
    - Dynamically evaluates clinical sufficiency based on specific complaint
    - Generates 1 empathetic follow-up question if incomplete
    - Automatically synthesizes Sarvam TTS audio if requested
    - Synthesizes professional English Doctor Current Situation summary
    - Performs deterministic red-flag triage screening
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    turn_result = process_live_conversation_turn(
        conversation_history=payload.conversation_history,
        language_code=payload.language_code
    )

    # Optional speech synthesis for the next question
    audio_info = {
        "has_audio": False,
        "audio_base64": None,
        "speaker": None
    }
    if payload.synthesize_audio and turn_result.get("next_question"):
        try:
            tts_res = synthesize_speech_sarvam(
                text=turn_result["next_question"],
                language_code=payload.language_code
            )
            audio_info = {
                "has_audio": tts_res.get("has_audio", False),
                "audio_base64": tts_res.get("audio_base64"),
                "speaker": tts_res.get("speaker")
            }
        except Exception as tts_err:
            print(f"[visit_intakes.py] TTS auto-synthesis error: {tts_err}")

    return {
        **turn_result,
        "audio": audio_info
    }


@router.post("/api/patients/{patient_id}/intakes/finalize")
def finalize_patient_intake(
    patient_id: str,
    payload: FinalizeIntakeRequest,
    db: Session = Depends(get_db)
):
    """
    HEAVY FINAL INTAKE PROCESSING:
    Runs ONCE when intake is ready for doctor review or completion.
    Synthesizes professional English Doctor summary, extracts full structured clinical entities,
    and runs emergency red-flag triage screening.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    finalized = finalize_clinical_intake(
        conversation_history=payload.conversation_history,
        language_code=payload.language_code,
        chief_complaints_hint=payload.chief_complaints
    )

    return finalized


@router.post("/api/patients/{patient_id}/intakes/process-text")
def preview_intake_structuring(
    patient_id: str,
    payload: ProcessTextRequest,
    db: Session = Depends(get_db)
):
    """
    Previews multilingual intake structuring without saving to DB.
    Allows real-time translation, clinical entity extraction, adaptive follow-ups,
    and emergency triage alert preview.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    # Multilingual structuring
    structured = structure_multilingual_intake(
        raw_narration=payload.raw_narration,
        language_code=payload.patient_language,
        chief_complaints_hint=payload.chief_complaints
    )

    # Deterministic red flag triage
    triage = evaluate_emergency_triage(
        raw_narration=payload.raw_narration,
        translated_narration=structured.get("translated_narration", ""),
        chief_complaints=structured.get("chief_complaints", [])
    )

    return {
        **structured,
        **triage
    }


# ---------------------------------------------------------------------------
# Current Visit Intake Persistence & Snapshot Management
# ---------------------------------------------------------------------------

@router.post("/api/patients/{patient_id}/intakes")
def create_visit_intake(
    patient_id: str,
    payload: CreateVisitIntakeRequest,
    db: Session = Depends(get_db)
):
    """
    Creates a new, point-in-time append-only Visit Intake snapshot for the patient.
    Runs clinical translation, entity extraction, and emergency triage screening.
    Never overwrites historical visits.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    raw_text = payload.raw_narration or ""
    
    # Check if extracted_entities or doctor_summary_english was already finalized
    is_placeholder_summary = (
        not payload.doctor_summary_english 
        or payload.doctor_summary_english == "Patient has initiated intake. Awaiting primary symptoms."
        or payload.doctor_summary_english.startswith("Patient presents with")
        or payload.doctor_summary_english.startswith("Interim:")
    )
    is_already_finalized = bool(
        not is_placeholder_summary
        and payload.extracted_entities
        and payload.extracted_entities.get("relevant_negatives") is not None
    )

    if is_already_finalized:
        final_translated = payload.doctor_summary_english or payload.translated_narration or raw_text
        extracted = payload.extracted_entities or {}
        final_complaints = payload.chief_complaints or extracted.get("chief_complaints") or []
        final_duration = payload.symptom_duration or extracted.get("symptom_duration") or "Not specified"
        final_severity = payload.severity or extracted.get("severity") or "Moderate"
        final_changes = payload.recent_changes or extracted.get("recent_changes") or "None reported"
        final_notes = payload.additional_notes or extracted.get("patient_concerns") or ""
    elif payload.conversation_history and any(m.get("role") in ("user", "patient") for m in payload.conversation_history):
        # Automatically run finalize_clinical_intake if review didn't run finalize or if placeholder was passed
        finalized = finalize_clinical_intake(
            conversation_history=payload.conversation_history,
            language_code=payload.patient_language,
            chief_complaints_hint=payload.chief_complaints
        )
        final_translated = finalized.get("doctor_summary_english") or raw_text
        extracted = finalized.get("extracted_entities") or {}
        final_complaints = extracted.get("chief_complaints") or payload.chief_complaints or []
        final_duration = extracted.get("symptom_duration") or payload.symptom_duration or "Not specified"
        final_severity = extracted.get("severity") or payload.severity or "Moderate"
        final_changes = extracted.get("recent_changes") or payload.recent_changes or "None reported"
        final_notes = extracted.get("patient_concerns") or payload.additional_notes or ""
    elif (payload.doctor_summary_english or payload.translated_narration) and not is_placeholder_summary:
        final_translated = payload.doctor_summary_english or payload.translated_narration or raw_text
        extracted = payload.extracted_entities or {}
        final_complaints = payload.chief_complaints or extracted.get("chief_complaints") or []
        final_duration = payload.symptom_duration or extracted.get("symptom_duration") or "Not specified"
        final_severity = payload.severity or extracted.get("severity") or "Moderate"
        final_changes = payload.recent_changes or extracted.get("recent_changes") or "None reported"
        final_notes = payload.additional_notes or extracted.get("patient_concerns") or ""
    else:
        # Fallback to structuring
        structured = structure_multilingual_intake(
            raw_narration=raw_text,
            language_code=payload.patient_language,
            chief_complaints_hint=payload.chief_complaints
        )
        final_translated = structured.get("translated_narration") or raw_text
        extracted = structured.get("extracted_entities") or {}
        final_complaints = payload.chief_complaints if payload.chief_complaints is not None else (extracted.get("chief_complaints") or [])
        final_duration = payload.symptom_duration or extracted.get("symptom_duration") or "Not specified"
        final_severity = payload.severity or extracted.get("severity") or "Moderate"
        final_changes = payload.recent_changes or extracted.get("recent_changes") or "None reported"
        final_notes = payload.additional_notes or extracted.get("patient_concerns") or ""

    # Normalize all structured doctor-facing fields to guaranteed professional English
    normalized_ent = normalize_entities_to_english(
        entities={
            "chief_complaints": final_complaints,
            "symptom_duration": final_duration if final_duration != "Not specified" else None,
            "severity": final_severity,
            "recent_changes": final_changes if final_changes != "None reported" else None,
            "patient_concerns": final_notes
        },
        lang_code=payload.patient_language,
        doctor_summary=final_translated
    )
    final_complaints = normalized_ent.get("chief_complaints") or final_complaints
    final_duration = normalized_ent.get("symptom_duration") or final_duration
    final_severity = normalized_ent.get("severity") or final_severity
    final_changes = normalized_ent.get("recent_changes") or final_changes
    final_notes = normalized_ent.get("patient_concerns") or final_notes
    extracted = {**extracted, **normalized_ent}

    # Deterministic emergency red-flag triage
    triage = evaluate_emergency_triage(
        raw_narration=raw_text,
        translated_narration=final_translated,
        chief_complaints=final_complaints
    )

    lang_info = get_language(payload.patient_language)
    now = datetime.utcnow()
    intake = VisitIntake(
        patient_id=patient.id,
        visit_datetime=now,
        patient_language=payload.patient_language,
        raw_narration=raw_text,
        translated_narration=final_translated,
        chief_complaints=final_complaints,
        symptom_duration=final_duration,
        severity=final_severity,
        recent_changes=final_changes,
        additional_notes=final_notes,
        structured_data={
            "language_name": lang_info.get("name", "English"),
            "native_name": lang_info.get("native_name", "English"),
            "triage_disclaimer": triage.get("disclaimer"),
            "extracted_entities": extracted or payload.extracted_entities or {},
            "conversation_history": payload.conversation_history or [],
            "doctor_summary_english": final_translated
        },
        triage_priority=triage["triage_priority"],
        triage_flags=triage["triage_flags"],
        source=payload.source,
        verification_status="Pending Doctor Review",
        created_at=now
    )

    db.add(intake)
    db.commit()
    db.refresh(intake)

    return _format_intake_response(intake, patient)


@router.get("/api/patients/{patient_id}/intakes")
def list_patient_intakes(
    patient_id: str,
    db: Session = Depends(get_db)
):
    """
    Returns all historical visit intakes for the patient, ordered with most recent first.
    Both patient app and hospital MediKiosk query this exact endpoint.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    intakes = (
        db.query(VisitIntake)
        .filter(VisitIntake.patient_id == patient_id)
        .order_by(VisitIntake.visit_datetime.desc())
        .all()
    )

    return [_format_intake_response(item, patient) for item in intakes]


@router.get("/api/patients/{patient_id}/intakes/{intake_id}")
def get_patient_intake(
    patient_id: str,
    intake_id: int,
    db: Session = Depends(get_db)
):
    """
    Retrieves a single visit intake by ID.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    intake = (
        db.query(VisitIntake)
        .filter(VisitIntake.id == intake_id, VisitIntake.patient_id == patient_id)
        .first()
    )
    if not intake:
        raise HTTPException(status_code=404, detail="Visit intake not found.")

    return _format_intake_response(intake, patient)


@router.post("/api/patients/{patient_id}/intakes/{intake_id}/verify")
def verify_patient_intake(
    patient_id: str,
    intake_id: int,
    payload: DoctorVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Records clinician verification and optional doctor notes for an intake snapshot.
    """
    intake = (
        db.query(VisitIntake)
        .filter(VisitIntake.id == intake_id, VisitIntake.patient_id == patient_id)
        .first()
    )
    if not intake:
        raise HTTPException(status_code=404, detail="Visit intake not found.")

    intake.verification_status = payload.status
    if payload.doctor_notes is not None:
        intake.doctor_notes = payload.doctor_notes

    db.commit()
    db.refresh(intake)

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    return _format_intake_response(intake, patient)


@router.delete("/api/patients/{patient_id}/intakes/{intake_id}")
@router.delete("/api/intakes/{intake_id}")
def delete_patient_intake(
    intake_id: int,
    patient_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Deletes a visit intake record by ID.
    """
    query = db.query(VisitIntake).filter(VisitIntake.id == intake_id)
    if patient_id:
        query = query.filter(VisitIntake.patient_id == patient_id)
    intake = query.first()
    if not intake:
        raise HTTPException(status_code=404, detail="Visit intake not found.")

    db.delete(intake)
    db.commit()

    return {"message": "Visit intake deleted successfully", "id": intake_id}


# ---------------------------------------------------------------------------
# Helper Response Formatter
# ---------------------------------------------------------------------------

def _format_intake_response(intake: VisitIntake, patient: Optional[Patient] = None) -> Dict[str, Any]:
    lang_info = get_language(intake.patient_language)
    visit_dt = intake.visit_datetime or intake.created_at or datetime.utcnow()
    structured = intake.structured_data or {}
    
    # Ensure all doctor-facing structured fields are consistently in English
    norm = normalize_entities_to_english(
        entities={
            "chief_complaints": intake.chief_complaints or [],
            "symptom_duration": intake.symptom_duration if intake.symptom_duration != "Not specified" else None,
            "severity": intake.severity,
            "recent_changes": intake.recent_changes if intake.recent_changes != "None reported" else None,
            "patient_concerns": intake.additional_notes
        },
        lang_code=intake.patient_language,
        doctor_summary=intake.translated_narration or ""
    )
    final_complaints = norm.get("chief_complaints") or intake.chief_complaints or []
    final_duration = norm.get("symptom_duration") or intake.symptom_duration or "Not specified"
    final_severity = norm.get("severity") or intake.severity or "Moderate"
    final_changes = norm.get("recent_changes") or intake.recent_changes or "None reported"
    final_notes = norm.get("patient_concerns") or intake.additional_notes or ""

    return {
        "id": intake.id,
        "patient_id": intake.patient_id,
        "patient_name": patient.name if patient else "Unknown",
        "patient_phone": patient.phone if patient else "",
        "patient_dob": patient.dob if patient else "",
        "visit_datetime": visit_dt.isoformat(),
        "visit_date_formatted": visit_dt.strftime("%d %b %Y"),
        "visit_time_formatted": visit_dt.strftime("%I:%M %p"),
        "patient_language": intake.patient_language,
        "language_name": lang_info.get("name", "English"),
        "native_name": lang_info.get("native_name", "English"),
        "raw_narration": intake.raw_narration or "",
        "translated_narration": intake.translated_narration or "",
        "doctor_summary_english": intake.translated_narration or structured.get("doctor_summary_english", ""),
        "chief_complaints": final_complaints,
        "symptom_duration": final_duration,
        "severity": final_severity,
        "recent_changes": final_changes,
        "additional_notes": final_notes,
        "structured_data": structured,
        "extracted_entities": structured.get("extracted_entities") or {
            "chief_complaints": final_complaints,
            "symptom_duration": final_duration,
            "severity": final_severity,
            "recent_changes": final_changes,
            "patient_concerns": final_notes
        },
        "conversation_history": structured.get("conversation_history") or [],
        "triage_priority": intake.triage_priority or "routine",
        "triage_flags": intake.triage_flags or [],
        "is_emergency": (intake.triage_priority == "priority_red_flag"),
        "source": intake.source or "patient_app",
        "source_label": "Hospital MediKiosk" if intake.source == "medikiosk" else "Patient Mobile App",
        "verification_status": intake.verification_status or "Pending Doctor Review",
        "doctor_notes": intake.doctor_notes or "",
        "created_at": intake.created_at.isoformat() if intake.created_at else None
    }
