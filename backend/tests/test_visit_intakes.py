import pytest
from datetime import datetime, timedelta
from app.database import SessionLocal, engine, Base
from app.models import Patient, VisitIntake
from app.routers.visit_intakes import (
    list_languages,
    preview_intake_structuring,
    create_visit_intake,
    list_patient_intakes,
    get_patient_intake,
    verify_patient_intake,
    delete_patient_intake,
    ProcessTextRequest,
    CreateVisitIntakeRequest,
    DoctorVerifyRequest
)
from app.services.languages import get_supported_languages
from app.services.triage import evaluate_emergency_triage

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Ensure test patient exists
    test_patient = db.query(Patient).filter(Patient.id == "CARE-INTAKE-01").first()
    if not test_patient:
        test_patient = Patient(
            id="CARE-INTAKE-01",
            name="Rajesh Kumar Sharma",
            phone="9876543210",
            dob="1978-05-15"
        )
        db.add(test_patient)
        db.commit()
    
    yield db
    db.close()


def test_supported_languages_registry():
    """Verifies that the declarative Indian regional language registry returns configured languages."""
    res = list_languages()
    assert "languages" in res
    assert res["default"] == "hi-IN"
    
    codes = [l["code"] for l in res["languages"]]
    assert "hi-IN" in codes  # Hindi
    assert "kn-IN" in codes  # Kannada
    assert "pa-IN" in codes  # Punjabi
    assert "ta-IN" in codes  # Tamil
    assert "te-IN" in codes  # Telugu
    assert "bn-IN" in codes  # Bengali
    assert "mr-IN" in codes  # Marathi
    assert "gu-IN" in codes  # Gujarati
    assert "ml-IN" in codes  # Malayalam
    assert "od-IN" in codes  # Odia
    assert "en-IN" in codes  # English


def test_deterministic_emergency_triage_rules():
    """Verifies red-flag detection across multiple languages and symptom keywords."""
    # Test 1: Acute chest pain (Hindi)
    triage_hi = evaluate_emergency_triage(
        raw_narration="मुझे 2 घंटे से सीने में दर्द और भारीपन लग रहा है",
        translated_narration="Patient reports chest pain and heaviness for 2 hours"
    )
    assert triage_hi["is_emergency"] is True
    assert triage_hi["triage_priority"] == "priority_red_flag"
    assert len(triage_hi["triage_flags"]) > 0

    # Test 2: Acute breathing difficulty (English)
    triage_resp = evaluate_emergency_triage(
        raw_narration="Severe shortness of breath at rest, cannot breathe properly"
    )
    assert triage_resp["is_emergency"] is True
    assert triage_resp["triage_priority"] == "priority_red_flag"

    # Test 3: Routine symptom (mild fever and headache)
    triage_routine = evaluate_emergency_triage(
        raw_narration="Mild headache and slight body pain since yesterday",
        translated_narration="Mild headache and slight body pain since yesterday"
    )
    assert triage_routine["is_emergency"] is False
    assert triage_routine["triage_priority"] == "routine"
    assert len(triage_routine["triage_flags"]) == 0


def test_preview_intake_structuring(db_session):
    """Tests real-time preview of multilingual intake structuring and adaptive follow-up generation."""
    payload = ProcessTextRequest(
        raw_narration="पिछले 3 दिनों से लगातार सरदर्द और चक्कर आ रहे हैं",
        patient_language="hi-IN",
        chief_complaints=["Headache", "Dizziness"]
    )
    res = preview_intake_structuring(patient_id="CARE-INTAKE-01", payload=payload, db=db_session)
    
    assert res["language_code"] == "hi-IN"
    assert res["raw_narration"] == "पिछले 3 दिनों से लगातार सरदर्द और चक्कर आ रहे हैं"
    assert "translated_narration" in res
    assert "triage_priority" in res
    assert "adaptive_followups" in res


