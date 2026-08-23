import os
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Patient, PersonalDocument

router = APIRouter(prefix="/api/personal-documents", tags=["personal_documents"])

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 2 GB limit in bytes
STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024

@router.get("/patient/{patient_id}")
def get_personal_documents(patient_id: str, db: Session = Depends(get_db)):
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    docs = db.query(PersonalDocument).filter(PersonalDocument.patient_id == patient_id).all()
    
    # Calculate total usage
    total_usage = db.query(func.sum(PersonalDocument.file_size)).filter(PersonalDocument.patient_id == patient_id).scalar() or 0

    return {
        "documents": [
            {
                "id": d.id,
                "file_name": d.file_name,
                "file_type": d.file_type,
                "file_size": d.file_size,
                "file_path": d.file_path,
                "created_at": d.created_at.isoformat()
            }
            for d in docs
        ],
        "total_usage_bytes": total_usage,
        "storage_limit_bytes": STORAGE_LIMIT_BYTES
    }

@router.post("/upload")
async def upload_personal_document(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    db: Session = Depends(get_db)
):
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Read bytes to check file size
    file_bytes = await file.read()
    file_size = len(file_bytes)

    # Check total usage
    current_usage = db.query(func.sum(PersonalDocument.file_size)).filter(PersonalDocument.patient_id == patient_id).scalar() or 0
    if current_usage + file_size > STORAGE_LIMIT_BYTES:
        raise HTTPException(
            status_code=400,
            detail="The 2 GB personal storage limit would be exceeded."
        )

    # Save file locally & Supabase
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"personal_{patient_id}_{int(datetime.utcnow().timestamp())}{file_ext}"
    from app.services.storage import save_uploaded_file
    save_uploaded_file(safe_filename, file_bytes, file.content_type)

    # Save to database
    new_doc = PersonalDocument(
        patient_id=patient_id,
        file_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        file_path=f"uploads/{safe_filename}"
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    return {
        "message": "Personal document uploaded successfully",
        "document": {
            "id": new_doc.id,
            "file_name": new_doc.file_name,
            "file_type": new_doc.file_type,
            "file_size": new_doc.file_size,
            "file_path": new_doc.file_path,
            "created_at": new_doc.created_at.isoformat()
        }
    }

@router.delete("/{document_id}")
def delete_personal_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(PersonalDocument).filter(PersonalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete local file & Supabase
    if doc.file_path:
        from app.services.storage import delete_uploaded_file
        delete_uploaded_file(doc.file_path)

    db.delete(doc)
    db.commit()

    return {"message": "Document deleted successfully"}
