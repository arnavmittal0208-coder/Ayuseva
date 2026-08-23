import os
import random
import string
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Patient, Record, Claim, ClinicalBrief, InsurancePolicy
from app.services.parser import parse_medical_document, parse_insurance_document
from app.routers.insurance import normalize_date

router = APIRouter(prefix="/api/records", tags=["records"])

# Configure local uploads directory
UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def generate_unique_patient_id(db: Session) -> str:
    """Generates a unique patient ID in the format CARE-XXXXXX"""
    while True:
        num = "".join(random.choices(string.digits, k=6))
        uid = f"CARE-{num}"
        # Check if exists
        exists = db.query(Patient).filter(Patient.id == uid).first()
        if not exists:
            return uid

@router.post("/upload")
async def upload_medical_record(
    file: UploadFile = File(...),
    patient_id: str = Form(None), # Optional patient ID. If None, we register a new patient.
    db: Session = Depends(get_db)
):
    # Validate MIME type
    allowed_types = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and Image files (PNG, JPEG, JPG) are allowed.")

    # Read file content
    file_bytes = await file.read()
    
    # Check/Create Patient
    if not patient_id:
        patient_id = generate_unique_patient_id(db)
        new_patient = Patient(id=patient_id)
        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)
    else:
        # Check if patient exists
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            # Create it if it doesn't exist
            patient = Patient(id=patient_id)
            db.add(patient)
            db.commit()
            db.refresh(patient)

    # Save file locally
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{patient_id}_{int(datetime.utcnow().timestamp())}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Call AI Parser Agent
    try:
        parsed_data = parse_medical_document(file_bytes, file.content_type)
    except Exception as e:
        # Clean up saved file on parsing error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"AI Ingestion failed: {str(e)}")

    # Save Record entry
    new_record = Record(
        patient_id=patient_id,
        record_type=parsed_data.get("record_type", "Other"),
        date=parsed_data.get("date"),
        file_path=f"uploads/{safe_filename}",
        parsed_json=parsed_data
    )
    db.add(new_record)

    # Check for surgery advice to scaffold a Claim
    if parsed_data.get("surgery_advised"):
        details = parsed_data.get("procedure_details", {}) or {}
        procedure_name = details.get("name") or "Advised Surgical Procedure"
        estimated_cost = details.get("estimated_cost")
        
        # Scaffold a new Claim under draft status
        new_claim = Claim(
            patient_id=patient_id,
            procedure_name=procedure_name,
            estimated_cost=estimated_cost,
            status="Draft",
            missing_documents=["Identity Proof", "Doctor Prescription Note", "Surgery Estimate Sheet"]
        )
        db.add(new_claim)

    db.commit()
    db.refresh(new_record)

    return {
        "message": "File processed successfully.",
        "patient_id": patient_id,
        "record_id": new_record.id,
        "parsed_data": parsed_data
    }

@router.post("/upload-insurance")
async def upload_insurance_policy(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    db: Session = Depends(get_db)
):
    # Validate MIME type
    allowed_types = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and Image files (PNG, JPEG, JPG) are allowed.")

    # Read file content
    file_bytes = await file.read()
    
    # Check if patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    # Save file locally
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{patient_id}_ins_{int(datetime.utcnow().timestamp())}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Call AI Parser Agent for Insurance Policy
    try:
        parsed_data = parse_insurance_document(file_bytes, file.content_type)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Insurance policy parsing failed: {str(e)}")

    start_date = normalize_date(parsed_data.get("start_date"))
    end_date = normalize_date(parsed_data.get("end_date"))

    if start_date and end_date and start_date > end_date:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=400, 
            detail=f"Validation Error: Policy start date ({start_date}) cannot be after expiry date ({end_date})."
        )

    # Deactivate existing active policies
    existing_active = db.query(InsurancePolicy).filter(
        InsurancePolicy.patient_id == patient_id,
        InsurancePolicy.status == "Active"
    ).all()
    for p in existing_active:
        p.status = "Expired"

    # Create the InsurancePolicy record
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
        status="Active"
    )
    db.add(new_policy)

    # Save Record entry of type INSURANCE_POLICY
    new_record = Record(
        patient_id=patient_id,
        record_type="INSURANCE_POLICY",
        date=start_date or datetime.utcnow().strftime("%Y-%m-%d"),
        file_path=f"uploads/{safe_filename}",
        parsed_json=parsed_data
    )
    db.add(new_record)

    # Update patient's policy_details
    patient.policy_details = {
        "insurer": new_policy.insurer,
        "policy_number": new_policy.policy_number,
        "coverage_limit": new_policy.sum_insured,
        "free_checkups_left": new_policy.checkups_per_year or 0,
        "policyholder_name": new_policy.policyholder_name,
        "member_id": new_policy.member_id,
        "policy_type": new_policy.policy_type,
        "start_date": new_policy.start_date,
        "end_date": new_policy.end_date
    }
    db.commit()
    db.refresh(patient)
    db.refresh(new_record)
    db.refresh(new_policy)

    return {
        "status": "success",
        "record_id": new_record.id,
        "policy_details": patient.policy_details
    }

@router.get("/")
def list_all_records(db: Session = Depends(get_db)):
    """List all parsed medical records, sorted by date/created_at descending. (Admin only)"""
    records = db.query(Record).filter(Record.record_type != "INSURANCE_POLICY").order_by(Record.date.desc(), Record.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "patient_id": r.patient_id,
            "patient_name": r.patient.name if r.patient else "Unknown",
            "record_type": r.record_type,
            "date": r.date,
            "file_path": r.file_path,
            "created_at": r.created_at
        } for r in records
    ]

@router.delete("/{id}")
def delete_record(id: int, db: Session = Depends(get_db)):
    """Deletes a single EMR record entry and deletes its local file if it exists."""
    record = db.query(Record).filter(Record.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record with ID {id} not found.")
    
    patient_id = record.patient_id
    
    try:
        # Delete local file if exists
        if record.file_path:
            full_path = os.path.join(".", record.file_path)
            if os.path.exists(full_path):
                os.remove(full_path)
        
        # Invalidate clinical briefs by deleting cached entries for this patient
        db.query(ClinicalBrief).filter(ClinicalBrief.patient_id == patient_id).delete()
        
        db.delete(record)
        db.commit()
        return {"message": f"Record {id} deleted successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete record: {str(e)}")