def test_create_and_fetch_routine_intake(db_session):
    """Verifies intake creation, storage, and retrieval for a patient."""
    req = CreateVisitIntakeRequest(
        patient_language="hi-IN",
        raw_narration="पिछले 4 दिनों से खांसी और गले में खराश है। कल रात हल्का बुखार भी आया।",
        chief_complaints=["Cough", "Sore throat", "Low grade fever"],
        symptom_duration="4 days",
        severity="Moderate",
        recent_changes="Started taking warm water and honey",
        additional_notes="Patient has a dust allergy history",
        source="medikiosk"
    )
    
    created = create_visit_intake(patient_id="CARE-INTAKE-01", payload=req, db=db_session)
    
    assert created["id"] is not None
    assert created["patient_id"] == "CARE-INTAKE-01"
    assert created["source"] == "medikiosk"
    assert created["source_label"] == "Hospital MediKiosk"
    assert created["patient_language"] == "hi-IN"
    assert created["language_name"] == "Hindi"
    assert created["triage_priority"] == "routine"
    assert created["is_emergency"] is False
    assert created["verification_status"] == "Pending Doctor Review"
    assert "Cough" in created["chief_complaints"]

    # Retrieve single intake
    fetched = get_patient_intake(patient_id="CARE-INTAKE-01", intake_id=created["id"], db=db_session)
    assert fetched["id"] == created["id"]
    assert fetched["patient_name"] == "Rajesh Kumar Sharma"


def test_emergency_red_flag_persistence(db_session):
    """Verifies that an intake reporting chest pain persists as an emergency red flag with full disclaimer."""
    req = CreateVisitIntakeRequest(
        patient_language="en-IN",
        raw_narration="Crushing chest pain radiating to left arm with shortness of breath",
        chief_complaints=["Chest pain", "Shortness of breath"],
        symptom_duration="1 hour",
        severity="Severe",
        source="patient_app"
    )
    
    emergency_intake = create_visit_intake(patient_id="CARE-INTAKE-01", payload=req, db=db_session)
    
    assert emergency_intake["triage_priority"] == "priority_red_flag"
    assert emergency_intake["is_emergency"] is True
    assert len(emergency_intake["triage_flags"]) >= 1
    assert any("Cardiovascular" in flag for flag in emergency_intake["triage_flags"])
    assert emergency_intake["source"] == "patient_app"
    assert emergency_intake["source_label"] == "Patient Mobile App"


def test_append_only_multi_intake_isolation(db_session):
    """
    CRITICAL REQUIREMENT:
    Ensures that multiple intakes created on the same day remain distinct point-in-time snapshots
    and DO NOT overwrite each other.
    """
    # Create Morning Intake
    morning_req = CreateVisitIntakeRequest(
        patient_language="en-IN",
        raw_narration="Morning visit: Mild joint stiffness in right knee",
        chief_complaints=["Knee stiffness"],
        symptom_duration="1 week",
        severity="Mild",
        source="patient_app"
    )
    intake_1 = create_visit_intake(patient_id="CARE-INTAKE-01", payload=morning_req, db=db_session)

    # Create Afternoon Follow-up Intake
    afternoon_req = CreateVisitIntakeRequest(
        patient_language="kn-IN",
        raw_narration="Afternoon kiosk check: Knee swelling increased after walking",
        chief_complaints=["Knee swelling", "Pain"],
        symptom_duration="Today",
        severity="Moderate",
        source="medikiosk"
    )
    intake_2 = create_visit_intake(patient_id="CARE-INTAKE-01", payload=afternoon_req, db=db_session)

    assert intake_1["id"] != intake_2["id"]
    
    # Fetch all intakes for patient
    all_intakes = list_patient_intakes(patient_id="CARE-INTAKE-01", db=db_session)
    intake_ids = [i["id"] for i in all_intakes]
    
    # Both IDs MUST exist independently in the dataset
    assert intake_1["id"] in intake_ids
    assert intake_2["id"] in intake_ids
    
    # Latest intake appears first in the list
    assert intake_ids[0] == intake_2["id"]


def test_doctor_verification_and_notes(db_session):
    """Verifies clinician review, status transition to 'Reviewed', and addition of doctor notes."""
    # Create intake
    req = CreateVisitIntakeRequest(
        patient_language="en-IN",
        raw_narration="Routine consultation for blood pressure review",
        chief_complaints=["Hypertension review"],
        source="medikiosk"
    )
    intake = create_visit_intake(patient_id="CARE-INTAKE-01", payload=req, db=db_session)
    assert intake["verification_status"] == "Pending Doctor Review"

    # Clinician reviews and adds note
    verify_req = DoctorVerifyRequest(
        doctor_notes="BP measured 132/84 mmHg. Prescribed Amlodipine 5mg continued. Regular morning walk advised.",
        status="Reviewed"
    )
    verified = verify_patient_intake(
        patient_id="CARE-INTAKE-01",
        intake_id=intake["id"],
        payload=verify_req,
        db=db_session
    )
    
    assert verified["verification_status"] == "Reviewed"
    assert "Amlodipine" in verified["doctor_notes"]


