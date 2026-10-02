import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    app_name = os.getenv("APP_NAME", "ResumeLens")
    database_url = os.getenv("DATABASE_URL", "sqlite:///./resumelens.db")
    cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    max_upload_mb = int(os.getenv("MAX_UPLOAD_MB", "5"))
    embedding_model = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    # Set LOG_FILE to an empty string to log to the console only.
    log_file = os.getenv("LOG_FILE", "logs/app.log")


settings = Settings()
