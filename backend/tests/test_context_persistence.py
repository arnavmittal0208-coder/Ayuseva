import json
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import Patient, InsurancePolicy, Record, Claim, ClinicalContext
from app.routers.records import upload_medical_record
from app.routers.claims import initialize_cashless_claim, CashlessInitRequest
from fastapi import HTTPException
import pytest
from unittest.mock import MagicMock
from sqlalchemy import text
import asyncio

async def run_context_persistence_flow():
    print("--- Starting Clinical Context Persistence & Deduplication Tests ---")
    
    # 1. Setup DB
    Base.metadata.create_all(bind=engine)
    from app.main import check_and_add_columns, run_one_time_consolidation
    check_and_add_columns()
    db = SessionLocal()

    patient_id = "CARE-CONTEXT-TEST"
    
    # Mocking UploadFile wrapper for tests
    class MockUploadFile:
        def __init__(self, filename, content_type, content_bytes):
            self.filename = filename
            self.content_type = content_type
            self.content_bytes = content_bytes
        async def read(self):
            return self.content_bytes

    try:
        # Clean isolation
        db.query(Claim).filter(Claim.patient_id == patient_id).delete()
        db.query(Record).filter(Record.patient_id == patient_id).delete()
        db.query(ClinicalContext).filter(ClinicalContext.patient_id == patient_id).delete()
        db.query(InsurancePolicy).filter(InsurancePolicy.patient_id == patient_id).delete()
        db.query(Patient).filter(Patient.id == patient_id).delete()
        db.commit()

        # Create patient & policy
        patient = Patient(id=patient_id, name="Episode Test Patient")
        db.add(patient)
        db.commit()

        policy = InsurancePolicy(
            patient_id=patient_id,
            insurer="Star Health",
            insurer_email="claims@star.co.in",
            policy_number="POL-CONTEXT-77",
            status="Active"
        )
        db.add(policy)
        db.commit()

        # Mock parser and AI matcher services
        import app.routers.records
        import app.services.claims_ai

        # Document 1: Discharge Summary (with surgery advice)
        parsed_doc_1 = {
            "record_type": "Discharge Summary",
            "date": "2026-08-10",
            "diagnoses": ["Traumatic Subdural Hematoma", "Brain Swelling"],
            "surgery_advised": True,
            "procedure_details": {
                "name": "Emergency Craniotomy",
                "estimated_cost": 250000.0
            }
        }

        # Document 2: Medicine Invoice
        parsed_doc_2 = {
            "record_type": "Billing Document",
            "date": "2026-08-11",
            "diagnoses": ["Brain Injury Medication Cost"],
            "medications": [{"name": "Levetiracetam", "dosage": "500mg"}]
        }

        # Mock parsing result
        app.routers.records.parse_medical_document = MagicMock(side_effect=[parsed_doc_1, parsed_doc_2])

        # Mock context matcher
        # Call 1: Matches nothing -> creates context "Brain Surgery / Major Accident"
        mock_matcher = MagicMock(side_effect=[
            {
                "matched_context_id": None,
                "suggested_context_name": "Brain Surgery / Major Accident",
                "suggested_context_kind": "acute_active",
                "reason": "First document of episode"
            }
        ])
        app.routers.records.match_document_to_clinical_context = mock_matcher
        app.services.claims_ai.match_document_to_clinical_context = mock_matcher

        def mock_consolidate(patient_demo, records_data):
            return {
                "contexts": [
                    {
                        "name": "Brain Surgery / Major Accident",
                        "kind": "acute_active",
                        "reason": "Consolidated test context",
                        "record_ids": [r["id"] for r in records_data]
                    }
                ]
            }
        app.services.claims_ai.consolidate_existing_patient_records_ai = mock_consolidate

        # Trigger upload of Document 1
        upload_result_1 = await upload_medical_record(
            file=MockUploadFile("report.pdf", "application/pdf", b"test report content"),
            patient_id=patient_id,
            db=db
        )
        
        # Verify Context 1 created
        contexts = db.query(ClinicalContext).filter(ClinicalContext.patient_id == patient_id).all()
        assert len(contexts) == 1
        ctx1 = contexts[0]
        assert ctx1.name == "Brain Surgery / Major Accident"
        
        # Verify Record 1 linked
        rec1 = db.query(Record).filter(Record.id == upload_result_1["record_id"]).first()
        assert rec1.clinical_context_id == ctx1.id

        # Verify cashless claim scaffolded
        claims = db.query(Claim).filter(Claim.patient_id == patient_id).all()
        assert len(claims) == 1
        claim1 = claims[0]
        assert claim1.clinical_context_id == ctx1.id
        assert claim1.procedure_name == "Emergency Craniotomy"

        # Update mock matcher for the second call to return the created context ID
        mock_matcher.side_effect = [
            {
                "matched_context_id": ctx1.id,
                "suggested_context_name": None,
                "suggested_context_kind": None,
                "reason": "Billing matches ongoing brain surgery episode"
            }
        ]

        # Trigger upload of Document 2 (Medicine Invoice)
        upload_result_2 = await upload_medical_record(
            file=MockUploadFile("bill.pdf", "application/pdf", b"test bill content"),
            patient_id=patient_id,
            db=db
        )

        # Verify NO duplicate context created
        contexts_after = db.query(ClinicalContext).filter(ClinicalContext.patient_id == patient_id).all()
        assert len(contexts_after) == 1
        
        # Verify Record 2 linked to same context
        rec2 = db.query(Record).filter(Record.id == upload_result_2["record_id"]).first()
        assert rec2.clinical_context_id == ctx1.id

        # Verify NO duplicate claim created
        claims_after = db.query(Claim).filter(Claim.patient_id == patient_id).all()
        assert len(claims_after) == 1

        # Test Case: Initializing via claim portal uses context
        # It should return the existing claim rather than duplicating it
        init_res = initialize_cashless_claim(
            patient_id=patient_id,
            req=CashlessInitRequest(clinical_context="Brain Surgery / Major Accident"),
            db=db
        )
        assert init_res.id == claim1.id
        
        claims_final = db.query(Claim).filter(Claim.patient_id == patient_id).all()
        assert len(claims_final) == 1

        # Test Case: One-time/versioned consolidation checks
        # Create a mock duplicate claim to test startup consolidation & deduplication
        dup_claim = Claim(
            patient_id=patient_id,
            policy_id=policy.id,
            clinical_context_id=ctx1.id,
            clinical_context=ctx1.name,
            procedure_name="Craniotomy Dup",
            status="Draft",
            selected_records=[rec2.id]
        )
        db.add(dup_claim)
        db.commit()

        # Verify 2 claims exist before migration
        assert len(db.query(Claim).filter(Claim.patient_id == patient_id).all()) == 2

        # Reset migration version to re-trigger consolidation
        db.execute(text("CREATE TABLE IF NOT EXISTS migration_meta (version VARCHAR PRIMARY KEY)"))
        db.commit()
        db.execute(text("DELETE FROM migration_meta WHERE version = 'clinical_context_v2'"))
        db.commit()

        # Run consolidation
        run_one_time_consolidation()

        # Verify duplicate claim was merged/deleted
        claims_consolidated = db.query(Claim).filter(Claim.patient_id == patient_id).all()
        assert len(claims_consolidated) == 1
        assert rec2.id in claims_consolidated[0].selected_records

    finally:
        # Cleanup
        db.query(Claim).filter(Claim.patient_id == patient_id).delete()
        db.query(Record).filter(Record.patient_id == patient_id).delete()
        db.query(ClinicalContext).filter(ClinicalContext.patient_id == patient_id).delete()
        db.query(InsurancePolicy).filter(InsurancePolicy.patient_id == patient_id).delete()
        db.query(Patient).filter(Patient.id == patient_id).delete()
        db.commit()
        db.close()

