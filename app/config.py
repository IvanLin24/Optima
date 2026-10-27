from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "development"
    database_url: str = "sqlite:///./local.db"
    public_api_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    mail_mode: str = "file"
    mail_dir: str = "var/mail"
    mail_from: str = "noreply@example.test"
    resend_api_key: SecretStr = SecretStr("")
    otp_secret: SecretStr = SecretStr("development-only-change-before-hosting")
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    enable_demo: bool = False
    access_token_minutes: int = 60
    max_upload_bytes: int = 5 * 1024 * 1024

    def validate_runtime(self):
        if self.mail_mode not in {"file", "smtp", "resend"}:
            raise ValueError("MAIL_MODE must be file, smtp or resend")
        if self.mail_mode == "resend" and not self.resend_api_key.get_secret_value():
            raise ValueError("RESEND_API_KEY required")
        if self.app_env != "development" and self.otp_secret.get_secret_value().startswith("development-"):
            raise ValueError("Set a random OTP_SECRET for the hosted environment")
        if self.mail_mode == "smtp" and not self.smtp_host:
            raise ValueError("SMTP_HOST required")
        if self.app_env == "production":
            if not self.database_url.startswith("postgresql"):
                raise ValueError("Production requires PostgreSQL")
            if self.mail_mode not in {"smtp", "resend"} or (self.mail_mode == "smtp" and not self.smtp_starttls):
                raise ValueError("Production requires SMTP with TLS")
            if not self.public_api_url.startswith("https://") or not self.frontend_url.startswith("https://"):
                raise ValueError("Production requires HTTPS URLs")
            if self.enable_demo:
                raise ValueError("Disable demo for production")


@lru_cache
def settings():
    return Settings()
