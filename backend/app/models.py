from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, index=True) # e.g., CARE-928104
    name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    dob = Column(String, nullable=True)
    policy_details = Column(JSON, nullable=True) # Insurer, Policy Name, Free test count, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    records = relationship("Record", back_populates="patient", cascade="all, delete-orphan")
    claims = relationship("Claim", back_populates="patient", cascade="all, delete-orphan")

class Record(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    record_type = Column(String, nullable=False) # Prescription, Lab Report, Discharge Summary
    date = Column(String, nullable=True) # Date parsed from report/prescription
    file_path = Column(String, nullable=True) # Path to stored PDF/Image file
    parsed_json = Column(JSON, nullable=True) # Extracted clinical data (conditions, meds, lab values)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    patient = relationship("Patient", back_populates="records")

class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    procedure_name = Column(String, nullable=False) # e.g., Knee Replacement
    estimated_cost = Column(Float, nullable=True)
    status = Column(String, default="Draft") # Draft, Submitted, Approved, Rejected
    missing_documents = Column(JSON, nullable=True) # Array of missing files/requirements
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    patient = relationship("Patient", back_populates="claims")


class ClinicalBrief(Base):
    __tablename__ = "clinical_briefs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    summary_type = Column(String, nullable=False)
    specialty = Column(String, nullable=False)
    disease_focus = Column(String, nullable=True)
    current_visit_reason = Column(String, nullable=True)
    records_hash = Column(String, nullable=False)
    brief_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    patient = relationship("Patient")
