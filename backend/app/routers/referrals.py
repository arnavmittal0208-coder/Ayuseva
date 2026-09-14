import os
import base64
import io
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient, Record, ClinicalContext, VisitIntake, Referral
from app.services.storage import read_uploaded_file
from app.services.email import send_html_email

router = APIRouter(prefix="/api/referrals", tags=["referrals"])


# ---------------------------------------------------------------------------
# Pydantic Request / Response Schemas
# ---------------------------------------------------------------------------

class ReferralPrepareRequest(BaseModel):
    patient_id: str
    clinical_context_id: Optional[int] = None
    clinical_context_name: Optional[str] = None


class ReferralCreateRequest(BaseModel):
    patient_id: str
    clinical_context_id: Optional[int] = None
    clinical_context_name: str
    referring_hospital: str = "AyuSeva Network Hospital"
    receiving_hospital: str
    receiving_department: Optional[str] = None
    receiving_doctor: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    referral_reason: str
    urgency: str = "Emergency"  # Emergency, Urgent, Routine
    status: str = "Prepared"    # Draft, Prepared, Shared
    include_current_situation: bool = True
    selected_record_ids: Optional[List[int]] = None
    package_data: Optional[Dict[str, Any]] = None


class ReferralShareRequest(BaseModel):
    recipient_email: Optional[str] = None
    cc_email: Optional[str] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper: Extract context-grounded clinical details without inventing facts
# ---------------------------------------------------------------------------

