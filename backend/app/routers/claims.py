from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Patient, Record, Claim, InsurancePolicy
from app.services.email import send_html_email
from app.services.claims_ai import analyze_cashless_claim_context
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

router = APIRouter(prefix="/api/claims", tags=["claims"])

# Request/Response schemas
class CashlessInitRequest(BaseModel):
    clinical_context: str

class CashlessUpdateRequest(BaseModel):
    procedure_name: Optional[str] = None
    estimated_cost: Optional[float] = None
    status: Optional[str] = None
    selected_records: Optional[List[int]] = None
    generated_form_data: Optional[Dict[str, Any]] = None
    email_preview: Optional[Dict[str, Any]] = None
    insurer_response: Optional[str] = None

class ClaimSubmitRequest(BaseModel):
    tpa_email: Optional[str] = None
    patient_email: Optional[str] = None

class ClaimSimulationRequest(BaseModel):
    status: str
    insurer_response: str

def parse_cost(val):
    if not val or val == "Not available in current records":
        return None
    try:
        if isinstance(val, (int, float)):
            return float(val)
        cleaned = "".join(ch for ch in str(val) if ch.isdigit() or ch == ".")
        return float(cleaned) if cleaned else None
    except Exception:
        return None

@router.get("/patient/{patient_id}")
def get_patient_claims(patient_id: str, db: Session = Depends(get_db)):
    """Fetches all claims (cashless & legacy) for a specific patient UID"""
    claims = db.query(Claim).filter(Claim.patient_id == patient_id).order_by(Claim.created_at.desc()).all()
    return claims

@router.get("/{claim_id}")
def get_claim_details(claim_id: int, db: Session = Depends(get_db)):
    """Fetches full details of a specific claim"""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return claim

