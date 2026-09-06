from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./health_platform.db"
    GEMINI_API_KEY: str = ""
    RESEND_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""
    SARVAM_API_KEY: str = ""
    VOICE_PROVIDER: str = "sarvam"
    MOCK_EMAIL: bool = False
    PORT: int = 8000
    FRONTEND_URL: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    
    # Allow loading from a .env file in the backend folder or root
    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")

settings = Settings()
