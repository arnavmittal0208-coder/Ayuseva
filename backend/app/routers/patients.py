import random
import string
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Patient, Record, Claim
from app.services.clinical_brief import generate_clinical_brief

router = APIRouter(prefix="/api/patients", tags=["patients"])

class PatientCreate(BaseModel):
    name: str
    phone: str
    dob: str
    insurer: str

def generate_unique_patient_id(db: Session) -> str:
    """Generates a unique patient ID in the format CARE-XXXXXX"""
    while True:
        num = "".join(random.choices(string.digits, k=6))
        uid = f"CARE-{num}"
        exists = db.query(Patient).filter(Patient.id == uid).first()
        if not exists:
            return uid

@router.post("/")
def register_patient(patient_in: PatientCreate, db: Session = Depends(get_db)):
    """Registers a new patient and generates a unique local UID"""
    uid = generate_unique_patient_id(db)
    
    policy_details = {
        "insurer": patient_in.insurer,
        "policy_number": f"POL-{random.randint(10000000, 99999999)}",
        "coverage_limit": 500000.0,
        "free_checkups_left": 2
    }
    
    new_patient = Patient(
        id=uid,
        name=patient_in.name,
        phone=patient_in.phone,
        dob=patient_in.dob,
        policy_details=policy_details
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    return new_patient

@router.get("/")
def list_patients(db: Session = Depends(get_db)):
    """Lists all registered patients in the system (useful for dashboard lookups)"""
    patients = db.query(Patient).all()
    return patients

@router.get("/{uid}")
def get_patient_details(uid: str, db: Session = Depends(get_db)):
    """Fetches details of a specific patient by their local UID"""
    patient = db.query(Patient).filter(Patient.id == uid).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID {uid} not found.")
    return patient

@router.get("/{uid}/timeline")
def get_patient_timeline(uid: str, db: Session = Depends(get_db)):
    """
    Fetches the chronological medical history timeline for a patient, 
    sorted by record date (newest first).
    """
    patient = db.query(Patient).filter(Patient.id == uid).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID {uid} not found.")
    
    # Query records for the patient, sorting by date descending
    # (Since date is stored as a string "YYYY-MM-DD", string sorting works perfectly)
    records = db.query(Record).filter(Record.patient_id == uid).order_by(Record.date.desc()).all()
    
    return {
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "phone": patient.phone,
            "dob": patient.dob,
            "policy_details": patient.policy_details
        },
        "timeline": [
            {
                "id": r.id,
                "record_type": r.record_type,
                "date": r.date,
                "file_path": r.file_path,
                "parsed_json": r.parsed_json,
                "created_at": r.created_at
            } for r in records
        ]
    }

@router.get("/{uid}/brief")
def get_clinical_brief(
    uid: str,
    summary_type: str = Query("complete", description="Summary mode: complete, current_visit, disease, specialty, longitudinal, recent, emergency"),
    specialty: str = Query("General", description="Filter details relevant to this medical specialty"),
    disease_focus: str = Query(None, description="Focus on this disease for disease-specific summaries"),
    current_visit_reason: str = Query(None, description="Reason for current visit"),
    db: Session = Depends(get_db)
):
    """
    Generates an AI clinical brief for a patient based on their complete EMR history,
    filtered dynamically according to relevance rules, summary modes, warnings, and citations.
    """
    patient = db.query(Patient).filter(Patient.id == uid).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID {uid} not found.")
        
    records = db.query(Record).filter(Record.patient_id == uid).all()
    if not records:
        return {
            "specialty": specialty,
            "summary_type": summary_type,
            "clinical_summary": "No historical medical records found for this patient.",
            "active_problems": [],
            "current_medications": [],
            "warnings": [],
            "treatment_gaps": [],
            "relevance_metrics": []
        }

    # Serialize records for AI context
    records_list = [
        {
            "id": r.id,
            "record_type": r.record_type,
            "date": r.date,
            "parsed_json": r.parsed_json
        } for r in records
    ]

    try:
        brief_data = generate_clinical_brief(
            records_list, 
            specialty=specialty,
            summary_type=summary_type,
            disease_focus=disease_focus,
            current_visit_reason=current_visit_reason
        )
        return brief_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate clinical brief: {str(e)}")
