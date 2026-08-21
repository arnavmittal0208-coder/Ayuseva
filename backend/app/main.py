import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base
from app import models  # Force registration of models
from app.routers import records, patients, claims

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
