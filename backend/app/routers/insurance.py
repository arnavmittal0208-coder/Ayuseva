import os
import re
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import Patient, InsurancePolicy, Record, ScheduledCheckup
from app.services.parser import parse_insurance_document
from app.services.notifications import generate_wellness_email
from datetime import datetime, timedelta
from pydantic import BaseModel
import asyncio
from app.services.email import send_html_email

router = APIRouter(prefix="/api/insurance", tags=["insurance"])

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def normalize_date(date_str: str) -> str:
    if not date_str:
        return None
    date_str = date_str.strip()
    # YYYY-MM-DD
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str
    # DD-MM-YYYY or DD/MM/YYYY
    match = re.match(r'^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$', date_str)
    if match:
        day = match.group(1).zfill(2)
        month = match.group(2).zfill(2)
        year = match.group(3)
        return f"{year}-{month}-{day}"
    # YYYY/MM/DD
    match = re.match(r'^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$', date_str)
    if match:
        year = match.group(1)
        month = match.group(2).zfill(2)
        day = match.group(3).zfill(2)
        return f"{year}-{month}-{day}"
    return date_str

@router.get("/patient/{patient_id}")
def get_patient_insurance_policies(patient_id: str, db: Session = Depends(get_db)):
    """Fetches all insurance policies and separates them into active vs previous/expired."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
        
    policies = db.query(InsurancePolicy).filter(
        InsurancePolicy.patient_id == patient_id
    ).order_by(InsurancePolicy.created_at.desc()).all()
    
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    active_policy = None
    previous_policies = []
    
    for p in policies:
        # Check if expired by date
        is_expired = False
        if p.end_date:
            try:
                is_expired = p.end_date < today_str
            except Exception:
                pass
        
        # If it is expired or archived, classify as previous
        if is_expired and p.status == "Active":
            p.status = "Expired"
            db.commit()
            
        if p.status == "Active" and not active_policy:
            active_policy = p
        else:
            previous_policies.append(p)
            
    return {
        "patient_name": patient.name,
        "patient_id": patient_id,
        "active_policy": active_policy,
        "previous_policies": previous_policies
    }

@router.post("/patient/{patient_id}/upload")
async def upload_new_insurance_policy(
    patient_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Uploads, parses, validates, and stores a new insurance policy for a patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
        
    allowed_types = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and Image files (PNG, JPEG, JPG) are allowed.")

    file_bytes = await file.read()
    
    # Save file locally & Supabase
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{patient_id}_ins_{int(datetime.utcnow().timestamp())}{file_ext}"
    file_path = f"uploads/{safe_filename}"
    from app.services.storage import save_uploaded_file, delete_uploaded_file
    save_uploaded_file(safe_filename, file_bytes, file.content_type)

    try:
        parsed_data = parse_insurance_document(file_bytes, file.content_type)
    except Exception as e:
        delete_uploaded_file(file_path)
        raise HTTPException(status_code=500, detail=f"Insurance policy parsing failed: {str(e)}")

    start_date = normalize_date(parsed_data.get("start_date"))
    end_date = normalize_date(parsed_data.get("end_date"))
    
    if start_date and end_date and start_date > end_date:
        delete_uploaded_file(file_path)
        raise HTTPException(
            status_code=400, 
            detail=f"Validation Error: Policy start date ({start_date}) cannot be after expiry date ({end_date})."
        )
        
    existing_active = db.query(InsurancePolicy).filter(
        InsurancePolicy.patient_id == patient_id,
        InsurancePolicy.status == "Active"
    ).all()
    for p in existing_active:
        p.status = "Expired"
    
    new_policy = InsurancePolicy(
        patient_id=patient_id,
        insurer=parsed_data.get("insurer"),
        policy_number=parsed_data.get("policy_number"),
        policyholder_name=parsed_data.get("policyholder_name"),
        patient_name=parsed_data.get("patient_name"),
        member_id=parsed_data.get("member_id"),
        policy_type=parsed_data.get("policy_type"),
        start_date=start_date,
        end_date=end_date,
        sum_insured=parsed_data.get("sum_insured"),
        premium=parsed_data.get("premium"),
        preventive_eligible=parsed_data.get("preventive_eligible"),
        checkups_per_year=parsed_data.get("checkups_per_year"),
        benefits_coverage=parsed_data.get("benefits_coverage"),
        conditions_limitations=parsed_data.get("conditions_limitations"),
        file_path=f"uploads/{safe_filename}",
        insurer_email=parsed_data.get("insurer_email"),
        status="Active"
    )
    db.add(new_policy)
    
    new_record = Record(
        patient_id=patient_id,
        record_type="INSURANCE_POLICY",
        date=start_date or datetime.utcnow().strftime("%Y-%m-%d"),
        file_path=f"uploads/{safe_filename}",
        parsed_json=parsed_data
    )
    db.add(new_record)
    
    patient.policy_details = {
        "insurer": new_policy.insurer,
        "policy_number": new_policy.policy_number,
        "coverage_limit": new_policy.sum_insured,
        "free_checkups_left": new_policy.checkups_per_year or 0,
        "policyholder_name": new_policy.policyholder_name,
        "member_id": new_policy.member_id,
        "policy_type": new_policy.policy_type,
        "start_date": new_policy.start_date,
        "end_date": new_policy.end_date,
        "insurer_email": new_policy.insurer_email
    }
    
    db.commit()
    db.refresh(new_policy)
    
    return new_policy

@router.post("/policy/{policy_id}/archive")
def archive_insurance_policy(policy_id: int, db: Session = Depends(get_db)):
    """Safely archives an insurance policy, changing status to Archived."""
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Insurance policy not found.")
        
    policy.status = "Archived"
    
    patient = db.query(Patient).filter(Patient.id == policy.patient_id).first()
    if patient and patient.policy_details and patient.policy_details.get("policy_number") == policy.policy_number:
        next_active = db.query(InsurancePolicy).filter(
            InsurancePolicy.patient_id == policy.patient_id,
            InsurancePolicy.status == "Active",
            InsurancePolicy.id != policy.id
        ).order_by(InsurancePolicy.created_at.desc()).first()
        
        if next_active:
            patient.policy_details = {
                "insurer": next_active.insurer,
                "policy_number": next_active.policy_number,
                "coverage_limit": next_active.sum_insured,
                "free_checkups_left": next_active.checkups_per_year or 0,
                "policyholder_name": next_active.policyholder_name,
                "member_id": next_active.member_id,
                "policy_type": next_active.policy_type,
                "start_date": next_active.start_date,
                "end_date": next_active.end_date,
                "insurer_email": next_active.insurer_email
            }
        else:
            patient.policy_details = None
            
    db.commit()
    return {"message": "Policy archived successfully."}

@router.delete("/policy/{policy_id}")
def delete_insurance_policy(policy_id: int, db: Session = Depends(get_db)):
    """Permanently deletes a historical (expired/archived) policy record from SQLite."""
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Insurance policy not found.")
        
    if policy.status == "Active":
        raise HTTPException(status_code=400, detail="Cannot delete an active insurance policy. Please archive it first.")
        
    # Also delete any scheduled checkups associated with this policy
    db.query(ScheduledCheckup).filter(ScheduledCheckup.policy_id == policy.id).delete()
    
    db.delete(policy)
    db.commit()
    return {"message": "Historical policy record permanently deleted."}

# Preventive Care checkups Endpoints

# Preventive Care checkups Endpoints

class CheckupScheduleRequest(BaseModel):
    scheduled_date: str

def send_checkup_notification_email_sync(checkup_id: int, db: Session) -> bool:
    s = db.query(ScheduledCheckup).filter(ScheduledCheckup.id == checkup_id).first()
    if not s or s.is_locked:
        return False
        
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == s.policy_id).first()
    patient = db.query(Patient).filter(Patient.id == s.patient_id).first()
    if not policy or not patient:
        return False
        
    recipient_email = policy.insurer_email
    if not recipient_email:
        if patient.policy_details:
            recipient_email = patient.policy_details.get("insurer_email")
            
    if not recipient_email:
        record = db.query(Record).filter(
            Record.patient_id == s.patient_id,
            Record.record_type == "INSURANCE_POLICY",
            Record.file_path == policy.file_path
        ).first()
        if record and record.parsed_json:
            recipient_email = record.parsed_json.get("insurer_email")

    if not recipient_email:
        s.notification_status = "Failed"
        db.commit()
        return False
        
    subject = f"Preventive Health Checkup Notification — {patient.name or 'Patient'}"
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333;">
        <h2>Preventive Health Checkup Coordination Request</h2>
        <p>Dear {policy.insurer or 'Insurance Provider'} Wellness Team,</p>
        <p>This is a formal request to coordinate a covered preventive health checkup under the patient's active policy benefits.</p>
        
        <table style="border-collapse: collapse; width: 100%; max-width: 600px; margin: 20px 0;">
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #dddddd; text-align: left; padding: 8px; width: 40%;">Field</th>
            <th style="border: 1px solid #dddddd; text-align: left; padding: 8px;">Details</th>
          </tr>
          <tr>
            <td style="border: 1px solid #dddddd; padding: 8px; font-weight: bold;">Patient Name</td>
            <td style="border: 1px solid #dddddd; padding: 8px;">{patient.name or 'N/A'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #dddddd; padding: 8px; font-weight: bold;">Patient Member ID</td>
            <td style="border: 1px solid #dddddd; padding: 8px;">{policy.member_id or patient.id}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #dddddd; padding: 8px; font-weight: bold;">Insurance Provider</td>
            <td style="border: 1px solid #dddddd; padding: 8px;">{policy.insurer or 'N/A'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #dddddd; padding: 8px; font-weight: bold;">Policy Number</td>
            <td style="border: 1px solid #dddddd; padding: 8px;">{policy.policy_number or 'N/A'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #dddddd; padding: 8px; font-weight: bold;">Scheduled Checkup Date</td>
            <td style="border: 1px solid #dddddd; padding: 8px;">{s.scheduled_date}</td>
          </tr>
        </table>
        
        <p>Please contact the patient to coordinate the scheduling at an approved checkup facility.</p>
        <br/>
        <p>Sincerely,</p>
        <p><strong>AyuSeva Care Orchestration Portal</strong></p>
      </body>
    </html>
    """
    
    success = send_html_email(
        to_email=recipient_email,
        subject=subject,
        html_content=html_content
    )
    
    if success:
        s.notification_status = "Sent"
        s.notification_sent_at = datetime.utcnow()
        s.is_locked = True
        db.commit()
        return True
    else:
        s.notification_status = "Failed"
        db.commit()
        return False

