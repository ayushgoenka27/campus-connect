from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"

    environment: str = "development"

    cors_origins: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ]

    rate_limit_enabled: bool = True
    rate_limit_auth_per_minute: int = 15
    rate_limit_default_per_minute: int = 60

    trusted_proxies: Union[List[str], str] = ["127.0.0.1", "::1"]
    allowed_email_domains: Union[List[str], str] = []

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        extra="ignore",
    )

    @field_validator("cors_origins", "trusted_proxies", "allowed_email_domains", mode="before")
    @classmethod
    def parse_comma_separated_list(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    @model_validator(mode="after")
    def validate_cors_safety(self):
        # Validate that wildcard '*' is not combined with credentials
        if isinstance(self.cors_origins, list) and "*" in self.cors_origins and len(self.cors_origins) == 1:
            raise ValueError(
                "Insecure CORS configuration: Wildcard '*' cannot be used when credentials are supported. "
                "Specify explicit origin URLs."
            )
        return self


settings = Settings()
