import json
import os
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import Patient, Record
from app.routers.patients import get_clinical_brief, register_patient, PatientCreate

def test_brief_caching():
    print("--- Starting In-Process Clinical Brief Caching Verification ---")
    
    # 1. Setup in-process DB session
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    import app.routers.patients
    import app.services.clinical_brief
    
    original_generate = app.services.clinical_brief.generate_clinical_brief
    call_count = 0

    def mock_generate(records, specialty, summary_type, disease_focus, current_visit_reason):
        nonlocal call_count
        call_count += 1
        return {
            "specialty": specialty,
            "summary_type": summary_type,
            "clinical_summary": f"Mock summary version {call_count}",
            "active_problems": [],
            "current_medications": [],
            "warnings": [],
            "treatment_gaps": [],
            "relevance_metrics": []
        }

    # Bind the mock to both references
    app.routers.patients.generate_clinical_brief = mock_generate
    app.services.clinical_brief.generate_clinical_brief = mock_generate
    
    uid = None
    try:
        # Register a test patient
        patient_in = PatientCreate(
            name="Caching Patient A",
            phone="8888888881",
            dob="1980-01-01",
            insurer="Star Health"
        )
        patient = register_patient(patient_in, db)
        uid = patient.id
        print(f"Registered patient in-process: {uid}")
        
        # 2. Query empty timeline brief
        empty_brief = get_clinical_brief(
            uid=uid,
            summary_type="complete",
            specialty="General",
            disease_focus=None,
            current_visit_reason=None,
            db=db
        )
        print("Empty brief fetched successfully.")
        
        # 3. Directly insert a record into DB to simulate EMR upload
        rec1 = Record(
            patient_id=uid,
            record_type="Prescription",
            date="2026-08-22",
            file_path="uploads/caching_1.pdf",
            parsed_json={
                "record_type": "Prescription",
                "date": "2026-08-22",
                "diagnoses": ["Hypertension"],
                "medications": [{"name": "Amlodipine", "dosage": "5mg", "frequency": "Once daily"}]
            }
        )
        db.add(rec1)
        db.commit()
        print("Uploaded Record #1.")
        
        # 4. Generate brief for the first time
        brief_first = get_clinical_brief(
            uid=uid,
            summary_type="complete",
            specialty="General",
            disease_focus=None,
            current_visit_reason=None,
            db=db
        )
        print("First generation brief:", brief_first["clinical_summary"])
        assert brief_first["clinical_summary"] == "Mock summary version 1"
        assert call_count == 1
        
        # 5. Fetch again immediately (should hit SQLite cache, NO LLM call)
        brief_second = get_clinical_brief(
            uid=uid,
            summary_type="complete",
            specialty="General",
            disease_focus=None,
            current_visit_reason=None,
            db=db
        )
        print("Second fetch (cached):", brief_second["clinical_summary"])
        assert brief_first["clinical_summary"] == brief_second["clinical_summary"], "Cached content mismatch"
        assert call_count == 1
        print("Caching verified successfully: Second fetch didn't call generator!")
        
        # 6. Upload a new record for the same patient (invalidating the cache)
        rec2 = Record(
            patient_id=uid,
            record_type="Prescription",
            date="2026-08-23",
            file_path="uploads/caching_2.pdf",
            parsed_json={
                "record_type": "Prescription",
                "date": "2026-08-23",
                "diagnoses": ["Hypertension"],
                "medications": [{"name": "Telmisartan", "dosage": "40mg", "frequency": "Once daily"}]
            }
        )
        db.add(rec2)
        db.commit()
        print("Uploaded Record #2 (invalidating cache).")
        
        # 7. Generate brief after change (should call generate since record hash changed)
        brief_third = get_clinical_brief(
            uid=uid,
            summary_type="complete",
            specialty="General",
            disease_focus=None,
            current_visit_reason=None,
            db=db
        )
        print("Third generation (after invalidation):", brief_third["clinical_summary"])
        assert brief_third["clinical_summary"] == "Mock summary version 2"
        assert call_count == 2
        
        # 8. Fetch fourth time immediately (should hit SQLite cache again for new version)
        brief_fourth = get_clinical_brief(
            uid=uid,
            summary_type="complete",
            specialty="General",
            disease_focus=None,
            current_visit_reason=None,
            db=db
        )
        print("Fourth fetch (cached new version):", brief_fourth["clinical_summary"])
        assert brief_third["clinical_summary"] == brief_fourth["clinical_summary"], "New cached content mismatch"
        assert call_count == 2
        print("Invalidation and re-caching verified successfully!")
        print("--- In-Process Clinical Brief Caching Verification SUCCESSFUL ---")
    finally:
        # Cleanup session and restore mock
        try:
            if uid:
                patient_to_del = db.query(Patient).filter(Patient.id == uid).first()
                if patient_to_del:
                    db.delete(patient_to_del)
                    db.commit()
        except Exception as e:
            print("Failed to delete test patient:", e)
        db.close()
        app.routers.patients.generate_clinical_brief = original_generate
        app.services.clinical_brief.generate_clinical_brief = original_generate

if __name__ == "__main__":
    test_brief_caching()