@router.post("/patient/{patient_id}/cashless/init")
def initialize_cashless_claim(
    patient_id: str,
    req: CashlessInitRequest,
    db: Session = Depends(get_db)
):
    """
    Scaffolds a cashless pre-auth claim draft. Uses AI to check policy,
    identify relevant documents, extract form data and draft covering email.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    active_policy = db.query(InsurancePolicy).filter(
        InsurancePolicy.patient_id == patient_id,
        InsurancePolicy.status == "Active"
    ).first()
    
    if not active_policy:
        raise HTTPException(
            status_code=400, 
            detail="Patient has no active insurance policy. Please upload a policy first."
        )

    # Check if cashless claim already exists for clinical context
    from app.models import ClinicalContext
    db_ctx = db.query(ClinicalContext).filter(
        ClinicalContext.patient_id == patient_id,
        ClinicalContext.name == req.clinical_context
    ).first()
    
    existing_claim = db.query(Claim).filter(
        Claim.patient_id == patient_id,
        Claim.policy_id == active_policy.id,
        (Claim.clinical_context_id == db_ctx.id) if db_ctx else (Claim.clinical_context == req.clinical_context),
        (Claim.status == "Draft") | (Claim.status == "Failed") | (Claim.status == "Ready for Review") | (Claim.status == "Missing Information")
    ).first()
    if existing_claim:
        return existing_claim

    # Fetch patient EMR records (excluding policy document itself)
    records = db.query(Record).filter(
        Record.patient_id == patient_id, 
        Record.record_type != "INSURANCE_POLICY"
    ).all()

    # Filter EMR records to only those in the context
    if db_ctx:
        records = [r for r in records if r.clinical_context_id == db_ctx.id]

    # Prepare data for AI reasoning
    patient_data = {
        "id": patient.id,
        "name": patient.name,
        "dob": patient.dob,
        "phone": patient.phone
    }
    policy_data = {
        "id": active_policy.id,
        "insurer": active_policy.insurer,
        "policy_number": active_policy.policy_number,
        "policyholder_name": active_policy.policyholder_name,
        "patient_name": active_policy.patient_name,
        "member_id": active_policy.member_id,
        "policy_type": active_policy.policy_type,
        "sum_insured": active_policy.sum_insured,
        "insurer_email": active_policy.insurer_email,
        "benefits_coverage": active_policy.benefits_coverage,
        "conditions_limitations": active_policy.conditions_limitations
    }
    records_list = [
        {
            "id": r.id,
            "record_type": r.record_type,
            "date": r.date,
            "parsed_json": r.parsed_json
        } for r in records
    ]

    try:
        ai_result = analyze_cashless_claim_context(
            patient_data, 
            policy_data, 
            records_list, 
            req.clinical_context
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"AI claims analysis failed: {str(e)}"
        )

    # Determine default checked records (relevance == High)
    selected_records = [
        r["record_id"] for r in ai_result.get("relevant_records", []) 
        if r.get("relevance") == "High"
    ]

    form_data = ai_result.get("cashless_form", {})
    procedure = form_data.get("treatment_procedure") or "Cashless Procedure"
    cost = parse_cost(form_data.get("estimated_cost"))

    policy_check = ai_result.get("policy_check", {})
    missing_info = ai_result.get("missing_info", [])

    # Scaffold status based on missing information
    default_status = "Ready for Review"
    if missing_info:
        default_status = "Missing Information"

    new_claim = Claim(
        patient_id=patient_id,
        policy_id=active_policy.id,
        clinical_context_id=db_ctx.id if db_ctx else None,
        procedure_name=procedure,
        estimated_cost=cost,
        clinical_context=req.clinical_context,
        status=default_status,
        selected_records=selected_records,
        policy_check_status=policy_check.get("status", "Needs Review"),
        policy_check_details=policy_check,
        missing_info=missing_info,
        generated_form_data=form_data,
        email_preview=ai_result.get("email_preview", {}),
        missing_documents=policy_check.get("required_documents", []),
        insurer_response=None
    )

    db.add(new_claim)
    db.commit()
    db.refresh(new_claim)

    return new_claim

@router.put("/{claim_id}")
def update_claim_details(
    claim_id: int,
    req: CashlessUpdateRequest,
    db: Session = Depends(get_db)
):
    """Updates cashless claim form details, selected records, cost, or email preview"""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")

    if req.procedure_name is not None:
        claim.procedure_name = req.procedure_name
    if req.estimated_cost is not None:
        claim.estimated_cost = req.estimated_cost
    if req.status is not None:
        claim.status = req.status
    if req.selected_records is not None:
        claim.selected_records = req.selected_records
    if req.generated_form_data is not None:
        claim.generated_form_data = req.generated_form_data
    if req.email_preview is not None:
        claim.email_preview = req.email_preview
    if req.insurer_response is not None:
        claim.insurer_response = req.insurer_response

    claim.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(claim)
    return claim

@router.post("/{claim_id}/submit")
def submit_preauth_claim(
    claim_id: int,
    req: ClaimSubmitRequest = None,
    db: Session = Depends(get_db)
):
    """
    Sends the cashless claim pre-auth package via mock email infrastructure.
    Transitions status to 'Sent' ONLY if email transmission succeeds.
    """
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")

    patient = db.query(Patient).filter(Patient.id == claim.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient details not found.")

    # Determine recipient insurer email
    insurer_email = None
    if claim.email_preview and claim.email_preview.get("recipient"):
        insurer_email = claim.email_preview["recipient"]
    
    if not insurer_email or insurer_email == "Not available in current records":
        active_policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == claim.policy_id).first()
        if active_policy and active_policy.insurer_email:
            insurer_email = active_policy.insurer_email

    tpa_email = req.tpa_email if req and req.tpa_email else insurer_email
    if not tpa_email or tpa_email == "Not available in current records":
        tpa_email = "tpa-claims-sandbox@ayuseva.com"

    patient_email = req.patient_email if req and req.patient_email else "patient-alerts@ayuseva.com"

    # Assemble HTML body using email preview and attachments list
    email_body = claim.email_preview.get("body") if (claim.email_preview and claim.email_preview.get("body")) else ""
    if not email_body:
        email_body = f"Please find attached the cashless pre-authorization claim request for {patient.name} ({patient.id})."

    # Retrieve attachments details
    attached_records = db.query(Record).filter(Record.id.in_(claim.selected_records or [])).all()
    attachments_list_html = ""
    for r in attached_records:
        attachments_list_html += f"<li>{r.record_type} (Date: {r.date or 'N/A'}, Path: {r.file_path or 'Direct Ingest'})</li>"

    # Include manually added supporting documents in email attachments checklist
    supporting_docs = claim.supporting_documents or []
    for doc in supporting_docs:
        attachments_list_html += f"<li>{doc.get('file_name')} (Supporting Document - Manually Added, Path: {doc.get('file_path')})</li>"

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; border: 1px solid #14b8a6; padding: 20px; border-radius: 8px;">
        <div style="background-color: #0f766e; color: white; padding: 15px; text-align: center; border-radius: 6px 6px 0 0;">
          <h2>AyuSeva Cashless Pre-Auth Claim</h2>
          <p>Verified Claim Package Dispatched</p>
        </div>
        <div style="padding: 15px;">
          <p>{email_body.replace('\n', '<br/>')}</p>
          
          <h3 style="color: #0f766e; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Attached Documents Checklist</h3>
          <ul style="padding-left: 20px;">
            {attachments_list_html or "<li>No records attached.</li>"}
          </ul>
          
          <div style="background-color: #f0fdfa; border-left: 4px solid #0f766e; padding: 10px; margin-top: 20px; font-size: 11px;">
            <strong>AyuSeva Verification Alert:</strong> This is a secure digital cashless authorization query. Case materials have been verified and audited under patient UID: {patient.id}.
          </div>
        </div>
      </body>
    </html>
    """

    subject = claim.email_preview.get("subject") if (claim.email_preview and claim.email_preview.get("subject")) else f"Pre-Auth Claim Request [AyuSeva] - {claim.procedure_name} - {patient.id}"

    import os
    import base64
    from app.services.storage import read_uploaded_file
    attachments = []
    
    # 1. Add AI-selected records
    for r in attached_records:
        if r.file_path:
            try:
                file_bytes = read_uploaded_file(r.file_path)
                if file_bytes:
                    content_b64 = base64.b64encode(file_bytes).decode("utf-8")
                    attachments.append({
                        "filename": os.path.basename(r.file_path),
                        "content": content_b64
                    })
                else:
                    print(f"[ATTACHMENT WARNING] Could not read file content for record {r.id}: {r.file_path}")
            except Exception as attachment_err:
                print(f"Failed to read/encode record attachment {r.file_path}: {attachment_err}")

    # 2. Add manually uploaded supporting documents
    for doc in supporting_docs:
        path = doc.get("file_path")
        if path:
            try:
                file_bytes = read_uploaded_file(path)
                if file_bytes:
                    content_b64 = base64.b64encode(file_bytes).decode("utf-8")
                    attachments.append({
                        "filename": doc.get("file_name") or os.path.basename(path),
                        "content": content_b64
                    })
                else:
                    print(f"[ATTACHMENT WARNING] Could not read file content for supporting document: {path}")
            except Exception as attachment_err:
                print(f"Failed to read/encode supporting document {path}: {attachment_err}")

    success = send_html_email(
        to_email=tpa_email,
        subject=subject,
        html_content=html_content,
        cc_email=patient_email,
        attachments=attachments
    )

    if success:
        claim.status = "Sent"
        claim.updated_at = datetime.utcnow()
        db.commit()
        return {
            "status": "success",
            "message": "Cashless claim submitted successfully",
            "tpa_email": tpa_email,
            "patient_cc": patient_email
        }
    else:
        # Strict status requirement: If sending fails, do not mark as Sent, mark as Failed
        claim.status = "Failed"
        claim.updated_at = datetime.utcnow()
        db.commit()
        from app.services.email import last_email_error
        err_detail = "TPA Email transmission failed. Please check Resend service state and try again."
        if last_email_error:
            err_detail = f"Resend API Error: [{last_email_error['type']}] {last_email_error['message']}"
            if last_email_error.get("status_code"):
                err_detail += f" (Status Code: {last_email_error['status_code']})"
        raise HTTPException(
            status_code=500, 
            detail=err_detail
        )

