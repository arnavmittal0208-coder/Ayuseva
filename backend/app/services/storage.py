import os
import requests
from app.config import settings

def save_uploaded_file(filename: str, file_bytes: bytes, content_type: str) -> str:
    """
    Saves the file locally (for fallback/test runs) and uploads to the Supabase 
    Storage bucket 'ayuseva-documents' if configured.
    Returns the database reference path 'uploads/{filename}'.
    """
    # 1. Save locally for tests & dev fallback
    local_path = os.path.join("uploads", filename)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, "wb") as f:
        f.write(file_bytes)
        
    # 2. Upload to Supabase Storage
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        # Standard Supabase Storage REST URL: /storage/v1/object/{bucket}/{filename}
        # Replace backslashes with forward slashes for S3/Supabase compatibility
        storage_path = filename.replace("\\", "/")
        url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/ayuseva-documents/{storage_path}"
        headers = {
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": content_type
        }
        try:
            res = requests.post(url, headers=headers, data=file_bytes)
            if res.status_code not in (200, 201):
                print(f"[STORAGE WARNING] Supabase upload failed: {res.text} (Status Code: {res.status_code})")
        except Exception as e:
            print(f"[STORAGE WARNING] Supabase connection error: {e}")
            
    # Normalize to forward slashes for database reference consistency
    db_path = f"uploads/{filename}".replace("\\", "/")
    return db_path

def delete_uploaded_file(file_path: str):
    """
    Deletes the file locally and removes it from the Supabase Storage bucket if configured.
    """
    if not file_path:
        return
        
    # Get the storage-relative filename by removing 'uploads/' prefix if present
    filename = file_path
    if file_path.startswith("uploads/"):
        filename = file_path[len("uploads/"):]
    elif file_path.startswith("./uploads/"):
        filename = file_path[len("./uploads/"):]
        
    # 1. Delete locally
    local_path = os.path.join("uploads", filename)
    if os.path.exists(local_path):
        try:
            os.remove(local_path)
        except Exception:
            pass
            
    # 2. Delete from Supabase Storage
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        storage_path = filename.replace("\\", "/")
        url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/ayuseva-documents"
        headers = {
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        try:
            res = requests.delete(url, headers=headers, json={"prefixes": [storage_path]})
            if res.status_code != 200:
                print(f"[STORAGE WARNING] Supabase deletion failed: {res.text} (Status Code: {res.status_code})")
        except Exception as e:
            print(f"[STORAGE WARNING] Supabase connection error: {e}")
