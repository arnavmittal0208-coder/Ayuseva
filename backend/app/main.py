import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base
from app import models  # Force registration of models
from app.routers import records, patients, claims, insurance, personal_documents, visit_intakes, referrals

# Auto-create database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AyuSeva API",
    description="Backend API for the AyuSeva Longitudinal Health & Care Orchestration Platform",
    version="1.0.0"
)

# Create local uploads folder
os.makedirs("uploads", exist_ok=True)

from fastapi.responses import RedirectResponse, FileResponse
from fastapi import HTTPException

@app.get("/uploads/{filename}")
def serve_uploads_file(filename: str):
    """
    Serves files by redirecting to Supabase Storage if configured, 
    otherwise falls back to serving from the local disk directory.
    """
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        public_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/ayuseva-documents/{filename}"
        return RedirectResponse(url=public_url)
        
    local_path = os.path.join("uploads", filename)
    if os.path.exists(local_path):
        return FileResponse(local_path)
    raise HTTPException(status_code=404, detail="File not found")

# Register routers
app.include_router(records.router)
app.include_router(patients.router)
app.include_router(claims.router)
app.include_router(insurance.router)
app.include_router(personal_documents.router)
app.include_router(visit_intakes.router)
app.include_router(referrals.router)

import asyncio
from app.database import SessionLocal
from app.routers.insurance import periodic_checkup_notification_worker

from sqlalchemy import text

def check_and_add_columns():
    db = SessionLocal()
    # Check insurance_policies column
    try:
        db.execute(text("SELECT insurer_email FROM insurance_policies LIMIT 1"))
    except Exception:
        try:
            db.execute(text("ALTER TABLE insurance_policies ADD COLUMN insurer_email VARCHAR"))
            db.commit()
            print("[DB UPDATE] Successfully added insurer_email column to insurance_policies.")
        except Exception as alter_err:
            print(f"[DB UPDATE ERROR] Failed to add insurer_email column: {str(alter_err)}")

    # Check claims columns
    claims_cols = [
        ("policy_id", "INTEGER"),
        ("clinical_context", "VARCHAR"),
        ("selected_records", "JSON"),
        ("policy_check_status", "VARCHAR"),
        ("policy_check_details", "JSON"),
        ("missing_info", "JSON"),
        ("generated_form_data", "JSON"),
        ("email_preview", "JSON"),
        ("insurer_response", "VARCHAR"),
        ("updated_at", "DATETIME"),
        ("supporting_documents", "JSON")
    ]
    for col_name, col_type in claims_cols:
        try:
            db.execute(text(f"SELECT {col_name} FROM claims LIMIT 1"))
        except Exception:
            try:
                db.execute(text(f"ALTER TABLE claims ADD COLUMN {col_name} {col_type}"))
                db.commit()
                print(f"[DB UPDATE] Successfully added {col_name} column to claims.")
            except Exception as alter_err:
                print(f"[DB UPDATE ERROR] Failed to add {col_name} column to claims: {str(alter_err)}")

    # Add clinical_context_id to records and claims tables
    try:
        db.execute(text("SELECT clinical_context_id FROM records LIMIT 1"))
    except Exception:
        try:
            db.execute(text("ALTER TABLE records ADD COLUMN clinical_context_id INTEGER"))
            db.commit()
            print("[DB UPDATE] Successfully added clinical_context_id to records.")
        except Exception as alter_err:
            print(f"[DB UPDATE ERROR] Failed to add clinical_context_id to records: {alter_err}")

    try:
        db.execute(text("SELECT clinical_context_id FROM claims LIMIT 1"))
    except Exception:
        try:
            db.execute(text("ALTER TABLE claims ADD COLUMN clinical_context_id INTEGER"))
            db.commit()
            print("[DB UPDATE] Successfully added clinical_context_id to claims.")
        except Exception as alter_err:
            print(f"[DB UPDATE ERROR] Failed to add clinical_context_id to claims: {alter_err}")
    db.close()