def test_context_persistence():
    asyncio.run(run_context_persistence_flow())

def test_dynamic_hierarchy_and_simplification():
    from app.services.claims_ai import simplify_clinical_name, match_name_to_contexts, run_heuristic_consolidation
    
    # 1. Test simplify_clinical_name
    assert simplify_clinical_name("Type 2 Diabetes Mellitus") == "Diabetes"
    assert simplify_clinical_name("Essential Hypertension") == "Hypertension"
    assert simplify_clinical_name("Uncomplicated Viral Febrile Illness") == "Viral"
    assert simplify_clinical_name("Right-sided craniotomy with evacuation") == "Right Sided Craniotomy With Evacuation"
    
    # 2. Test match_name_to_contexts
    existing = [
        {"id": 1, "name": "Diabetes"},
        {"id": 2, "name": "Hypertension"}
    ]
    # Specific maps to existing broader context
    assert match_name_to_contexts("Type 2 Diabetes Mellitus", existing) == 1
    assert match_name_to_contexts("Essential Hypertension", existing) == 2
    # Genuinely different condition doesn't match
    assert match_name_to_contexts("Pneumonia", existing) is None
    
    # 3. Test run_heuristic_consolidation
    records = [
        {"id": 10, "parsed_json": {"diagnoses": ["Type 2 Diabetes Mellitus"]}},
        {"id": 11, "parsed_json": {"medications": [{"name": "Metformin"}]}},
        {"id": 12, "parsed_json": {"diagnoses": ["Essential Hypertension"]}}
    ]
    res = run_heuristic_consolidation(records)
    # Should group records 10, 11, and 12 into separate contexts locally since Metformin -> Diabetes mapping requires the LLM
    contexts = res["contexts"]
    assert len(contexts) == 3
    
    diabetes_ctx = next(c for c in contexts if c["name"] == "Diabetes")
    metformin_ctx = next(c for c in contexts if c["name"] == "Metformin")
    hypertension_ctx = next(c for c in contexts if c["name"] == "Hypertension")
    
    assert set(diabetes_ctx["record_ids"]) == {10}
    assert set(metformin_ctx["record_ids"]) == {11}
    assert set(hypertension_ctx["record_ids"]) == {12}