@router.post("/{claim_id}/simulate-response")
def simulate_insurer_response(
    claim_id: int,
    req: ClaimSimulationRequest,
    db: Session = Depends(get_db)
):
    """Simulates an insurer response (Approved, Partially Approved, Rejected, etc.) for testing"""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")

    claim.status = req.status
    claim.insurer_response = req.insurer_response
    claim.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(claim)
    return claim

@router.delete("/{claim_id}")
def delete_claim(claim_id: int, db: Session = Depends(get_db)):
    """Deletes a claim from SQLite"""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")
    
    db.delete(claim)
    db.commit()
    return {"message": "Claim successfully deleted"}

@router.post("/patient/{uid}/trigger-preventive")
def trigger_preventive_checkup(
    uid: str,
    lab_email: str = Body("bookings@lalpathlabs-sandbox.com"),
    patient_email: str = Body("patient-alerts@ayuseva.com"),
    db: Session = Depends(get_db)
):
    """Simulates scheduling checkups (legacy method, kept for compatibility)"""
    patient = db.query(Patient).filter(Patient.id == uid).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {uid} not found.")

    html_content = f"""
    <html>
      <body>
        <h3>Preventive checkup request</h3>
        <p>Patient {patient.name} ({patient.id}) eligible for health checkups.</p>
      </body>
    </html>
    """
    subject = f"Preventive Home Collection Booking [AyuSeva] - {patient.id}"
    success = send_html_email(lab_email, subject, html_content, cc_email=patient_email)
    if success:
        return {"status": "Preventive checkup booked.", "lab_notified": lab_email, "patient_cc": patient_email}
    else:
        raise HTTPException(status_code=500, detail="Failed to dispatch laboratory collection email.")


