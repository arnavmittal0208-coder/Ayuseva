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
