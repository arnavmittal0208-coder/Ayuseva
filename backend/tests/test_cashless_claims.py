import json
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import Patient, InsurancePolicy, Record, Claim
from app.routers.claims import initialize_cashless_claim, update_claim_details, submit_preauth_claim, simulate_insurer_response, delete_claim, CashlessInitRequest, CashlessUpdateRequest, ClaimSimulationRequest
from fastapi import HTTPException
import pytest

def test_cashless_claims_workflow():
    print("--- Starting Cashless Claims Workflow Integration Tests ---")
    
    # 1. Setup in-process DB
    Base.metadata.create_all(bind=engine)
    from app.main import check_and_add_columns
    check_and_add_columns()
    db = SessionLocal()
    
    # 2. Mock AI reasoning service
    import app.routers.claims
    import app.services.claims_ai

    def mock_analyze(patient_data, policy_data, records_data, clinical_context):
        return {
            "relevant_records": [
                {"record_id": 1, "relevance": "High", "explanation": "Direct match for context"},
                {"record_id": 2, "relevance": "Low", "explanation": "Unrelated checkup record"}
            ],
            "policy_check": {
                "status": "Appears Eligible",
                "coverage_summary": "Policy covers brain surgeries up to 100% of sum insured.",
                "exclusions_found": [],
                "required_documents": ["Identity Proof", "Estimate Sheet"]
            },
            "missing_info": [
                "Proposed admission date not found"
            ],
            "cashless_form": {
                "diagnosis": "Severe Traumatic Brain Injury",
                "treatment_procedure": "Emergency Craniotomy",
                "admission_date": "Not available in current records",
                "estimated_cost": 250000.0,
                "clinical_findings": "Patient presented after motor vehicle accident."
            },
            "email_preview": {
                "recipient": "tpa-claims@starhealth.co.in",
                "subject": "Pre-Auth Cashless Claim Request [AyuSeva] - Emergency Craniotomy - CARE-TEST88",
                "body": "Dear Star Health Team,\n\nPlease approve cashless pre-authorization for Arnav Mittal."
            }
        }

    app.routers.claims.analyze_cashless_claim_context = mock_analyze
    app.services.claims_ai.analyze_cashless_claim_context = mock_analyze

    patient_id = "CARE-TEST88"
    
    try:
        # Clean up existing test state
        db.query(Claim).filter(Claim.patient_id == patient_id).delete()
        db.query(Record).filter(Record.patient_id == patient_id).delete()
        db.query(InsurancePolicy).filter(InsurancePolicy.patient_id == patient_id).delete()
        db.query(Patient).filter(Patient.id == patient_id).delete()
        db.commit()

        # Test Case A: Initializing without active policy should fail
        patient = Patient(id=patient_id, name="Arnav Mittal", dob="1999-10-15", phone="9988776655")
        db.add(patient)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            initialize_cashless_claim(
                patient_id=patient_id,
                req=CashlessInitRequest(clinical_context="Brain Surgery / Major Accident"),
                db=db
            )
        assert exc_info.value.status_code == 400
        assert "no active insurance policy" in exc_info.value.detail

        # Create active insurance policy
        policy = InsurancePolicy(
            patient_id=patient_id,
            insurer="Star Health",
            insurer_email="tpa-claims@starhealth.co.in",
            policy_number="POL-12345",
            sum_insured=500000.0,
            status="Active"
        )
        db.add(policy)

        # Create some EMR records
        r1 = Record(id=1, patient_id=patient_id, record_type="Discharge Summary", date="2026-08-20", parsed_json={"test": "craniotomy"})
        r2 = Record(id=2, patient_id=patient_id, record_type="Lab Report", date="2026-05-12", parsed_json={"HbA1c": 6.2})
        db.add(r1)
        db.add(r2)
        db.commit()

        # Test Case B: Initialize cashless claim successfully
        claim = initialize_cashless_claim(
            patient_id=patient_id,
            req=CashlessInitRequest(clinical_context="Brain Surgery / Major Accident"),
            db=db
        )
        assert claim.clinical_context == "Brain Surgery / Major Accident"
        assert claim.status == "Missing Information"  # Due to missing_info list
        assert claim.estimated_cost == 250000.0
        assert claim.procedure_name == "Emergency Craniotomy"
        assert 1 in claim.selected_records
        assert 2 not in claim.selected_records  # Low relevance, not auto-attached
        assert claim.policy_check_status == "Appears Eligible"

        # Test Case C: Update cashless claim details (edits by admin)
        updated = update_claim_details(
            claim_id=claim.id,
            req=CashlessUpdateRequest(
                procedure_name="Elective Craniotomy",
                estimated_cost=300000.0,
                status="Ready to Send",
                selected_records=[1]
            ),
            db=db
        )
        assert updated.procedure_name == "Elective Craniotomy"
        assert updated.estimated_cost == 300000.0
        assert updated.status == "Ready to Send"

        # Test Case D: Submit cashless claim (triggers resend mail dispatch)
        # Ensure status only changes to Sent on email success
        import app.routers.claims
        original_send = app.routers.claims.send_html_email

        # 1. Simulate mail send failure
        app.routers.claims.send_html_email = lambda *args, **kwargs: False
        with pytest.raises(HTTPException) as submit_exc:
            submit_preauth_claim(claim_id=claim.id, db=db)
        
        # Verify status is Failed (or appropriate retry state) and not Sent
        db.refresh(claim)
        assert claim.status == "Failed"

        # 2. Simulate mail send success
        app.routers.claims.send_html_email = lambda *args, **kwargs: True
        res = submit_preauth_claim(claim_id=claim.id, db=db)
        assert res["status"] == "success"
        
        db.refresh(claim)
        assert claim.status == "Sent"

        # Restore original email function
        app.routers.claims.send_html_email = original_send

        # Test Case E: Simulate TPA Response
        simulated = simulate_insurer_response(
            claim_id=claim.id,
            req=ClaimSimulationRequest(status="Approved", insurer_response="Cashless approved for Rs 3,00,000. Pre-auth ID: STAR-CRAN-991"),
            db=db
        )
        assert simulated.status == "Approved"
        assert "STAR-CRAN-991" in simulated.insurer_response

        # Test Case F: Deletion
        del_res = delete_claim(claim_id=claim.id, db=db)
        assert "deleted" in del_res["message"]

    finally:
        # Clean up test patients
        db.query(Claim).filter(Claim.patient_id == patient_id).delete()
        db.query(Record).filter(Record.patient_id == patient_id).delete()
        db.query(InsurancePolicy).filter(InsurancePolicy.patient_id == patient_id).delete()
        db.query(Patient).filter(Patient.id == patient_id).delete()
        db.commit()
        db.close()

