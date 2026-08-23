from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./health_platform.db"
    GEMINI_API_KEY: str = ""
    RESEND_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""
    MOCK_EMAIL: bool = False
    PORT: int = 8000
    
    # Allow loading from a .env file in the backend folder
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
