import os
import random
import string
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
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
    background_tasks: BackgroundTasks = None,
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

    # Save file locally & Supabase
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{patient_id}_{int(datetime.utcnow().timestamp())}{file_ext}"
    file_path = f"uploads/{safe_filename}"
    from app.services.storage import save_uploaded_file, delete_uploaded_file
    save_uploaded_file(safe_filename, file_bytes, file.content_type)

    # Call AI Parser Agent
    try:
        parsed_data = parse_medical_document(file_bytes, file.content_type)
    except Exception as e:
        # Clean up saved file on parsing error
        delete_uploaded_file(file_path)
        raise HTTPException(status_code=500, detail=f"AI Ingestion failed: {str(e)}")

    # Persistent clinical context matching using AI reasoning
    from app.models import ClinicalContext
    from app.services.claims_ai import match_document_to_clinical_context

    existing_contexts = db.query(ClinicalContext).filter(ClinicalContext.patient_id == patient_id).all()
    existing_contexts_data = [
        {"id": c.id, "name": c.name, "kind": c.kind, "first_date": c.first_date, "latest_date": c.latest_date, "reason": c.reason}
        for c in existing_contexts
    ]

    try:
        match_res = match_document_to_clinical_context(existing_contexts_data, parsed_data)
    except Exception as e:
        print(f"[INGEST MATCH ERROR] Failed to match context via AI: {e}")
        match_res = {
            "matched_context_id": None, 
            "suggested_context_name": parsed_data.get("record_type", "Medical Episode"), 
            "suggested_context_kind": "acute_active", 
            "reason": "AI match exception fallback"
        }

    matched_id = match_res.get("matched_context_id")
    if matched_id:
        db_ctx = db.query(ClinicalContext).filter(ClinicalContext.id == matched_id).first()
        r_date = parsed_data.get("date")
        if r_date:
            if not db_ctx.first_date or r_date < db_ctx.first_date:
                db_ctx.first_date = r_date
            if not db_ctx.latest_date or r_date > db_ctx.latest_date:
                db_ctx.latest_date = r_date
        db.commit()
    else:
        # Create a new persistent clinical context
        name = match_res.get("suggested_context_name") or parsed_data.get("record_type") or "Medical Episode"
        kind = match_res.get("suggested_context_kind") or "acute_active"
        reason = match_res.get("reason") or ""
        r_date = parsed_data.get("date")
        
        db_ctx = ClinicalContext(
            patient_id=patient_id,
            name=name,
            kind=kind,
            first_date=r_date,
            latest_date=r_date,
            reason=reason
        )
        db.add(db_ctx)
        db.commit()
        db.refresh(db_ctx)

    # Save Record entry
    new_record = Record(
        patient_id=patient_id,
        record_type=parsed_data.get("record_type", "Other"),
        date=parsed_data.get("date"),
        file_path=f"uploads/{safe_filename}",
        parsed_json=parsed_data,
        clinical_context_id=db_ctx.id
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    # Check for surgery advice to scaffold/update a cashless Claim
    if parsed_data.get("surgery_advised"):
        details = parsed_data.get("procedure_details", {}) or {}
        procedure_name = details.get("name") or "Advised Surgical Procedure"
        estimated_cost = details.get("estimated_cost")
        
        active_policy = db.query(InsurancePolicy).filter(
            InsurancePolicy.patient_id == patient_id,
            InsurancePolicy.status == "Active"
        ).first()
        policy_id = active_policy.id if active_policy else None
        
        # Check if cashless claim already exists for UID + active policy + clinical context
        existing_claim = db.query(Claim).filter(
            Claim.patient_id == patient_id,
            Claim.policy_id == policy_id,
            Claim.clinical_context_id == db_ctx.id,
            (Claim.status == "Draft") | (Claim.status == "Failed") | (Claim.status == "Ready for Review") | (Claim.status == "Missing Information")
        ).first()
        
        if existing_claim:
            # Reuse and update existing cashless claim draft
            existing_claim.procedure_name = procedure_name
            if estimated_cost is not None:
                try:
                    existing_claim.estimated_cost = float(estimated_cost)
                except:
                    pass
            sel = existing_claim.selected_records or []
            if new_record.id not in sel:
                sel.append(new_record.id)
            existing_claim.selected_records = sel
            db.commit()
        else:
            # Scaffold a new Claim under draft status
            new_claim = Claim(
                patient_id=patient_id,
                policy_id=policy_id,
                clinical_context_id=db_ctx.id,
                clinical_context=db_ctx.name,
                procedure_name=procedure_name,
                estimated_cost=estimated_cost,
                status="Draft",
                selected_records=[new_record.id],
                missing_documents=["Identity Proof", "Doctor Prescription Note", "Surgery Estimate Sheet"]
            )
            db.add(new_claim)
            db.commit()

    # Pre-warm clinical brief in background so it's ready when user views patient
    if background_tasks:
        from app.routers.patients import warm_brief_cache_background
        background_tasks.add_task(warm_brief_cache_background, patient_id, db_ctx.name)

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

    # Save file locally & Supabase
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{patient_id}_ins_{int(datetime.utcnow().timestamp())}{file_ext}"
    file_path = f"uploads/{safe_filename}"
    from app.services.storage import save_uploaded_file, delete_uploaded_file
    save_uploaded_file(safe_filename, file_bytes, file.content_type)

    # Call AI Parser Agent for Insurance Policy
    try:
        parsed_data = parse_insurance_document(file_bytes, file.content_type)
    except Exception as e:
        delete_uploaded_file(file_path)
        raise HTTPException(status_code=500, detail=f"Insurance policy parsing failed: {str(e)}")

    start_date = normalize_date(parsed_data.get("start_date"))
    end_date = normalize_date(parsed_data.get("end_date"))

    if start_date and end_date and start_date > end_date:
        from app.services.storage import delete_uploaded_file
        delete_uploaded_file(file_path)
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
        # Delete local file & Supabase
        if record.file_path:
            from app.services.storage import delete_uploaded_file
            delete_uploaded_file(record.file_path)
        
        # Invalidate clinical briefs by deleting cached entries for this patient
        db.query(ClinicalBrief).filter(ClinicalBrief.patient_id == patient_id).delete()
        
        ctx_id = record.clinical_context_id
        db.delete(record)
        db.commit()

        # Clean up orphaned clinical context if no records remain
        if ctx_id:
            from app.models import ClinicalContext
            remaining = db.query(Record).filter(Record.clinical_context_id == ctx_id).count()
            if remaining == 0:
                db.query(ClinicalContext).filter(ClinicalContext.id == ctx_id).delete()
                db.commit()

        return {"message": f"Record {id} deleted successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete record: {str(e)}")
