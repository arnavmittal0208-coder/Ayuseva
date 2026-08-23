import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base
from app import models  # Force registration of models
from app.routers import records, patients, claims, insurance, personal_documents

# Auto-create database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AyuSeva API",
    description="Backend API for the AyuSeva Longitudinal Health & Care Orchestration Platform",
    version="1.0.0"
)

# Mount uploads static files directory
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Register routers
app.include_router(records.router)
app.include_router(patients.router)
app.include_router(claims.router)
app.include_router(insurance.router)
app.include_router(personal_documents.router)

import asyncio
from app.database import SessionLocal
from app.routers.insurance import periodic_checkup_notification_worker

from sqlalchemy import text

def check_and_add_columns():
    db = SessionLocal()
    try:
        db.execute(text("SELECT insurer_email FROM insurance_policies LIMIT 1"))
    except Exception:
        try:
            db.execute(text("ALTER TABLE insurance_policies ADD COLUMN insurer_email VARCHAR"))
            db.commit()
            print("[DB UPDATE] Successfully added insurer_email column to insurance_policies.")
        except Exception as alter_err:
            print(f"[DB UPDATE ERROR] Failed to add insurer_email column: {str(alter_err)}")
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    check_and_add_columns()
    asyncio.create_task(periodic_checkup_notification_worker())

# CORS middleware configuration to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
