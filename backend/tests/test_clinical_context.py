from datetime import datetime

from app.services.clinical_context import detect_clinical_contexts, records_for_context


def _rec(rid, date, diagnoses, meds=None, labs=None, allergies=None):
    return {
        "id": rid,
        "date": date,
        "record_type": "Other",
        "parsed_json": {
            "diagnoses": diagnoses,
            "medications": meds or [],
            "lab_results": labs or [],
            "allergies": allergies or [],
        },
    }


NOW = datetime(2026, 8, 21)


def test_empty_patient_has_no_contexts():
    result = detect_clinical_contexts([], reference_date=NOW)
    assert result["contexts"] == []
    assert result["default_context_id"] is None


def test_viral_fever_only_is_not_a_clinical_context():
    records = [
        _rec(1, "2026-08-10", ["Viral Fever", "Sore throat", "Body ache"], meds=[
            {"name": "Paracetamol", "duration": "5 days"}
        ]),
    ]
    result = detect_clinical_contexts(records, reference_date=NOW)
    assert result["contexts"] == []


def test_diabetes_is_auto_detected_and_defaulted():
    records = [
        _rec(1, "2026-08-20", ["Type 2 Diabetes Mellitus"], labs=[
            {"test_name": "HbA1c", "result": "6.8", "unit": "%"}
        ]),
    ]
    result = detect_clinical_contexts(records, reference_date=NOW)
    labels = [c["label"].lower() for c in result["contexts"]]
    assert len(result["contexts"]) == 1
    assert any("diabetes" in lbl for lbl in labels)
    assert result["default_context_id"] == result["contexts"][0]["id"]


def test_diabetes_prescription_stays_in_same_context():
    records = [
        _rec(1, "2026-08-20", ["Diabetes"], labs=[{"test_name": "HbA1c", "result": "6.8"}]),
        _rec(2, "2026-08-21", ["Diabetes"], meds=[{"name": "Metformin", "duration": "continuous"}]),
    ]
    result = detect_clinical_contexts(records, reference_date=NOW)
    assert len(result["contexts"]) == 1
    ctx = result["contexts"][0]
    assert 1 in ctx["record_ids"]
    assert 2 in ctx["record_ids"]


def test_viral_fever_does_not_clutter_diabetes_context():
    records = [
        _rec(1, "2026-08-10", ["Viral Fever"], meds=[{"name": "Paracetamol", "duration": "3 days"}]),
        _rec(2, "2026-08-20", ["Diabetes Mellitus"]),
        _rec(3, "2026-08-21", ["Diabetes"], meds=[{"name": "Metformin", "duration": "continuous"}]),
    ]
    result = detect_clinical_contexts(records, reference_date=NOW)
    labels = [c["label"].lower() for c in result["contexts"]]
    assert any("diabetes" in lbl for lbl in labels)
    assert not any("viral" in lbl or "fever" in lbl for lbl in labels)
    diabetes = result["contexts"][0]
    focused = records_for_context(records, diabetes)
    focused_ids = {r["id"] for r in focused}
    assert 2 in focused_ids
    assert 3 in focused_ids
    assert 1 not in focused_ids


def test_multiple_conditions_become_separate_contexts():
    records = [
        _rec(1, "2026-01-10", ["Diabetes"]),
        _rec(2, "2026-03-10", ["Rheumatoid Arthritis"]),
        _rec(3, "2026-06-10", ["Hypertension"]),
        _rec(4, "2026-08-01", ["Diabetes"], meds=[{"name": "Metformin", "duration": "continuous"}]),
        _rec(5, "2026-08-05", ["Arthritis"], meds=[{"name": "Methotrexate", "duration": "continuous"}]),
        _rec(6, "2026-08-10", ["Hypertension"], meds=[{"name": "Amlodipine", "duration": "continuous"}]),
    ]
    result = detect_clinical_contexts(records, reference_date=NOW)
    blob = " ".join(c["label"].lower() for c in result["contexts"])
    assert "diabetes" in blob
    assert "arthritis" in blob
    assert "hypertension" in blob
    assert len(result["contexts"]) == 3


