import random
import string
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Patient, Record, Claim, ClinicalBrief
from app.services.clinical_brief import generate_clinical_brief
from app.services.clinical_context import detect_clinical_contexts, records_for_context

router = APIRouter(prefix="/api/patients", tags=["patients"])

class PatientCreate(BaseModel):
    name: str
    phone: str
    dob: str
    insurer: str = ""

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
    
    new_patient = Patient(
        id=uid,
        name=patient_in.name,
        phone=patient_in.phone,
        dob=patient_in.dob,
        policy_details=None
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
    records = db.query(Record).filter(Record.patient_id == uid, Record.record_type != "INSURANCE_POLICY").order_by(Record.date.desc()).all()
    
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

def _serialize_records(records) -> list:
    return [
        {
            "id": r.id,
            "record_type": r.record_type,
            "date": r.date,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "file_path": r.file_path,
            "parsed_json": r.parsed_json
        } for r in records
    ]


def _calculate_records_hash(records_list: list) -> str:
    import hashlib
    import json
    parts = []
    for r in sorted(records_list, key=lambda x: x["id"]):
        parsed_str = json.dumps(r["parsed_json"], sort_keys=True) if r.get("parsed_json") else ""
        parts.append(f"{r['id']}:{r['record_type']}:{r['date'] or ''}:{parsed_str}")
    hash_input = "|".join(parts)
    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()


@router.get("/{uid}/clinical-contexts")
def get_clinical_contexts(
    uid: str,
    current_visit_reason: str = Query(None, description="Optional current visit reason used to pick the default context"),
    db: Session = Depends(get_db)
):
    """
    Automatically detect clinically relevant contexts for THIS patient only.
    Does not hard-code diseases and never reads another patient's records.
    """
    patient = db.query(Patient).filter(Patient.id == uid).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID {uid} not found.")

    records = db.query(Record).filter(Record.patient_id == uid, Record.record_type != "INSURANCE_POLICY").order_by(Record.date.asc()).all()
    detection = detect_clinical_contexts(
        _serialize_records(records),
        current_visit_reason=current_visit_reason,
    )
    return {
        "patient_id": uid,
        "contexts": detection["contexts"],
        "default_context_id": detection["default_context_id"],
    }


@router.get("/{uid}/brief")
def get_clinical_brief(
    uid: str,
    summary_type: str = Query("complete", description="Summary mode: complete, current_visit, disease, specialty, longitudinal, recent, emergency"),
    specialty: str = Query("General", description="Filter details relevant to this medical specialty"),
    disease_focus: str = Query(None, description="Automatically selected clinical context label"),
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
        
    records = db.query(Record).filter(Record.patient_id == uid, Record.record_type != "INSURANCE_POLICY").all()
    if not records:
        return {
            "specialty": specialty,
            "summary_type": summary_type,
            "clinical_summary": "No historical medical records found for this patient.",
            "active_problems": [],
            "current_medications": [],
            "warnings": [],
            "treatment_gaps": [],
            "relevance_metrics": [],
            "clinical_contexts": [],
            "selected_context": None,
        }

    records_list = _serialize_records(records)
    detection = detect_clinical_contexts(records_list, current_visit_reason=current_visit_reason)
    selected_context = None
    if disease_focus:
        focus_norm = disease_focus.strip().lower()
        for ctx in detection["contexts"]:
            if ctx["id"] == focus_norm.replace(" ", "-") or ctx["label"].strip().lower() == focus_norm:
                selected_context = ctx
                break
        if selected_context is None:
            selected_context = {
                "id": focus_norm.replace(" ", "-"),
                "label": disease_focus.strip(),
                "kind": "requested",
                "record_ids": [],
                "related_record_ids": [],
            }

    ai_records = records_list
    if summary_type == "disease" and selected_context:
        ai_records = records_for_context(records_list, selected_context)

    # Cache key setup
    records_hash = _calculate_records_hash(records_list)
    resolved_disease_focus = selected_context["label"] if selected_context else disease_focus

    cached = db.query(ClinicalBrief).filter(
        ClinicalBrief.patient_id == uid,
        ClinicalBrief.summary_type == summary_type,
        ClinicalBrief.specialty == specialty,
        ClinicalBrief.disease_focus == resolved_disease_focus,
        ClinicalBrief.current_visit_reason == current_visit_reason
    ).first()

    if cached and cached.records_hash == records_hash:
        print("CLINICAL BRIEF CACHE HIT: Returning cached summary.", flush=True)
        return cached.brief_json
    else:
        print(f"CLINICAL BRIEF CACHE MISS. Current hash: {records_hash}, Cached hash: {cached.records_hash if cached else 'None'}", flush=True)

    try:
        brief_data = generate_clinical_brief(
            ai_records,
            specialty=specialty,
            summary_type=summary_type,
            disease_focus=resolved_disease_focus,
            current_visit_reason=current_visit_reason
        )
        # Normalize clinical_summary to be a string
        if not isinstance(brief_data.get("clinical_summary"), str):
            summary_obj = brief_data.get("clinical_summary")
            if isinstance(summary_obj, dict):
                lines = []
                for k, v in summary_obj.items():
                    if isinstance(v, list):
                        v_str = "\n".join(f"- {item}" for item in v)
                    elif isinstance(v, dict):
                        v_str = "\n".join(f"  * {sk}: {sv}" for sk, sv in v.items())
                    else:
                        v_str = str(v)
                    lines.append(f"{k}:\n{v_str}")
                brief_data["clinical_summary"] = "\n\n".join(lines)
            else:
                brief_data["clinical_summary"] = str(summary_obj) if summary_obj is not None else ""

        brief_data["clinical_contexts"] = detection["contexts"]
        brief_data["selected_context"] = selected_context["label"] if selected_context else None
        
        # Reconcile excluded records in relevance_metrics
        patient_record_ids = {r["id"] for r in records_list}
        existing_metrics = [m for m in brief_data.get("relevance_metrics", []) if m.get("record_id") in patient_record_ids]
        brief_data["relevance_metrics"] = existing_metrics
        
        ai_record_ids = {r["id"] for r in ai_records}
        existing_ids = {m["record_id"] for m in existing_metrics if "record_id" in m}
        
        for r in records_list:
            if r["id"] not in existing_ids:
                if r["id"] not in ai_record_ids:
                    explanation = f"Excluded automatically by Clinical Context '{selected_context['label']}' rules." if selected_context else "Excluded from active summary focus."
                else:
                    explanation = "Excluded from active summary focus."
                existing_metrics.append({
                    "record_id": r["id"],
                    "record_title": f"{r['record_type']} ({r['date'] or 'N/A'})",
                    "relevance": "Low",
                    "explanation": explanation
                })

        # Save or update cached brief
        from datetime import datetime
        if cached:
            cached.records_hash = records_hash
            cached.brief_json = brief_data
            cached.updated_at = datetime.utcnow()
        else:
            cached = ClinicalBrief(
                patient_id=uid,
                summary_type=summary_type,
                specialty=specialty,
                disease_focus=resolved_disease_focus,
                current_visit_reason=current_visit_reason,
                records_hash=records_hash,
                brief_json=brief_data
            )
            db.add(cached)
        db.commit()

        return brief_data
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate clinical brief: {str(e)}")

@router.delete("/{uid}")
def delete_patient(uid: str, db: Session = Depends(get_db)):
    """Deletes a patient and all their associated records, claims, and briefs."""
    patient = db.query(Patient).filter(Patient.id == uid).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID {uid} not found.")
    
    try:
        # Explicitly delete any associated ClinicalBrief cached rows
        db.query(ClinicalBrief).filter(ClinicalBrief.patient_id == uid).delete()
        db.delete(patient)
        db.commit()
        return {"message": f"Patient {uid} and all associated records deleted successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete patient: {str(e)}")