def test_supporting_documents():
    print("--- Starting Supporting Documents Checklist Integration Tests ---")
    
    # Setup DB
    Base.metadata.create_all(bind=engine)
    from app.main import check_and_add_columns
    check_and_add_columns()
    db = SessionLocal()
    
    patient_id = "CARE-SUPPORT-TEST"
    
    try:
        # Cleanup
        db.query(Claim).filter(Claim.patient_id == patient_id).delete()
        db.query(InsurancePolicy).filter(InsurancePolicy.patient_id == patient_id).delete()
        db.query(Patient).filter(Patient.id == patient_id).delete()
        db.commit()
        
        # Setup patient & policy
        patient = Patient(id=patient_id, name="Supporting Doc Patient")
        db.add(patient)
        policy = InsurancePolicy(patient_id=patient_id, insurer="Star Health", status="Active")
        db.add(policy)
        db.commit()
        
        # Mock AI
        import app.routers.claims
        import app.services.claims_ai
        def mock_analyze(patient_data, policy_data, records_data, clinical_context):
            return {
                "relevant_records": [],
                "policy_check": {"status": "Appears Eligible"},
                "missing_info": [],
                "cashless_form": {"diagnosis": "Test", "treatment_procedure": "Test", "estimated_cost": 100.0},
                "email_preview": {"recipient": "insurer@star.co.in", "subject": "Test Pre-Auth", "body": "Please approve cashless"}
            }
        app.routers.claims.analyze_cashless_claim_context = mock_analyze
        app.services.claims_ai.analyze_cashless_claim_context = mock_analyze
        
        # 1. Create cashless claim
        claim = initialize_cashless_claim(
            patient_id=patient_id,
            req=CashlessInitRequest(clinical_context="Test Clinical Context"),
            db=db
        )
        assert claim.supporting_documents is None or claim.supporting_documents == []
        
        # 2. Upload supporting document manually
        import io
        
        # Prepare a mock upload file
        class DummyFile:
            def __init__(self, filename, content_bytes):
                self.filename = filename
                self.file = io.BytesIO(content_bytes)
        
        mock_file = DummyFile("estimate_bill.pdf", b"mock estimate bill file content")
        
        from app.routers.claims import upload_supporting_document, delete_supporting_document
        
        res_upload = upload_supporting_document(
            claim_id=claim.id,
            file=mock_file,
            db=db
        )
        assert len(res_upload["supporting_documents"]) == 1
        uploaded_doc = res_upload["supporting_documents"][0]
        assert uploaded_doc["file_name"] == "estimate_bill.pdf"
        assert "uploads/supporting_claims" in uploaded_doc["file_path"]
        
        # 3. Submit/Dispatch email and verify manual attachment details are included
        import app.services.email
        sent_emails = app.services.email.sent_emails
        sent_emails.clear()
        
        app.routers.claims.send_html_email = lambda *args, **kwargs: app.services.email.send_html_email(*args, **kwargs)
        submit_preauth_claim(claim_id=claim.id, db=db)
        
        # Verify mock email dispatch logged the manual attachment path in HTML body
        assert len(sent_emails) == 1
        email_sent = sent_emails[0]
        assert "estimate_bill.pdf" in email_sent["html"]
        assert "Supporting Document - Manually Added" in email_sent["html"]
        
        # Verify actual files are attached
        assert email_sent["attachments"] is not None
        assert len(email_sent["attachments"]) == 1
        att = email_sent["attachments"][0]
        assert att["filename"] == "estimate_bill.pdf"
        assert len(att["content"]) > 0
        
        # 4. Remove supporting document
        res_delete = delete_supporting_document(
            claim_id=claim.id,
            file_path=uploaded_doc["file_path"],
            db=db
        )
        assert len(res_delete["supporting_documents"]) == 0
        
        # Verify file is removed from disk
        import os
        assert not os.path.exists(uploaded_doc["file_path"])
        
    finally:
        db.query(Claim).filter(Claim.patient_id == patient_id).delete()
        db.query(InsurancePolicy).filter(InsurancePolicy.patient_id == patient_id).delete()
        db.query(Patient).filter(Patient.id == patient_id).delete()
        db.commit()
        db.close()
