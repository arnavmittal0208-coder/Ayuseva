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
    clinical_contexts = relationship("ClinicalContext", back_populates="patient", cascade="all, delete-orphan")
    visit_intakes = relationship("VisitIntake", back_populates="patient", cascade="all, delete-orphan")
    referrals = relationship("Referral", back_populates="patient", cascade="all, delete-orphan")

class Record(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    record_type = Column(String, nullable=False) # Prescription, Lab Report, Discharge Summary
    date = Column(String, nullable=True) # Date parsed from report/prescription
    file_path = Column(String, nullable=True) # Path to stored PDF/Image file
    parsed_json = Column(JSON, nullable=True) # Extracted clinical data (conditions, meds, lab values)
    created_at = Column(DateTime, default=datetime.utcnow)
    clinical_context_id = Column(Integer, ForeignKey("clinical_contexts.id", ondelete="SET NULL"), nullable=True)

    # Relationship
    patient = relationship("Patient", back_populates="records")
    clinical_context = relationship("ClinicalContext", back_populates="records")

class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    procedure_name = Column(String, nullable=False) # e.g., Knee Replacement
    estimated_cost = Column(Float, nullable=True)
    status = Column(String, default="Draft") # Draft, Submitted, Approved, Rejected
    missing_documents = Column(JSON, nullable=True) # Array of missing files/requirements
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Cashless claim additions
    policy_id = Column(Integer, ForeignKey("insurance_policies.id", ondelete="CASCADE"), nullable=True)
    clinical_context = Column(String, nullable=True)
    selected_records = Column(JSON, nullable=True) # Array of record IDs (e.g. [1, 2, 5])
    policy_check_status = Column(String, nullable=True) # e.g. Appears Eligible, Needs Review
    policy_check_details = Column(JSON, nullable=True) # JSON object containing coverage details & exclusions
    missing_info = Column(JSON, nullable=True) # Array of strings indicating missing details/docs
    generated_form_data = Column(JSON, nullable=True) # JSON object containing form fields
    email_preview = Column(JSON, nullable=True) # JSON object containing recipient, subject, body
    insurer_response = Column(String, nullable=True) # Simulated insurer comments/reasons
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    clinical_context_id = Column(Integer, ForeignKey("clinical_contexts.id", ondelete="SET NULL"), nullable=True)
    supporting_documents = Column(JSON, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="claims")
    clinical_context_rel = relationship("ClinicalContext", back_populates="claims")


class ClinicalContext(Base):
    __tablename__ = "clinical_contexts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    kind = Column(String, default="chronic_ongoing") # chronic_ongoing, acute_active, acute_resolved
    first_date = Column(String, nullable=True)
    latest_date = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="clinical_contexts")
    records = relationship("Record", back_populates="clinical_context")
    claims = relationship("Claim", back_populates="clinical_context_rel")


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


class VisitIntake(Base):
    __tablename__ = "visit_intakes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    visit_datetime = Column(DateTime, default=datetime.utcnow, nullable=False)
    patient_language = Column(String, default="en-IN") # e.g. "hi-IN", "kn-IN", "pa-IN", "en-IN"
    raw_narration = Column(String, nullable=True) # Verbatim native speech transcript
    translated_narration = Column(String, nullable=True) # Clear, non-hallucinatory clinical English
    chief_complaints = Column(JSON, nullable=True) # Array of strings e.g. ["Severe headache", "Dizziness"]
    symptom_duration = Column(String, nullable=True) # e.g. "3 days"
    severity = Column(String, nullable=True) # e.g. "Mild", "Moderate", "Severe"
    recent_changes = Column(String, nullable=True) # e.g. "Missed morning blood pressure tablet"
    additional_notes = Column(String, nullable=True) # Specific notes patient wants doctor to know
    structured_data = Column(JSON, nullable=True) # Full AI payload including adaptive followups
    triage_priority = Column(String, default="routine") # "routine" or "priority_red_flag"
    triage_flags = Column(JSON, nullable=True) # Array of triggered acute red-flag descriptions
    source = Column(String, default="patient_app") # "patient_app" or "medikiosk"
    verification_status = Column(String, default="Pending Doctor Review") # "Pending Doctor Review" or "Reviewed"
    doctor_notes = Column(String, nullable=True) # Doctor's verification / clinical notes
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="visit_intakes")


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    clinical_context_id = Column(Integer, ForeignKey("clinical_contexts.id", ondelete="SET NULL"), nullable=True)
    clinical_context_name = Column(String, nullable=False)
    referring_hospital = Column(String, default="AyuSeva Network Hospital", nullable=False)
    receiving_hospital = Column(String, nullable=False)
    receiving_department = Column(String, nullable=True)
    receiving_doctor = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    referral_reason = Column(String, nullable=False)
    urgency = Column(String, default="Emergency", nullable=False)  # Emergency, Urgent, Routine
    status = Column(String, default="Prepared", nullable=False)   # Draft, Prepared, Shared
    include_current_situation = Column(Boolean, default=True)
    selected_record_ids = Column(JSON, nullable=True)  # List of integer record IDs
    package_data = Column(JSON, nullable=True)        # Structured handoff snapshot data
    created_at = Column(DateTime, default=datetime.utcnow)
    shared_at = Column(DateTime, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="referrals")
    clinical_context = relationship("ClinicalContext")