def _extract_context_clinical_data(
    patient: Patient,
    context: Optional[ClinicalContext],
    context_records: List[Record],
    all_patient_records: List[Record],
    latest_intake: Optional[VisitIntake]
) -> Dict[str, Any]:
    """
    Synthesizes context-grounded referral information strictly from existing records.
    Never invents medications, allergies, laboratory results, or diagnoses.
    """
    # 1. Diagnoses from context records
    diagnoses = []
    seen_diag = set()
    for r in context_records:
        if r.parsed_json and isinstance(r.parsed_json, dict):
            for d in r.parsed_json.get("diagnoses") or []:
                if d and d not in seen_diag:
                    seen_diag.add(d)
                    diagnoses.append(d)
    if not diagnoses and context:
        diagnoses.append(context.name)

    # 2. Progression & Chronology
    progression = []
    for r in sorted(context_records, key=lambda x: str(x.date or ""), reverse=True):
        entry_summary = []
        if r.parsed_json and isinstance(r.parsed_json, dict):
            diags = r.parsed_json.get("diagnoses") or []
            if diags:
                entry_summary.append(f"Diagnosis: {', '.join(diags)}")
            labs = r.parsed_json.get("lab_results") or []
            if labs:
                lab_briefs = [f"{l.get('test_name')}: {l.get('result')} {l.get('unit') or ''}".strip() for l in labs[:3]]
                entry_summary.append(f"Findings: {'; '.join(lab_briefs)}")
        
        progression.append({
            "record_id": r.id,
            "date": r.date or "Date unrecorded",
            "record_type": r.record_type,
            "summary": " | ".join(entry_summary) if entry_summary else f"{r.record_type} on file"
        })

    # 3. Medications (strictly from context records)
    medications = []
    seen_meds = set()
    for r in context_records:
        if r.parsed_json and isinstance(r.parsed_json, dict):
            for m in r.parsed_json.get("medications") or []:
                if isinstance(m, dict):
                    name = m.get("name") or m.get("Name")
                    if name and name not in seen_meds:
                        seen_meds.add(name)
                        medications.append({
                            "name": name,
                            "dosage": m.get("dosage") or m.get("Dosage") or "Not specified",
                            "frequency": m.get("frequency") or m.get("Frequency") or "Not specified",
                            "source_date": r.date or "N/A"
                        })
                elif isinstance(m, str) and m.strip() and m.strip() not in seen_meds:
                    seen_meds.add(m.strip())
                    medications.append({
                        "name": m.strip(),
                        "dosage": "Not specified",
                        "frequency": "Not specified",
                        "source_date": r.date or "N/A"
                    })

    # 4. Investigations (from context records)
    investigations = []
    for r in context_records:
        if r.parsed_json and isinstance(r.parsed_json, dict):
            labs = r.parsed_json.get("lab_results") or []
            for l in labs:
                if isinstance(l, dict) and l.get("test_name"):
                    investigations.append({
                        "test_name": l.get("test_name"),
                        "result": l.get("result", "Recorded"),
                        "unit": l.get("unit", ""),
                        "reference_range": l.get("reference_range", "N/A"),
                        "date": r.date or "N/A"
                    })

    # 5. Allergies (check all records; if none found, explicitly state unavailable)
    allergies = []
    for r in all_patient_records:
        if r.parsed_json and isinstance(r.parsed_json, dict):
            for a in r.parsed_json.get("allergies") or []:
                if a and a not in allergies:
                    allergies.append(a)

    # 6. Important Warnings / Clinical Flags
    warnings = []
    if latest_intake and latest_intake.triage_priority == "priority_red_flag":
        for flag in latest_intake.triage_flags or []:
            warnings.append(f"Acute Intake Flag: {flag}")
    
    for r in context_records:
        if r.parsed_json and isinstance(r.parsed_json, dict):
            # Check for high fever, acute vitals if flagged
            for lab in r.parsed_json.get("lab_results") or []:
                test_name = str(lab.get("test_name", "")).lower()
                res_val = str(lab.get("result", "")).lower()
                if "troponin" in test_name and ("pos" in res_val or "elevated" in res_val):
                    warnings.append(f"Elevated Cardiac Marker: {lab.get('test_name')} ({lab.get('result')})")

    # 7. Current Situation (from latest visit intake)
    current_situation = None
    if latest_intake:
        current_situation = {
            "intake_id": latest_intake.id,
            "visit_datetime": latest_intake.visit_datetime.isoformat() if latest_intake.visit_datetime else None,
            "chief_complaints": latest_intake.chief_complaints or [],
            "symptom_duration": latest_intake.symptom_duration or "Not specified",
            "severity": latest_intake.severity or "Moderate",
            "recent_changes": latest_intake.recent_changes or "None reported",
            "clinical_summary": latest_intake.translated_narration or latest_intake.raw_narration or "Patient visit registered.",
            "triage_priority": latest_intake.triage_priority,
            "triage_flags": latest_intake.triage_flags or []
        }

    # 8. AI draft referral reason (strictly grounded, labeled for physician review)
    context_label = context.name if context else "Clinical Emergency"
    complaint_snippet = ""
    if current_situation and current_situation.get("chief_complaints"):
        complaint_snippet = f" presenting with {', '.join(current_situation['chief_complaints'])}"
    suggested_reason = f"Urgent clinical escalation and specialist evaluation required for {context_label}{complaint_snippet}. Full context-specific diagnostic history attached."

    return {
        "diagnoses": diagnoses,
        "progression": progression,
        "medications": medications,
        "investigations": investigations,
        "allergies": allergies if allergies else ["Not available in records"],
        "allergies_available": bool(allergies),
        "warnings": warnings if warnings else ["No acute red flags recorded in current files; clinical review required."],
        "current_situation": current_situation,
        "suggested_reason": suggested_reason
    }


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@router.get("/patient/{patient_id}")
def list_patient_referrals(
    patient_id: str,
    db: Session = Depends(get_db)
):
    """
    Returns previous emergency referrals for the selected patient UID.
    Orders referrals by creation date descending.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    referrals = (
        db.query(Referral)
        .filter(Referral.patient_id == patient_id)
        .order_by(Referral.created_at.desc())
        .all()
    )

    return [
        {
            "id": r.id,
            "patient_id": r.patient_id,
            "clinical_context_id": r.clinical_context_id,
            "clinical_context_name": r.clinical_context_name,
            "referring_hospital": r.referring_hospital,
            "receiving_hospital": r.receiving_hospital,
            "receiving_department": r.receiving_department,
            "receiving_doctor": r.receiving_doctor,
            "contact_email": r.contact_email,
            "contact_phone": r.contact_phone,
            "referral_reason": r.referral_reason,
            "urgency": r.urgency,
            "status": r.status,
            "selected_record_ids": r.selected_record_ids or [],
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "shared_at": r.shared_at.isoformat() if r.shared_at else None,
            "package_data": r.package_data
        }
        for r in referrals
    ]


@router.post("/prepare")
def prepare_referral_package(
    req: ReferralPrepareRequest,
    db: Session = Depends(get_db)
):
    """
    Context-Aware Clinical Handoff Preparation Engine:
    Selects patient, filters by active Clinical Context, extracts relevant records,
    organizes clinical history, progression, meds, investigations, and current visit intake.
    """
    # 1. Validate Patient
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {req.patient_id} not found.")

    # 2. Validate Clinical Context
    context = None
    if req.clinical_context_id:
        context = (
            db.query(ClinicalContext)
            .filter(
                ClinicalContext.id == req.clinical_context_id,
                ClinicalContext.patient_id == req.patient_id
            )
            .first()
        )
        if not context:
            raise HTTPException(status_code=400, detail="Clinical context does not belong to this patient.")
    elif req.clinical_context_name:
        context = (
            db.query(ClinicalContext)
            .filter(
                ClinicalContext.name == req.clinical_context_name,
                ClinicalContext.patient_id == req.patient_id
            )
            .first()
        )

    # 3. Retrieve All Patient Records
    all_records = (
        db.query(Record)
        .filter(Record.patient_id == req.patient_id, Record.record_type != "INSURANCE_POLICY")
        .order_by(Record.date.desc())
        .all()
    )

    # 4. Context-Specific Records Selection
    context_records = []
    if context:
        context_records = [r for r in all_records if r.clinical_context_id == context.id]
        # If no records linked by foreign key yet, fallback to context name match
        if not context_records:
            context_records = [
                r for r in all_records
                if r.parsed_json and context.name.lower() in str(r.parsed_json).lower()
            ]

    # Default selected record IDs are exclusively context records
    default_selected_record_ids = [r.id for r in context_records]

    # 5. Retrieve Current Visit Intake
    latest_intake = (
        db.query(VisitIntake)
        .filter(VisitIntake.patient_id == req.patient_id)
        .order_by(VisitIntake.visit_datetime.desc())
        .first()
    )

    # 6. Synthesize Clinical Handoff
    clinical_data = _extract_context_clinical_data(
        patient=patient,
        context=context,
        context_records=context_records,
        all_patient_records=all_records,
        latest_intake=latest_intake
    )

    return {
        "patient": {
            "id": patient.id,
            "name": patient.name or "N/A",
            "phone": patient.phone or "N/A",
            "dob": patient.dob or "N/A"
        },
        "clinical_context": {
            "id": context.id if context else None,
            "name": context.name if context else (req.clinical_context_name or "Emergency Evaluation"),
            "kind": context.kind if context else "acute_active",
            "first_date": context.first_date if context else None,
            "latest_date": context.latest_date if context else None
        },
        "metrics": {
            "total_patient_records": len(all_records),
            "context_records_count": len(context_records),
            "summary_statement": f"{len(all_records)} patient records exist — {len(context_records)} records identified for this clinical context."
        },
        "default_selected_record_ids": default_selected_record_ids,
        "context_records": [
            {
                "id": r.id,
                "record_type": r.record_type,
                "date": r.date or "N/A",
                "file_path": r.file_path,
                "file_name": os.path.basename(r.file_path) if r.file_path else f"Record_{r.id}.pdf",
                "is_context_record": True
            }
            for r in context_records
        ],
        "all_records": [
            {
                "id": r.id,
                "record_type": r.record_type,
                "date": r.date or "N/A",
                "file_path": r.file_path,
                "file_name": os.path.basename(r.file_path) if r.file_path else f"Record_{r.id}.pdf",
                "is_context_record": r.id in default_selected_record_ids
            }
            for r in all_records
        ],
        "clinical_handoff": clinical_data
    }


@router.post("")
def create_referral(
    req: ReferralCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Creates and persists a new Emergency Referral instance.
    Validates patient isolation and record ownership.
    """
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {req.patient_id} not found.")

    if req.clinical_context_id:
        ctx = db.query(ClinicalContext).filter(
            ClinicalContext.id == req.clinical_context_id,
            ClinicalContext.patient_id == req.patient_id
        ).first()
        if not ctx:
            raise HTTPException(status_code=400, detail="Clinical context does not belong to this patient.")

    # Validate selected records belong to patient
    if req.selected_record_ids:
        records_count = (
            db.query(Record)
            .filter(
                Record.id.in_(req.selected_record_ids),
                Record.patient_id == req.patient_id
            )
            .count()
        )
        if records_count != len(req.selected_record_ids):
            raise HTTPException(status_code=400, detail="One or more selected records do not belong to this patient.")

    new_referral = Referral(
        patient_id=req.patient_id,
        clinical_context_id=req.clinical_context_id,
        clinical_context_name=req.clinical_context_name,
        referring_hospital=req.referring_hospital,
        receiving_hospital=req.receiving_hospital,
        receiving_department=req.receiving_department,
        receiving_doctor=req.receiving_doctor,
        contact_email=req.contact_email,
        contact_phone=req.contact_phone,
        referral_reason=req.referral_reason,
        urgency=req.urgency,
        status=req.status or "Prepared",
        include_current_situation=req.include_current_situation,
        selected_record_ids=req.selected_record_ids or [],
        package_data=req.package_data or {},
        created_at=datetime.utcnow()
    )

    db.add(new_referral)
    db.commit()
    db.refresh(new_referral)

    return {
        "status": "success",
        "message": "Emergency referral created successfully",
        "referral_id": new_referral.id,
        "referral": {
            "id": new_referral.id,
            "patient_id": new_referral.patient_id,
            "clinical_context_name": new_referral.clinical_context_name,
            "receiving_hospital": new_referral.receiving_hospital,
            "status": new_referral.status,
            "created_at": new_referral.created_at.isoformat()
        }
    }