def test_long_audio_wav_chunking_bypass_30s_limit():
    """Verifies that audio longer than 30 seconds is automatically split into <= 24s segments."""
    import io, wave, struct
    from app.services.speech import _split_wav_bytes

    # Synthesize 60 seconds of WAV audio (2x Sarvam 30s limit)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(b''.join([struct.pack('<h', 0) for _ in range(60 * 16000)]))

    chunks = _split_wav_bytes(buf.getvalue(), chunk_duration_sec=24)
    assert len(chunks) == 3  # 24s, 24s, 12s

    # Verify each chunk is a valid WAV and <= 24s
    for ch in chunks:
        with wave.open(io.BytesIO(ch), 'rb') as cw:
            dur = cw.getnframes() / cw.getframerate()
            assert dur <= 24.0


def test_conversational_turn_flow(db_session):
    """Verifies that conversational turns dynamically understand patient speech and extract clinical entities."""
    from app.routers.visit_intakes import handle_conversation_turn, ConversationTurnRequest

    # Turn 1: Patient reports fever and cough for 3 days in Hindi
    req = ConversationTurnRequest(
        conversation_history=[
            {"role": "assistant", "content": "नमस्ते। कृपया बताइए कि आज आपको क्या परेशानी या लक्षण हो रहे हैं?"},
            {"role": "user", "content": "मुझे पिछले 3 दिनों से तेज बुखार और खांसी आ रही है।"}
        ],
        language_code="hi-IN",
        synthesize_audio=False
    )
    res = handle_conversation_turn(patient_id="CARE-INTAKE-01", payload=req, db=db_session)
    
    assert res["language_code"] == "hi-IN"
    assert "doctor_summary_english" in res
    assert res["doctor_summary_english"] != ""
    assert "extracted_entities" in res
    entities = res["extracted_entities"]
    assert "chief_complaints" in entities
    assert "triage" in res
    assert res["triage"]["triage_priority"] in ("routine", "priority_red_flag")


def test_conversational_turn_adaptive_followup(db_session):
    """Verifies that incomplete complaints generate an empathetic next question in patient's tongue."""
    from app.routers.visit_intakes import handle_conversation_turn, ConversationTurnRequest

    # Single turn with just a symptom without duration
    req = ConversationTurnRequest(
        conversation_history=[
            {"role": "user", "content": "खांसी हो रही है"}
        ],
        language_code="hi-IN",
        synthesize_audio=False
    )
    res = handle_conversation_turn(patient_id="CARE-INTAKE-01", payload=req, db=db_session)
    
    assert "next_question" in res
    assert len(res["next_question"]) > 0


def test_delete_visit_intake(db_session):
    """Verifies that an intake can be deleted and is no longer retrievable."""
    req = CreateVisitIntakeRequest(
        patient_language="en-IN",
        raw_narration="Temporary intake to be deleted",
        chief_complaints=["Mild fatigue"],
        symptom_duration="1 day",
        severity="Mild"
    )
    created = create_visit_intake(patient_id="CARE-INTAKE-01", payload=req, db=db_session)
    intake_id = created["id"]

    # Verify it exists
    fetched = get_patient_intake(patient_id="CARE-INTAKE-01", intake_id=intake_id, db=db_session)
    assert fetched["id"] == intake_id

    # Delete the intake
    del_res = delete_patient_intake(intake_id=intake_id, patient_id="CARE-INTAKE-01", db=db_session)
    assert del_res["id"] == intake_id

    # Verify it is no longer found
    with pytest.raises(Exception):
        get_patient_intake(patient_id="CARE-INTAKE-01", intake_id=intake_id, db=db_session)


