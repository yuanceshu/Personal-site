from dataclasses import dataclass
import os
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    token: str
    base_url: str
    api_key: str
    model: str
    model_timeout: float = 30

    @classmethod
    def from_env(cls):
        return cls(
            os.getenv("EXPERIMENT_AGENT_TOKEN", ""),
            os.getenv("LLM_BASE_URL", ""),
            os.getenv("LLM_API_KEY", ""),
            os.getenv("LLM_MODEL", ""),
            min(45, max(1, float(os.getenv("LLM_TIMEOUT_SECONDS", "30")))),
        )

    @property
    def configured(self):
        return bool(self.token and self.base_url and self.api_key and self.model)
