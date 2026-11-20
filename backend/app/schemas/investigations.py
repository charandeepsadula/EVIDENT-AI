from typing import Literal
from uuid import UUID

import ipaddress
from urllib.parse import parse_qsl, urlsplit

from pydantic import BaseModel, Field, HttpUrl, TypeAdapter, model_validator


class InvestigationCreate(BaseModel):
    submitted_type: Literal["text", "url"]
    content: str = Field(min_length=1, max_length=20000)
    title: str | None = Field(default=None, max_length=240)
    language: Literal["en", "te", "hi", "auto"] = "auto"

    @model_validator(mode="after")
    def validate_content(self):
        self.content = self.content.strip()
        if not self.content:
            raise ValueError("Content cannot be empty.")
        if self.submitted_type == "url":
            if len(self.content) > 2048:
                raise ValueError("URL exceeds the 2048 character limit.")
            parsed = TypeAdapter(HttpUrl).validate_python(self.content)
            host = (urlsplit(str(parsed)).hostname or "").lower().rstrip(".")
            if host in {"localhost", "localhost.localdomain"} or host.endswith((".local", ".internal", ".localhost")):
                raise ValueError("Private and local URLs cannot be investigated.")
            try:
                address = ipaddress.ip_address(host)
                if not address.is_global:
                    raise ValueError("Private and local URLs cannot be investigated.")
            except ValueError as exc:
                if "Private and local" in str(exc):
                    raise
            if any(any(term in key.lower() for term in ("token", "secret", "key", "auth", "signature", "session")) for key, _ in parse_qsl(urlsplit(self.content).query, keep_blank_values=True)):
                raise ValueError("Remove credentials or secret query parameters from the URL before submitting it.")
        return self


class InvestigationRecord(BaseModel):
    id: UUID
    owner_id: UUID
    submitted_type: str
    status: str
    progress: int = 0
    current_stage: str | None = None