def test_finalize_patient_intake(db_session):
    """Verifies that the finalize endpoint synthesizes structured entities and English doctor summary."""
    from app.routers.visit_intakes import finalize_patient_intake, FinalizeIntakeRequest

    history = [
        {"role": "assistant", "content": "Hello. Please describe your symptoms today."},
        {"role": "user", "content": "I have had a high fever and dry cough for 3 days."},
        {"role": "assistant", "content": "Are you having any breathing difficulty?"},
        {"role": "user", "content": "No breathing difficulty, but severe body ache and fatigue."}
    ]

    req = FinalizeIntakeRequest(
        conversation_history=history,
        language_code="en-IN",
        chief_complaints=["Fever", "Dry cough"]
    )
    res = finalize_patient_intake(patient_id="CARE-INTAKE-01", payload=req, db=db_session)

    assert "doctor_summary_english" in res
    assert len(res["doctor_summary_english"]) > 10
    assert "extracted_entities" in res
    assert "chief_complaints" in res["extracted_entities"]
    assert "symptom_duration" in res["extracted_entities"]
    assert "triage" in res
    assert "triage_priority" in res["triage"]


def test_hindi_throat_fever_final_summary_quality():
    """
    Verifies that the final clinical extraction accurately preserves specific complaints:
    throat problem, duration (2 days), fever, and relevant negatives (no other difficulty),
    and strictly avoids generic collapsing into 'Patient presents with pain / discomfort'.
    """
    from app.services.clinical_intake_ai import finalize_clinical_intake

    history = [
        {"role": "assistant", "content": "नमस्ते! आपको क्या परेशानी हो रही है?"},
        {
            "role": "user", 
            "content": "मुझे दो दिन से गले में बहुत ज़्यादा तकलीफ़ है और हल्का-हल्का बुखार भी आ रहा है। मुझे कोई और ऐसी परेशानी नहीं है।"
        }
    ]

    result = finalize_clinical_intake(
        conversation_history=history,
        language_code="hi-IN"
    )

    summary = result.get("doctor_summary_english", "")
    entities = result.get("extracted_entities", {})
    complaints = entities.get("chief_complaints", [])

    # Doctor summary must NOT be generic placeholder
    assert "pain / discomfort" not in summary.lower()
    assert not summary.startswith("Patient presents with")

    # Doctor summary must contain throat, fever, and duration in English
    summary_lower = summary.lower()
    assert "throat" in summary_lower
    assert "fever" in summary_lower
    assert "2 days" in summary_lower or "two days" in summary_lower

    # Structured complaints must reflect specific problems
    complaints_lower = [c.lower() for c in complaints]
    assert any("throat" in c for c in complaints_lower)
    assert any("fever" in c for c in complaints_lower)

    # Relevant negatives should be captured
    rel_neg = entities.get("relevant_negatives", [])
    assert len(rel_neg) > 0


def test_placeholder_summary_leakage_prevented_on_save(db_session):
    """
    Verifies that if a client sends an interim placeholder summary on save,
    the backend detects that it is not finalized, automatically invokes
    finalize_clinical_intake, and persists the rich authoritative summary.
    """
    history = [
        {"role": "assistant", "content": "नमस्ते! आपको क्या परेशानी हो रही है?"},
        {
            "role": "user", 
            "content": "मुझे दो दिन से गले में बहुत ज़्यादा तकलीफ़ है और हल्का-हल्का बुखार भी आ रहा है। मुझे कोई और ऐसी परेशानी नहीं है।"
        }
    ]

    # Client payload simulating live interim placeholder leakage
    req = CreateVisitIntakeRequest(
        patient_language="hi-IN",
        raw_narration="मुझे दो दिन से गले में बहुत ज़्यादा तकलीफ़ है...",
        doctor_summary_english="Patient presents with pain / discomfort. Communicated in Hindi.",
        chief_complaints=["Pain / Discomfort"],
        extracted_entities={"chief_complaints": ["Pain / Discomfort"]},
        conversation_history=history,
        source="patient_app"
    )

    created = create_visit_intake(patient_id="CARE-INTAKE-01", payload=req, db=db_session)

    # The backend must NOT persist the placeholder
    assert "Patient presents with pain / discomfort" not in created["doctor_summary_english"]
    assert "throat" in created["doctor_summary_english"].lower()
    assert "fever" in created["doctor_summary_english"].lower()

    # The complaints must NOT be 'Pain / Discomfort'
    assert created["chief_complaints"] != ["Pain / Discomfort"]
    complaints_lower = [c.lower() for c in created["chief_complaints"]]
    assert any("throat" in c for c in complaints_lower)




