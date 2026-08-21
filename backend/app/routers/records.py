import os
import random
import string
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Patient, Record, Claim
from app.services.parser import parse_medical_document

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
