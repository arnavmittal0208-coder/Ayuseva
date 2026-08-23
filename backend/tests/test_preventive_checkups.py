import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import Patient, InsurancePolicy, ScheduledCheckup
from app.routers.insurance import get_preventive_checkups, schedule_checkup, simulate_notification_send, cancel_checkup, CheckupScheduleRequest
from fastapi import HTTPException

async def run_preventive_checkups_flow():
    # Setup test database tables
    Base.metadata.create_all(bind=engine)
    from app.main import check_and_add_columns
    check_and_add_columns()
    db = SessionLocal()

    patient_id = "CARE-TEST77"
    
    # 1. Clean existing records for test run isolation
    db.query(ScheduledCheckup).filter(ScheduledCheckup.patient_id == patient_id).delete()
    db.query(InsurancePolicy).filter(InsurancePolicy.patient_id == patient_id).delete()
    db.query(Patient).filter(Patient.id == patient_id).delete()
    db.commit()

    # 2. Create patient and active insurance policy with 3 checkups/year and insurer_email
    patient = Patient(id=patient_id, name="Preventive Test Patient")
    db.add(patient)
    db.commit()

    policy = InsurancePolicy(
        patient_id=patient_id,
        insurer="Star Health",
        insurer_email="arnavmittal1510@gmail.com",
        policy_number="POL-991122",
        checkups_per_year=3,
        status="Active"
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    # 3. Retrieve checkup slots (should show 3 AVAILABLE slots)
    res = get_preventive_checkups(patient_id=patient_id, db=db)
    assert len(res["checkups"]) == 3
    assert res["checkups"][0]["status"] == "AVAILABLE"
    assert res["checkups"][1]["status"] == "AVAILABLE"
    assert res["checkups"][2]["status"] == "AVAILABLE"

    # 4. Case 1: Schedule Checkup #1 in the future (e.g. 5 days from now)
    future_date = (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%d")
    req = CheckupScheduleRequest(scheduled_date=future_date)
    s1 = schedule_checkup(policy_id=policy.id, checkup_number=1, req=req, db=db)
    assert s1["scheduled_date"] == future_date
    assert s1["is_locked"] is False
    assert s1["status"] == "SCHEDULED"

    # 5. Case 3: Schedule Checkup #2 with a notification date in the past (e.g. checkup date is tomorrow, notification date is yesterday)
    tomorrow_date = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
    req2 = CheckupScheduleRequest(scheduled_date=tomorrow_date)
    s2 = schedule_checkup(policy_id=policy.id, checkup_number=2, req=req2, db=db)
    
    # Check that it dispatched immediately and locked
    assert s2["is_locked"] is True
    assert s2["status"] == "SENT"

    # 6. Simulate preview notification for Checkup #1 (should return preview info and remain unlocked)
    preview_res = simulate_notification_send(checkup_id=s1["id"], db=db)
    assert preview_res["message"] == "Simulation preview generated"
    assert "AyuSeva Wellness Checkup" in preview_res["email"]["subject"]
    
    # Check that checkup #1 is still unlocked and scheduled
    res2 = get_preventive_checkups(patient_id=patient_id, db=db)
    assert res2["checkups"][0]["status"] == "SCHEDULED"
    assert res2["checkups"][0]["is_locked"] is False

    # 7. Reschedule Checkup #1 to another future date (e.g. 10 days from now)
    future_date_new = (datetime.utcnow() + timedelta(days=10)).strftime("%Y-%m-%d")
    req_new = CheckupScheduleRequest(scheduled_date=future_date_new)
    s1_updated = schedule_checkup(policy_id=policy.id, checkup_number=1, req=req_new, db=db)
    assert s1_updated["scheduled_date"] == future_date_new
    assert s1_updated["is_locked"] is False

    # 8. Attempting to reschedule locked Checkup #2 must fail
    try:
        schedule_checkup(policy_id=policy.id, checkup_number=2, req=req, db=db)
        assert False, "Should have raised HTTPException due to lock"
    except HTTPException as e:
        assert e.status_code == 400
        assert "locked" in e.detail

    # 9. Attempting to cancel locked Checkup #2 must fail
    try:
        cancel_checkup(checkup_id=s2["id"], db=db)
        assert False, "Should have raised HTTPException due to lock"
    except HTTPException as e:
        assert e.status_code == 400
        assert "Cannot cancel checkup slot" in e.detail

    # 10. Cancel Checkup #1 (unlocked future slot)
    cancel_res = cancel_checkup(checkup_id=s1["id"], db=db)
    assert cancel_res["message"] == "Checkup slot successfully cancelled and returned to AVAILABLE status."

    # 11. Retrieve slots to verify slot #1 is back to AVAILABLE
    res3 = get_preventive_checkups(patient_id=patient_id, db=db)
    assert res3["checkups"][0]["status"] == "AVAILABLE"
    assert res3["checkups"][0]["scheduled_date"] is None

    # Clean up test records
    db.query(ScheduledCheckup).filter(ScheduledCheckup.patient_id == patient_id).delete()
    db.query(InsurancePolicy).filter(InsurancePolicy.patient_id == patient_id).delete()
    db.query(Patient).filter(Patient.id == patient_id).delete()
    db.commit()
    db.close()

def test_preventive_checkups_flow():
    asyncio.run(run_preventive_checkups_flow())

def test_policy_deletion_and_safety_rules():
    db = SessionLocal()
    patient_id = "CARE-TEST88"
    
    # Clean existing records
    db.query(ScheduledCheckup).filter(ScheduledCheckup.patient_id == patient_id).delete()
    db.query(InsurancePolicy).filter(InsurancePolicy.patient_id == patient_id).delete()
    db.query(Patient).filter(Patient.id == patient_id).delete()
    db.commit()

    patient = Patient(id=patient_id, name="Deletion Test Patient")
    db.add(patient)
    db.commit()

    # Create active policy
    active_policy = InsurancePolicy(
        patient_id=patient_id,
        insurer="Active Health",
        policy_number="POL-ACTIVE",
        status="Active"
    )
    db.add(active_policy)
    
    # Create archived policy
    archived_policy = InsurancePolicy(
        patient_id=patient_id,
        insurer="Archived Health",
        policy_number="POL-ARCHIVED",
        status="Archived"
    )
    db.add(archived_policy)
    db.commit()
    db.refresh(active_policy)
    db.refresh(archived_policy)

    from app.routers.insurance import delete_insurance_policy

    # 1. Attempting to delete active policy must fail (safety check)
    try:
        delete_insurance_policy(policy_id=active_policy.id, db=db)
        assert False, "Should have raised HTTPException when deleting active policy"
    except HTTPException as e:
        assert e.status_code == 400
        assert "Cannot delete an active insurance policy" in e.detail

    # 2. Deleting historical/archived policy must succeed
    del_res = delete_insurance_policy(policy_id=archived_policy.id, db=db)
    assert del_res["message"] == "Historical policy record permanently deleted."

    # Verify active policy still exists, archived is gone
    p_active = db.query(InsurancePolicy).filter(InsurancePolicy.id == active_policy.id).first()
    assert p_active is not None
    
    p_archived = db.query(InsurancePolicy).filter(InsurancePolicy.id == archived_policy.id).first()
    assert p_archived is None

    # 3. Test send_html_email mock safety registry
    from app.services.email import send_html_email, sent_emails
    sent_count_before = len(sent_emails)
    res_mail = send_html_email(to_email="test@example.com", subject="Safety Mock Check", html_content="<p>Test</p>")
    assert res_mail is True
    assert len(sent_emails) == sent_count_before + 1
    assert sent_emails[-1]["to"] == "test@example.com"

    # Clean up
    db.query(InsurancePolicy).filter(InsurancePolicy.patient_id == patient_id).delete()
    db.query(Patient).filter(Patient.id == patient_id).delete()
    db.commit()
    db.close()
