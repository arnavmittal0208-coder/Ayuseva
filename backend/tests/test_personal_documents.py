import io
import os
import asyncio
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import Patient, PersonalDocument
from app.routers.personal_documents import get_personal_documents, upload_personal_document, delete_personal_document
from fastapi import UploadFile
from starlette.datastructures import Headers

class MockUploadFile(UploadFile):
    def __init__(self, filename, content_type, file):
        headers = Headers({"content-type": content_type})
        super().__init__(file=file, filename=filename, headers=headers)

async def run_personal_documents_flow_db():
    # Setup test database tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Create a test patient
    patient_id = "CARE-TEST99"
    existing = db.query(Patient).filter(Patient.id == patient_id).first()
    if not existing:
        patient = Patient(id=patient_id, name="Test Document Patient")
        db.add(patient)
        db.commit()

    # 1. Fetch personal documents list (should be empty)
    res = get_personal_documents(patient_id=patient_id, db=db)
    assert len(res["documents"]) == 0
    assert res["total_usage_bytes"] == 0

    # 2. Upload a test document
    file_content = b"This is a dummy patient personal record content."
    file_name = "my_personal_record.txt"
    mock_file = MockUploadFile(filename=file_name, content_type="text/plain", file=io.BytesIO(file_content))
    
    upload_res = await upload_personal_document(file=mock_file, patient_id=patient_id, db=db)
    assert upload_res["message"] == "Personal document uploaded successfully"
    doc_id = upload_res["document"]["id"]
    assert upload_res["document"]["file_name"] == file_name
    assert upload_res["document"]["file_size"] == len(file_content)
    
    # Check that file exists on disk
    file_path = upload_res["document"]["file_path"]
    full_path = os.path.join(".", file_path)
    assert os.path.exists(full_path)

    # 3. Fetch documents list again (should have 1 item)
    res = get_personal_documents(patient_id=patient_id, db=db)
    assert len(res["documents"]) == 1
    assert res["documents"][0]["id"] == doc_id
    assert res["total_usage_bytes"] == len(file_content)

    # 4. Delete personal document
    delete_res = delete_personal_document(document_id=doc_id, db=db)
    assert delete_res["message"] == "Document deleted successfully"
    assert not os.path.exists(full_path)

    # 5. Fetch documents list after deletion (should be empty again)
    res = get_personal_documents(patient_id=patient_id, db=db)
    assert len(res["documents"]) == 0
    assert res["total_usage_bytes"] == 0

    db.close()

def test_personal_documents_flow():
    asyncio.run(run_personal_documents_flow_db())
