from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


MIME_LIMITS = {
    "image/jpeg": 25 * 1024 * 1024,
    "image/png": 25 * 1024 * 1024,
    "image/webp": 25 * 1024 * 1024,
    "image/tiff": 25 * 1024 * 1024,
    "video/mp4": 500 * 1024 * 1024,
    "video/quicktime": 500 * 1024 * 1024,
    "video/webm": 500 * 1024 * 1024,
    "video/x-matroska": 500 * 1024 * 1024,
    "audio/mpeg": 100 * 1024 * 1024,
    "audio/wav": 100 * 1024 * 1024,
    "audio/x-wav": 100 * 1024 * 1024,
    "audio/mp4": 100 * 1024 * 1024,
    "audio/ogg": 100 * 1024 * 1024,
    "audio/flac": 100 * 1024 * 1024,
    "application/pdf": 50 * 1024 * 1024,
    "text/plain": 5 * 1024 * 1024,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 50 * 1024 * 1024,
}


class UploadInvestigationCreate(BaseModel):
    submitted_type: Literal["image", "video", "audio", "document"]
    title: str | None = Field(default=None, max_length=240)
    language: Literal["en", "te", "hi", "auto"] = "auto"


class UploadMetadata(BaseModel):
    storage_path: str = Field(min_length=1, max_length=512)
    original_filename: str = Field(min_length=1, max_length=255)
    mime_type: str
    size_bytes: int = Field(gt=0, le=524288000)

    @field_validator("original_filename")
    @classmethod
    def sanitize_filename(cls, value: str) -> str:
        value = value.replace("\\", "/").split("/")[-1].strip()
        if not value or value in {".", ".."}:
            raise ValueError("Invalid filename.")
        return value

    @field_validator("mime_type")
    @classmethod
    def supported_mime(cls, value: str) -> str:
        if value not in MIME_LIMITS:
            raise ValueError("Unsupported file type.")
        return value

    @field_validator("size_bytes")
    @classmethod
    def supported_size(cls, value: int, info) -> int:
        mime = info.data.get("mime_type")
        if mime in MIME_LIMITS and value > MIME_LIMITS[mime]:
            raise ValueError("File exceeds the size limit for this media type.")
        return value


class UploadedFileRecord(BaseModel):
    id: UUID
    investigation_id: UUID
    original_filename: str
    mime_type: str
    size_bytes: int