async def periodic_checkup_notification_worker():
    """
    Background worker loop that automatically queries unsent scheduled checkups
    where the notification date has arrived/passed, and dispatches them via Resend.
    """
    while True:
        try:
            db = SessionLocal()
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            
            pending = db.query(ScheduledCheckup).filter(
                ScheduledCheckup.notification_date <= today_str,
                ScheduledCheckup.is_locked == False
            ).all()
            
            for s in pending:
                print(f"[BACKGROUND WORKER] Triggering checkup #{s.checkup_number} notification for patient {s.patient_id} (Date: {s.scheduled_date}, Notif Date: {s.notification_date})")
                send_checkup_notification_email_sync(s.id, db)
                
            db.close()
        except Exception as e:
            print(f"[BACKGROUND WORKER ERROR] Error checking checkup notifications: {str(e)}")
            
        await asyncio.sleep(60)

@router.get("/patient/{patient_id}/checkups")
def get_preventive_checkups(patient_id: str, db: Session = Depends(get_db)):
    active_policy = db.query(InsurancePolicy).filter(
        InsurancePolicy.patient_id == patient_id,
        InsurancePolicy.status == "Active"
    ).order_by(InsurancePolicy.created_at.desc()).first()
    
    if not active_policy:
        return {"checkups": []}
        
    checkups_per_year = active_policy.checkups_per_year or 0
    scheduled = db.query(ScheduledCheckup).filter(
        ScheduledCheckup.policy_id == active_policy.id
    ).all()
    
    scheduled_map = {s.checkup_number: s for s in scheduled}
    
    slots = []
    for i in range(1, checkups_per_year + 1):
        if i in scheduled_map:
            s = scheduled_map[i]
            ui_status = s.notification_status.upper()
            if s.is_locked:
                ui_status = "SENT"
            elif s.notification_status == "Failed":
                ui_status = "FAILED"
            else:
                ui_status = "SCHEDULED"

            slots.append({
                "id": s.id,
                "policy_id": s.policy_id,
                "checkup_number": s.checkup_number,
                "scheduled_date": s.scheduled_date,
                "notification_date": s.notification_date,
                "status": ui_status,
                "is_locked": s.is_locked,
                "notification_sent_at": s.notification_sent_at.isoformat() if s.notification_sent_at else None
            })
        else:
            slots.append({
                "id": None,
                "policy_id": active_policy.id,
                "checkup_number": i,
                "scheduled_date": None,
                "notification_date": None,
                "status": "AVAILABLE",
                "is_locked": False,
                "notification_sent_at": None
            })
            
    return {"checkups": slots}