from fastapi import UploadFile, File, Query

@router.post("/{claim_id}/supporting-document")
def upload_supporting_document(
    claim_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    import os
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")
        
    # Filter/clean filename characters to prevent path injections
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
    filename = f"supporting_claims/supporting_{claim_id}_{int(datetime.utcnow().timestamp())}_{safe_name}"
    
    try:
        content = file.file.read()
        from app.services.storage import save_uploaded_file
        content_type = getattr(file, "content_type", "application/octet-stream")
        file_path = save_uploaded_file(filename, content, content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save supporting document: {str(e)}")
        
    current_docs = list(claim.supporting_documents or [])
    current_docs.append({
        "file_name": file.filename,
        "file_path": file_path
    })
    claim.supporting_documents = current_docs
    db.commit()
    db.refresh(claim)
    
    return {"supporting_documents": claim.supporting_documents}


@router.delete("/{claim_id}/supporting-document")
def delete_supporting_document(
    claim_id: int,
    file_path: str = Query(..., description="The path of the supporting document to remove"),
    db: Session = Depends(get_db)
):
    import os
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")
        
    current_docs = list(claim.supporting_documents or [])
    filtered_docs = [doc for doc in current_docs if doc.get("file_path") != file_path]
    
    if file_path:
        from app.services.storage import delete_uploaded_file
        delete_uploaded_file(file_path)
            
    claim.supporting_documents = filtered_docs
    db.commit()
    db.refresh(claim)
    
    return {"supporting_documents": claim.supporting_documents}