@router.get("/{referral_id}")
def get_referral_details(
    referral_id: int,
    db: Session = Depends(get_db)
):
    """
    Fetches full package details of a specific emergency referral.
    """
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found.")

    patient = db.query(Patient).filter(Patient.id == referral.patient_id).first()
    attached_records = (
        db.query(Record)
        .filter(Record.id.in_(referral.selected_record_ids or []))
        .all()
    )

    return {
        "id": referral.id,
        "patient": {
            "id": patient.id,
            "name": patient.name or "N/A",
            "phone": patient.phone or "N/A",
            "dob": patient.dob or "N/A"
        },
        "clinical_context_name": referral.clinical_context_name,
        "referring_hospital": referral.referring_hospital,
        "receiving_hospital": referral.receiving_hospital,
        "receiving_department": referral.receiving_department,
        "receiving_doctor": referral.receiving_doctor,
        "contact_email": referral.contact_email,
        "contact_phone": referral.contact_phone,
        "referral_reason": referral.referral_reason,
        "urgency": referral.urgency,
        "status": referral.status,
        "include_current_situation": referral.include_current_situation,
        "selected_records": [
            {
                "id": r.id,
                "record_type": r.record_type,
                "date": r.date,
                "file_path": r.file_path,
                "file_name": os.path.basename(r.file_path) if r.file_path else f"Record_{r.id}.pdf"
            }
            for r in attached_records
        ],
        "package_data": referral.package_data or {},
        "created_at": referral.created_at.isoformat() if referral.created_at else None,
        "shared_at": referral.shared_at.isoformat() if referral.shared_at else None
    }