@router.post("/policy/{policy_id}/checkup/{checkup_number}/schedule")
def schedule_checkup(
    policy_id: int,
    checkup_number: int,
    req: CheckupScheduleRequest,
    db: Session = Depends(get_db)
):
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Insurance policy not found.")
        
    s = db.query(ScheduledCheckup).filter(
        ScheduledCheckup.policy_id == policy_id,
        ScheduledCheckup.checkup_number == checkup_number
    ).first()
    
    if s and s.is_locked:
        raise HTTPException(status_code=400, detail="Rescheduling is locked because notification has been sent.")
        
    try:
        dt = datetime.strptime(req.scheduled_date, "%Y-%m-%d")
        notif_dt = dt - timedelta(days=2)
        notification_date_str = notif_dt.strftime("%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
        
    if s:
        s.scheduled_date = req.scheduled_date
        s.notification_date = notification_date_str
        if s.notification_status == "Failed":
            s.notification_status = "Scheduled"
    else:
        s = ScheduledCheckup(
            patient_id=policy.patient_id,
            policy_id=policy_id,
            checkup_number=checkup_number,
            scheduled_date=req.scheduled_date,
            notification_date=notification_date_str,
            notification_status="Scheduled",
            is_locked=False
        )
        db.add(s)
        
    db.commit()
    db.refresh(s)
    
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    if s.notification_date <= today_str:
        print(f"[IMMEDIATE DISPATCH] Calculated notification date {s.notification_date} has arrived or passed. Sending immediately...")
        send_checkup_notification_email_sync(s.id, db)
        db.refresh(s)

    return {
        "id": s.id,
        "policy_id": s.policy_id,
        "checkup_number": s.checkup_number,
        "scheduled_date": s.scheduled_date,
        "notification_date": s.notification_date,
        "status": s.notification_status.upper() if s.is_locked else ("FAILED" if s.notification_status == "Failed" else "SCHEDULED"),
        "is_locked": s.is_locked
    }

@router.post("/checkup/{checkup_id}/simulate-notification")
def simulate_notification_send(checkup_id: int, db: Session = Depends(get_db)):
    s = db.query(ScheduledCheckup).filter(ScheduledCheckup.id == checkup_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scheduled checkup not found.")
        
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == s.policy_id).first()
    patient = db.query(Patient).filter(Patient.id == s.patient_id).first()
    
    if not policy or not patient:
        raise HTTPException(status_code=404, detail="Related patient or policy not found.")
        
    recipient_email = policy.insurer_email or (patient.policy_details.get("insurer_email") if patient.policy_details else None) or "wellness-provider@ayuseva-prototype.com"
        
    subject, recipient, body = generate_wellness_email(
        patient_name=patient.name or "Unknown Patient",
        patient_id=patient.id,
        insurer_name=policy.insurer or "Unknown Insurer",
        policy_number=policy.policy_number or "N/A",
        checkup_date=s.scheduled_date,
        recipient_email=recipient_email
    )
    
    return {
        "message": "Simulation preview generated",
        "email": {
            "recipient": recipient,
            "subject": subject,
            "body": body
        }
    }

@router.post("/checkup/{checkup_id}/cancel")
def cancel_checkup(checkup_id: int, db: Session = Depends(get_db)):
    s = db.query(ScheduledCheckup).filter(ScheduledCheckup.id == checkup_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scheduled checkup not found.")
        
    if s.is_locked:
        raise HTTPException(status_code=400, detail="Cannot cancel checkup slot. Notification has already been sent and date is locked.")
        
    db.delete(s)
    db.commit()
    
    return {"message": "Checkup slot successfully cancelled and returned to AVAILABLE status."}