def test_fever_then_typhoid_becomes_typhoid_context():
    records = [
        _rec(1, "2026-08-10", ["Fever"]),
        _rec(2, "2026-08-13", ["Fever"]),
        _rec(3, "2026-08-16", [], labs=[{"test_name": "Widal", "result": "Positive"}]),
        _rec(4, "2026-08-18", ["Typhoid"]),
        _rec(5, "2026-08-20", ["Typhoid"], meds=[{"name": "Ceftriaxone", "duration": "14 days"}]),
    ]
    result = detect_clinical_contexts(records, reference_date=NOW)
    labels = [c["label"].lower() for c in result["contexts"]]
    assert any("typhoid" in lbl for lbl in labels)
    assert not any(lbl.strip() == "fever" for lbl in labels)
    typhoid = next(c for c in result["contexts"] if "typhoid" in c["label"].lower())
    assert 1 in typhoid["record_ids"]
    assert 4 in typhoid["record_ids"]
    assert 5 in typhoid["record_ids"]


def test_contexts_are_derived_only_from_provided_records():
    patient_a = [_rec(1, "2026-08-20", ["Diabetes"])]
    patient_b = [_rec(2, "2026-08-20", ["Arthritis"])]
    a = detect_clinical_contexts(patient_a, reference_date=NOW)
    b = detect_clinical_contexts(patient_b, reference_date=NOW)
    assert any("diabetes" in c["label"].lower() for c in a["contexts"])
    assert any("arthritis" in c["label"].lower() for c in b["contexts"])
    assert not any("arthritis" in c["label"].lower() for c in a["contexts"])
    assert not any("diabetes" in c["label"].lower() for c in b["contexts"])


def test_visit_reason_selects_default_among_multiple():
    records = [
        _rec(1, "2026-08-01", ["Diabetes"], meds=[{"name": "Metformin", "duration": "continuous"}]),
        _rec(2, "2026-08-18", ["Asthma"], meds=[{"name": "Budesonide inhaler", "duration": "continuous"}]),
    ]
    result = detect_clinical_contexts(records, current_visit_reason="asthma follow up", reference_date=NOW)
    default = next(c for c in result["contexts"] if c["id"] == result["default_context_id"])
    assert "asthma" in default["label"].lower()


def test_patient_portal_clinical_brief_constraints():
    from app.database import SessionLocal, Base, engine
    from app.models import Patient, ClinicalBrief
    from app.routers.patients import get_clinical_brief
    from fastapi import HTTPException
    
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    uid = "CARE-TESTBRIEF"
    patient = db.query(Patient).filter(Patient.id == uid).first()
    if not patient:
        patient = Patient(id=uid, name="Brief Test Patient")
        db.add(patient)
        db.commit()
        
    from app.models import Record
    db.query(Record).filter(Record.patient_id == uid).delete()
    db.commit()
    
    dummy_record = Record(
        patient_id=uid,
        record_type="Prescription",
        date="2026-08-20",
        file_path="uploads/dummy.pdf",
        parsed_json={}
    )
    db.add(dummy_record)
    db.commit()
        
    db.query(ClinicalBrief).filter(ClinicalBrief.patient_id == uid).delete()
    db.commit()
    
    # 1. Querying with generate_if_missing=False when summary is missing should raise 404
    try:
        get_clinical_brief(
            uid=uid,
            summary_type="complete",
            specialty="General",
            disease_focus=None,
            current_visit_reason=None,
            generate_if_missing=False,
            x_user_role=None,
            x_patient_uid=None,
            db=db
        )
        assert False, "Should have raised 404 when summary is missing"
    except HTTPException as e:
        assert e.status_code == 404
        assert "not been generated by the hospital admin" in e.detail

    # 2. Querying other patient data as role=patient should raise 403 (Patient Isolation)
    try:
        get_clinical_brief(
            uid=uid,
            summary_type="complete",
            specialty="General",
            disease_focus=None,
            current_visit_reason=None,
            generate_if_missing=True,
            x_user_role="patient",
            x_patient_uid="CARE-OTHER",
            db=db
        )
        assert False, "Should have raised 403 for mismatched patient UID"
    except HTTPException as e:
        assert e.status_code == 403
        assert "Access denied" in e.detail
        
    # 3. Querying same patient data as role=patient should bypass 403 and hit 404 (isolation bypass success)
    try:
        get_clinical_brief(
            uid=uid,
            summary_type="complete",
            specialty="General",
            disease_focus=None,
            current_visit_reason=None,
            generate_if_missing=False,
            x_user_role="patient",
            x_patient_uid=uid,
            db=db
        )
        assert False, "Should have raised 404 since no brief exists yet"
    except HTTPException as e:
        assert e.status_code == 404
        
    db.close()