# ---------------------------------------------------------------------------
# PDF Generation Helper (using ReportLab)
# ---------------------------------------------------------------------------

def _generate_referral_pdf(referral: Referral, patient: Patient, attached_records: List[Record]) -> bytes:
    """
    Generates a concise, high-contrast, doctor-readable Emergency Clinical Referral PDF.
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#0f766e"),
        fontName="Helvetica-Bold"
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#0f766e"),
        fontName="Helvetica-Bold",
        spaceBefore=8,
        spaceAfter=3
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#1e293b"),
        fontName="Helvetica"
    )

    bold_label = ParagraphStyle(
        'BoldLabel',
        parent=body_style,
        fontName="Helvetica-Bold"
    )

    alert_style = ParagraphStyle(
        'AlertStyle',
        parent=body_style,
        textColor=colors.HexColor("#b91c1c"),
        fontName="Helvetica-Bold"
    )

    elements = []

    # 1. Header Banner
    header_data = [
        [
            Paragraph("<b>AYUSEVA CLINICAL PLATFORM</b><br/><font size=7 color='#64748b'>Emergency Patient Referral & Clinical Handoff</font>", body_style),
            Paragraph(f"<font color='#0f766e'><b>URGENCY: {referral.urgency.upper()}</b></font><br/><font size=7 color='#64748b'>Ref ID: REF-{referral.id:04d} | Date: {referral.created_at.strftime('%d-%b-%Y %H:%M') if referral.created_at else 'N/A'}</font>", ParagraphStyle('RAlign', parent=body_style, alignment=2))
        ]
    ]
    header_table = Table(header_data, colWidths=[300, 240])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f766e"), spaceAfter=8))

    # 2. Patient & Facility Route Matrix
    p_data = referral.package_data or {}
    route_data = [
        [
            Paragraph(f"<b>PATIENT:</b> {patient.name} (UID: {patient.id})", body_style),
            Paragraph(f"<b>FROM:</b> {referral.referring_hospital}", body_style)
        ],
        [
            Paragraph(f"<b>DOB / AGE:</b> {patient.dob or 'N/A'} | <b>PHONE:</b> {patient.phone or 'N/A'}", body_style),
            Paragraph(f"<b>TO:</b> {referral.receiving_hospital}", body_style)
        ],
        [
            Paragraph(f"<b>CLINICAL CONTEXT:</b> <font color='#0f766e'><b>{referral.clinical_context_name}</b></font>", body_style),
            Paragraph(f"<b>DEPT / DOCTOR:</b> {referral.receiving_department or 'Emergency'} / {referral.receiving_doctor or 'Attending'}", body_style)
        ]
    ]
    route_table = Table(route_data, colWidths=[270, 270])
    route_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(route_table)
    elements.append(Spacer(1, 6))

    # 3. Referral Reason
    elements.append(Paragraph("REFERRAL REASON", section_heading))
    elements.append(Paragraph(referral.referral_reason or "Specialist evaluation required.", body_style))
    elements.append(Spacer(1, 6))

    # 4. Current Situation (if included)
    cs = p_data.get("current_situation")
    if referral.include_current_situation and cs:
        elements.append(Paragraph("CURRENT VISIT SITUATION (INTAKE SNAPSHOT)", section_heading))
        complaints_str = ", ".join(cs.get("chief_complaints") or ["General discomfort"])
        situation_text = (
            f"<b>Chief Complaints:</b> {complaints_str} (Duration: {cs.get('symptom_duration', 'N/A')}, Severity: {cs.get('severity', 'N/A')})<br/>"
            f"<b>Recent Changes:</b> {cs.get('recent_changes', 'None reported')}<br/>"
            f"<b>Clinical English Summary:</b> {cs.get('clinical_summary', 'N/A')}"
        )
        elements.append(Paragraph(situation_text, body_style))
        elements.append(Spacer(1, 6))

    # 5. Relevant Clinical History & Progression
    elements.append(Paragraph(f"RELEVANT CLINICAL HISTORY ({referral.clinical_context_name})", section_heading))
    progs = p_data.get("progression") or []
    if progs:
        prog_rows = [["Date", "Record Type", "Clinical Findings / Diagnosis"]]
        for pr in progs[:6]:
            prog_rows.append([pr.get("date", "N/A"), pr.get("record_type", "Record"), Paragraph(pr.get("summary", ""), body_style)])
        prog_table = Table(prog_rows, colWidths=[75, 110, 355])
        prog_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f766e")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ]))
        elements.append(prog_table)
    else:
        elements.append(Paragraph("No historical records directly linked to this context.", body_style))
    elements.append(Spacer(1, 6))

    # 6. Medications & Allergies in two columns
    meds = p_data.get("medications") or []
    allergies = p_data.get("allergies") or ["Not available in records"]
    
    meds_text = "<b>Current Medications:</b><br/>"
    if meds:
        meds_text += "<br/>".join([f"• {m.get('name')} — {m.get('dosage')} ({m.get('frequency')})" for m in meds[:6]])
    else:
        meds_text += "Not available in records"

    allergies_text = "<b>Known Allergies:</b><br/>"
    allergies_text += "<br/>".join([f"• {a}" for a in allergies])

    med_allergy_table = Table([[Paragraph(meds_text, body_style), Paragraph(allergies_text, body_style)]], colWidths=[320, 220])
    med_allergy_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0, 0), (-1, -1), 6)
    ]))
    elements.append(med_allergy_table)
    elements.append(Spacer(1, 6))

    # 7. Important Warnings
    warnings = p_data.get("warnings") or []
    if warnings:
        elements.append(Paragraph("IMPORTANT CLINICAL WARNINGS (FOR RECEIVING PHYSICIAN REVIEW)", section_heading))
        w_text = "<br/>".join([f"⚠ {w}" for w in warnings])
        elements.append(Paragraph(w_text, alert_style))
        elements.append(Spacer(1, 6))

    # 8. Attached Supporting Documents List
    elements.append(Paragraph("ATTACHED SUPPORTING MEDICAL DOCUMENTS", section_heading))
    if attached_records:
        doc_bullets = "<br/>".join([f"✓ {r.record_type} (Date: {r.date or 'N/A'}, File: {os.path.basename(r.file_path) if r.file_path else 'Direct Upload'})" for r in attached_records])
        elements.append(Paragraph(doc_bullets, body_style))
    else:
        elements.append(Paragraph("No original records attached.", body_style))
    elements.append(Spacer(1, 10))

    # Footer Disclaimer
    footer_text = (
        "<b>Clinical Disclaimer:</b> This Emergency Referral Package was prepared by AyuSeva to organize context-relevant clinical history "
        "for the receiving medical team. It does not replace clinical evaluation or autonomous diagnostic decision-making."
    )
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceAfter=4))
    elements.append(Paragraph(footer_text, ParagraphStyle('FooterStyle', parent=body_style, fontSize=7, leading=9, textColor=colors.HexColor("#64748b"))))

    doc.build(elements)
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data


@router.get("/{referral_id}/pdf")
def download_referral_pdf(
    referral_id: int,
    db: Session = Depends(get_db)
):
    """
    Renders and downloads the standardized Emergency Clinical Referral PDF.
    """
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found.")

    patient = db.query(Patient).filter(Patient.id == referral.patient_id).first()
    attached_records = (
        db.query(Record)
        .filter(Record.id.in_(referral.selected_record_ids or []))
        .all()
    )

    pdf_bytes = _generate_referral_pdf(referral, patient, attached_records)

    filename = f"Emergency_Referral_{patient.id}_{referral.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"'
        }
    )


@router.post("/{referral_id}/share")
def share_referral_package(
    referral_id: int,
    req: ReferralShareRequest = None,
    db: Session = Depends(get_db)
):
    """
    Dispatches the Emergency Clinical Referral package via the existing Resend email service.
    Attaches both:
      1. The generated Emergency Clinical Referral PDF.
      2. The selected relevant supporting medical documents from storage.
    Updates referral status to 'Shared'.
    """
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found.")

    patient = db.query(Patient).filter(Patient.id == referral.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient details not found.")

    recipient = (req and req.recipient_email) or referral.contact_email or "receiving-hospital-sandbox@ayuseva.com"
    cc_email = (req and req.cc_email) or None

    attached_records = (
        db.query(Record)
        .filter(Record.id.in_(referral.selected_record_ids or []))
        .all()
    )

    # 1. Generate Referral PDF
    pdf_bytes = _generate_referral_pdf(referral, patient, attached_records)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    attachments = [
        {
            "filename": f"Emergency_Clinical_Referral_{patient.id}.pdf",
            "content": pdf_b64
        }
    ]

    # 2. Attach actual supporting documents using storage service
    missing_attachments = []
    for r in attached_records:
        if r.file_path:
            file_data = read_uploaded_file(r.file_path)
            if file_data:
                file_b64 = base64.b64encode(file_data).decode("utf-8")
                safe_name = os.path.basename(r.file_path)
                attachments.append({
                    "filename": f"{r.record_type.replace(' ', '_')}_{safe_name}",
                    "content": file_b64
                })
            else:
                missing_attachments.append(f"{r.record_type} ({r.file_path})")

    # If any selected file could not be read, show clear error as requested
    if missing_attachments:
        raise HTTPException(
            status_code=400,
            detail=f"Could not retrieve the following selected document(s) from storage: {', '.join(missing_attachments)}. Please verify files before dispatch."
        )

    # 3. Assemble HTML Email Body
    records_checklist_html = "".join([
        f"<li><b>{r.record_type}</b> — Date: {r.date or 'N/A'} (File: {os.path.basename(r.file_path) if r.file_path else 'Direct Upload'})</li>"
        for r in attached_records
    ]) or "<li>No additional records attached.</li>"

    p_data = referral.package_data or {}
    cs = p_data.get("current_situation")
    current_situation_html = ""
    if referral.include_current_situation and cs:
        current_situation_html = f"""
        <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 12px; margin: 15px 0; border-radius: 4px;">
            <strong style="color: #9f1239; text-transform: uppercase; font-size: 11px;">Current Visit Situation Snapshot:</strong>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #881337;">
                <b>Complaints:</b> {', '.join(cs.get('chief_complaints') or ['Unspecified'])} | <b>Severity:</b> {cs.get('severity', 'N/A')}<br/>
                <b>Clinical Summary:</b> {cs.get('clinical_summary', 'N/A')}
            </p>
        </div>
        """

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 620px; margin: 0 auto; border: 1px solid #0f766e; padding: 24px; border-radius: 8px;">
        <div style="background-color: #0f766e; color: white; padding: 16px; text-align: center; border-radius: 6px 6px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">AyuSeva Emergency Clinical Referral</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #99f6e4;">Context-Aware Patient Transfer & Clinical Handoff</p>
        </div>
        
        <div style="padding: 16px 8px;">
          <p>Dear Clinical Receiving Team at <b>{referral.receiving_hospital}</b>,</p>
          <p>Please find attached the emergency clinical referral package for patient <b>{patient.name}</b> (UID: <code>{patient.id}</code>). This referral has been synthesized specifically around the active clinical context: <b>{referral.clinical_context_name}</b>.</p>
          
          <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; padding: 12px; border-radius: 6px; margin: 12px 0; font-size: 13px;">
            <p style="margin: 2px 0;"><b>Urgency Level:</b> <span style="color: #b91c1c; font-weight: bold;">{referral.urgency.upper()}</span></p>
            <p style="margin: 2px 0;"><b>Referring Facility:</b> {referral.referring_hospital}</p>
            <p style="margin: 2px 0;"><b>Target Department:</b> {referral.receiving_department or 'Emergency Medicine'}</p>
            <p style="margin: 2px 0;"><b>Referral Reason:</b> {referral.referral_reason}</p>
          </div>

          {current_situation_html}

          <h4 style="color: #0f766e; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Included Referral Documents:</h4>
          <ul style="font-size: 13px; color: #334155; padding-left: 20px;">
            <li><b>Emergency_Clinical_Referral_{patient.id}.pdf</b> (Doctor-Readable Handoff Summary)</li>
            {records_checklist_html}
          </ul>

          <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
            Kindly review the attached clinical package for further medical management.<br/>
            Regards,<br/>
            <b>{referral.referring_hospital}</b>
          </p>
        </div>
      </body>
    </html>
    """

    subject = f"Emergency Clinical Referral — {patient.id} — {referral.clinical_context_name} [{referral.urgency.upper()}]"

    success = send_html_email(
        to_email=recipient,
        subject=subject,
        html_content=html_content,
        cc_email=cc_email,
        attachments=attachments
    )

    if success:
        referral.status = "Shared"
        referral.shared_at = datetime.utcnow()
        db.commit()
        return {
            "status": "success",
            "message": "Emergency referral package dispatched successfully",
            "recipient": recipient,
            "attachments_count": len(attachments)
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="Failed to dispatch referral package via email service. Please verify email settings and try again."
        )
