from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON, Boolean
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
    insurance_policies = relationship("InsurancePolicy", back_populates="patient", cascade="all, delete-orphan")
    personal_documents = relationship("PersonalDocument", back_populates="patient", cascade="all, delete-orphan")
    scheduled_checkups = relationship("ScheduledCheckup", back_populates="patient", cascade="all, delete-orphan")

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


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    insurer = Column(String, nullable=True)
    policy_number = Column(String, nullable=True)
    policyholder_name = Column(String, nullable=True)
    patient_name = Column(String, nullable=True)
    member_id = Column(String, nullable=True)
    policy_type = Column(String, nullable=True)
    start_date = Column(String, nullable=True) # Normalized string, e.g. YYYY-MM-DD
    end_date = Column(String, nullable=True) # Normalized string, e.g. YYYY-MM-DD
    sum_insured = Column(Float, nullable=True)
    premium = Column(Float, nullable=True)
    preventive_eligible = Column(JSON, nullable=True) # e.g. Boolean or null
    checkups_per_year = Column(Integer, nullable=True)
    benefits_coverage = Column(JSON, nullable=True) # Array of strings
    conditions_limitations = Column(JSON, nullable=True) # Array of strings
    file_path = Column(String, nullable=True)
    insurer_email = Column(String, nullable=True)
    status = Column(String, default="Active") # Active, Expired, Archived
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="insurance_policies")
    scheduled_checkups = relationship("ScheduledCheckup", back_populates="insurance_policy", cascade="all, delete-orphan")

class PersonalDocument(Base):
    __tablename__ = "personal_documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String, nullable=False)
    file_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=False) # In bytes
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="personal_documents")

class ScheduledCheckup(Base):
    __tablename__ = "scheduled_checkups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    policy_id = Column(Integer, ForeignKey("insurance_policies.id", ondelete="CASCADE"), nullable=False)
    checkup_number = Column(Integer, nullable=False)  # Slot index (e.g. 1, 2, 3...)
    scheduled_date = Column(String, nullable=False)  # YYYY-MM-DD
    notification_date = Column(String, nullable=False)  # YYYY-MM-DD (scheduled_date - 2 days)
    notification_status = Column(String, default="Scheduled")  # Scheduled, Sent
    notification_sent_at = Column(DateTime, nullable=True)
    is_locked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="scheduled_checkups")
    insurance_policy = relationship("InsurancePolicy", back_populates="scheduled_checkups")