def run_one_time_consolidation():
    db = SessionLocal()
    try:
        # Ensure migration table exists
        db.execute(text("CREATE TABLE IF NOT EXISTS migration_meta (version VARCHAR PRIMARY KEY)"))
        db.commit()
        
        # 1. Check if version 2 has run
        res = db.execute(text("SELECT version FROM migration_meta WHERE version = 'clinical_context_v2'")).fetchone()
        if not res:
            print("[MIGRATION] Launching EMR Clinical Context Consolidation v2...")
            from app.models import Patient, Record, Claim, ClinicalContext
            from app.services.claims_ai import consolidate_existing_patient_records_ai

            patients = db.query(Patient).all()
            for patient in patients:
                # Fetch all records excluding policies
                records = db.query(Record).filter(
                    Record.patient_id == patient.id,
                    Record.record_type != "INSURANCE_POLICY"
                ).all()
                
                if not records:
                    continue
                    
                # Call AI to cluster
                patient_demo = {"id": patient.id, "name": patient.name}
                records_data = [
                    {"id": r.id, "record_type": r.record_type, "parsed_json": r.parsed_json}
                    for r in records
                ]
                
                try:
                    clustering = consolidate_existing_patient_records_ai(patient_demo, records_data)
                except Exception as e:
                    print(f"[MIGRATION ERROR] AI clustering failed for patient {patient.id}: {e}")
                    clustering = {"contexts": [{"name": "General Clinical Context", "kind": "acute_active", "reason": "AI failed", "record_ids": [r.id for r in records]}]}
                    
                # Create ClinicalContexts and link records
                for ctx_item in clustering.get("contexts", []):
                    name = ctx_item.get("name") or "Medical Episode"
                    kind = ctx_item.get("kind") or "acute_active"
                    reason = ctx_item.get("reason") or ""
                    r_ids = ctx_item.get("record_ids") or []
                    
                    if not r_ids:
                        continue
                        
                    matched_records = [r for r in records if r.id in r_ids]
                    if not matched_records:
                        continue
                        
                    dates = [r.date for r in matched_records if r.date]
                    first_date = min(dates) if dates else None
                    latest_date = max(dates) if dates else None
                    
                    # Check if context already created under patient
                    db_ctx = db.query(ClinicalContext).filter(
                        ClinicalContext.patient_id == patient.id,
                        ClinicalContext.name == name
                    ).first()
                    
                    if not db_ctx:
                        db_ctx = ClinicalContext(
                            patient_id=patient.id,
                            name=name,
                            kind=kind,
                            first_date=first_date,
                            latest_date=latest_date,
                            reason=reason
                        )
                        db.add(db_ctx)
                        db.commit()
                        db.refresh(db_ctx)
                    
                    # Link records
                    for r in matched_records:
                        r.clinical_context_id = db_ctx.id
                    db.commit()
                    
                    # Map matching claims
                    claims = db.query(Claim).filter(
                        Claim.patient_id == patient.id,
                        (Claim.clinical_context_id == None),
                        (Claim.clinical_context == name) | (Claim.procedure_name.like(f"%{name}%"))
                    ).all()
                    
                    for claim in claims:
                        claim.clinical_context_id = db_ctx.id
                        claim.clinical_context = db_ctx.name
                    db.commit()
                    
                # Group and deduplicate claims for this patient under active policy + context
                from collections import defaultdict
                grouped_claims = defaultdict(list)
                all_claims = db.query(Claim).filter(Claim.patient_id == patient.id).all()
                for c in all_claims:
                    if c.clinical_context_id:
                        key = (c.policy_id, c.clinical_context_id)
                        grouped_claims[key].append(c)
                        
                for key, claims_list in grouped_claims.items():
                    if len(claims_list) > 1:
                        print(f"[MIGRATION] Consolidating {len(claims_list)} duplicate claims for patient {patient.id}, context {key[1]}")
                        sorted_claims = sorted(
                            claims_list, 
                            key=lambda c: (0 if c.status != "Draft" else 1, -c.id)
                        )
                        keep_claim = sorted_claims[0]
                        delete_claims = sorted_claims[1:]
                        
                        merged_selected = set(keep_claim.selected_records or [])
                        for dc in delete_claims:
                            merged_selected.update(dc.selected_records or [])
                        keep_claim.selected_records = list(merged_selected)
                        
                        merged_missing_info = set(keep_claim.missing_info or [])
                        for dc in delete_claims:
                            merged_missing_info.update(dc.missing_info or [])
                        keep_claim.missing_info = list(merged_missing_info)
                        
                        db.commit()
                        for dc in delete_claims:
                            db.delete(dc)
                        db.commit()

            # Mark migration v2 as complete
            db.execute(text("INSERT INTO migration_meta (version) VALUES ('clinical_context_v2')"))
            db.commit()
            print("[MIGRATION] EMR Clinical Context Consolidation v2 successfully completed.")

        # 2. Check if version 3 has run
        res_v3 = db.execute(text("SELECT version FROM migration_meta WHERE version = 'clinical_context_v3'")).fetchone()
        if not res_v3:
            print("[MIGRATION] Launching Clinical Context Hierarchy & Consolidation (v3)...")
            from app.models import Patient, Record, Claim, ClinicalContext
            from app.services.claims_ai import simplify_clinical_name, extract_meaningful_condition_name
            
            patients = db.query(Patient).all()
            for patient in patients:
                # Get all contexts for this patient
                contexts = db.query(ClinicalContext).filter(ClinicalContext.patient_id == patient.id).all()
                if not contexts:
                    continue
                
                # Group context IDs by their resolved condition name (case-insensitive)
                ctx_to_condition = {}
                for ctx in contexts:
                    names = []
                    for r in ctx.records:
                        p_json = r.parsed_json or {}
                        n = extract_meaningful_condition_name(p_json or {"record_type": r.record_type})
                        if n and n != "Medical Episode":
                            names.append(n)
                    
                    if not names:
                        simplified_ctx_name = simplify_clinical_name(ctx.name)
                        ctx_to_condition[ctx.id] = simplified_ctx_name
                    else:
                        simplified_names = [simplify_clinical_name(x) for x in names if simplify_clinical_name(x) != "Medical Episode"]
                        if simplified_names:
                            ctx_to_condition[ctx.id] = simplified_names[0]
                        else:
                            ctx_to_condition[ctx.id] = simplify_clinical_name(ctx.name)
                            
                from collections import defaultdict
                groups = defaultdict(list)
                for ctx_id, cond in ctx_to_condition.items():
                    groups[cond.lower()].append((ctx_id, cond))
                    
                for cond_lower, ctx_info in groups.items():
                    # If single context, just rename to simplified broader name
                    if len(ctx_info) == 1:
                        ctx_id, cond_name = ctx_info[0]
                        db_ctx = db.query(ClinicalContext).filter(ClinicalContext.id == ctx_id).first()
                        if db_ctx and db_ctx.name != cond_name:
                            print(f"[MIGRATION v3] Renaming context ID {ctx_id} to broader name '{cond_name}'")
                            db_ctx.name = cond_name
                            db.commit()
                        continue
                        
                    # If multiple contexts share the same broader condition, merge them!
                    db_contexts = []
                    for ctx_id, cond_name in ctx_info:
                        ctx_obj = db.query(ClinicalContext).filter(ClinicalContext.id == ctx_id).first()
                        if ctx_obj:
                            db_contexts.append(ctx_obj)
                            
                    if not db_contexts:
                        continue
                        
                    # Sort to find survivor: prefer one with claims, then one with more records, then smaller ID
                    db_contexts.sort(key=lambda c: (
                        0 if len(c.claims) > 0 else 1,
                        -len(c.records),
                        c.id
                    ))
                    survivor = db_contexts[0]
                    duplicates = db_contexts[1:]
                    
                    survivor_name = ctx_info[0][1]
                    print(f"[MIGRATION v3] Patient {patient.id}: Consolidating duplicate contexts {[c.id for c in duplicates]} into survivor context {survivor.id} ('{survivor_name}')")
                    
                    survivor.name = survivor_name
                    db.commit()
                    
                    for dup in duplicates:
                        for r in list(dup.records):
                            r.clinical_context_id = survivor.id
                        db.commit()
                        
                    for dup in duplicates:
                        for c in list(dup.claims):
                            c.clinical_context_id = survivor.id
                            c.clinical_context = survivor_name
                        db.commit()
                        
                    for dup in duplicates:
                        db.delete(dup)
                    db.commit()
                    
            # Group and deduplicate claims for all patients under active policy + context
            from collections import defaultdict
            grouped_claims = defaultdict(list)
            all_claims = db.query(Claim).all()
            for c in all_claims:
                if c.clinical_context_id:
                    key = (c.policy_id, c.clinical_context_id)
                    grouped_claims[key].append(c)
                    
            for key, claims_list in grouped_claims.items():
                if len(claims_list) > 1:
                    print(f"[MIGRATION v3] Consolidating {len(claims_list)} duplicate claims under policy {key[0]} and context {key[1]}")
                    sorted_claims = sorted(
                        claims_list, 
                        key=lambda c: (0 if c.status != "Draft" else 1, -c.id)
                    )
                    keep_claim = sorted_claims[0]
                    delete_claims = sorted_claims[1:]
                    
                    merged_selected = set(keep_claim.selected_records or [])
                    for dc in delete_claims:
                        merged_selected.update(dc.selected_records or [])
                    keep_claim.selected_records = list(merged_selected)
                    
                    merged_missing_info = set(keep_claim.missing_info or [])
                    for dc in delete_claims:
                        merged_missing_info.update(dc.missing_info or [])
                    keep_claim.missing_info = list(merged_missing_info)
                    
                    db.commit()
                    for dc in delete_claims:
                        db.delete(dc)
                    db.commit()
                    
            # Mark migration v3 as complete
            db.execute(text("INSERT INTO migration_meta (version) VALUES ('clinical_context_v3')"))
            db.commit()
            print("[MIGRATION v3] Clinical Context Hierarchy & Consolidation successfully completed.")
    except Exception as e:
        print(f"[MIGRATION ERROR] Consolidation failed: {e}")
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    check_and_add_columns()
    run_one_time_consolidation()
    asyncio.create_task(periodic_checkup_notification_worker())

# CORS middleware configuration to allow frontend requests
allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
if settings.FRONTEND_URL:
    allowed_origins.append(settings.FRONTEND_URL)
else:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    db_type = "PostgreSQL" if "postgresql" in settings.DATABASE_URL else "SQLite"
    return {
        "status": "healthy",
        "database": db_type,
        "api_keys_loaded": {
            "gemini": bool(settings.GEMINI_API_KEY),
            "resend": bool(settings.RESEND_API_KEY)
        }
    }
