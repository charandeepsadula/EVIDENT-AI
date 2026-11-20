from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api.v1 import investigations
from app.core.config import settings
from app.forensics.processors import analyze_image
from app.main import app


def image_bytes(format_name: str, *, exif: Image.Exif | None = None) -> bytes:
    buffer = BytesIO()
    options = {"exif": exif} if exif is not None else {}
    Image.new("RGB", (24, 16), color=(40, 120, 180)).save(buffer, format=format_name, **options)
    return buffer.getvalue()


@pytest.mark.parametrize("format_name", ["JPEG", "PNG", "WEBP", "TIFF"])
def test_image_processor_reports_decoded_format_and_dimensions(tmp_path, format_name):
    path = tmp_path / f"fixture.{format_name.lower()}"
    path.write_bytes(image_bytes(format_name))

    result = analyze_image(path)

    assert result["metadata"] == {"width": 24, "height": 16, "format": format_name}
    assert any(item["indicator"] == "exif_metadata" for item in result["findings"])


def test_image_processor_reports_exif_capture_time_without_gps(tmp_path):
    exif = Image.Exif()
    exif[306] = "2025:04:03 12:30:00"
    exif[36867] = "2025:04:03 12:29:58"
    path = tmp_path / "with-date.jpg"
    path.write_bytes(image_bytes("JPEG", exif=exif))

    result = analyze_image(path)

    timestamp = next(item for item in result["findings"] if item["indicator"] == "exif_capture_time")
    assert "2025:04:03 12:29:58" in timestamp["finding"]
    assert "GPS" not in timestamp["finding"]


def test_image_processor_handles_missing_exif_and_rejects_corrupt_data(tmp_path):
    valid = tmp_path / "without-exif.png"
    valid.write_bytes(image_bytes("PNG"))
    result = analyze_image(valid)
    assert "EXIF metadata was not found" in next(item["finding"] for item in result["findings"] if item["indicator"] == "exif_metadata")

    corrupt = tmp_path / "corrupt.jpg"
    corrupt.write_bytes(b"not an image")
    with pytest.raises((OSError, ValueError)):
        analyze_image(corrupt)


def test_local_image_upload_persists_and_returns_forensic_results(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "local_dev_mode", True)
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "local_dev_token", "test-local-token-that-is-at-least-32-characters")
    monkeypatch.setattr(settings, "local_database_path", str(tmp_path / "evident.sqlite3"))
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {settings.local_dev_token}"}

    response = client.post(
        "/api/v1/investigations/local-image",
        headers=headers,
        files={"file": ("camera.png", image_bytes("PNG"), "image/png")},
    )

    assert response.status_code == 201
    investigation_id = response.json()["id"]
    results = client.get(f"/api/v1/investigations/{investigation_id}/results", headers=headers)
    assert results.status_code == 200
    assert results.json()["uploaded_files"][0]["original_filename"] == "camera.png"
    assert any(item["indicator"] == "image_dimensions" for item in results.json()["forensic_results"])


@pytest.mark.parametrize(
    ("filename", "content", "mime_type", "expected_status"),
    [
        ("text.txt", b"not an image", "text/plain", 415),
        ("wrong.jpg", image_bytes("PNG"), "image/jpeg", 422),
        ("corrupt.jpg", b"not an image", "image/jpeg", 422),
    ],
)
def test_local_image_upload_rejects_unsupported_mismatched_and_corrupt_files(
    tmp_path, monkeypatch, filename, content, mime_type, expected_status
):
    monkeypatch.setattr(settings, "local_dev_mode", True)
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "local_dev_token", "test-local-token-that-is-at-least-32-characters")
    monkeypatch.setattr(settings, "local_database_path", str(tmp_path / "evident.sqlite3"))
    client = TestClient(app)

    response = client.post(
        "/api/v1/investigations/local-image",
        headers={"Authorization": f"Bearer {settings.local_dev_token}"},
        files={"file": (filename, content, mime_type)},
    )

    assert response.status_code == expected_status


def test_local_image_upload_enforces_file_size_limit(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "local_dev_mode", True)
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "local_dev_token", "test-local-token-that-is-at-least-32-characters")
    monkeypatch.setattr(settings, "local_database_path", str(tmp_path / "evident.sqlite3"))
    monkeypatch.setattr(investigations, "LOCAL_IMAGE_MAX_BYTES", 32)
    client = TestClient(app)

    response = client.post(
        "/api/v1/investigations/local-image",
        headers={"Authorization": f"Bearer {settings.local_dev_token}"},
        files={"file": ("large.png", b"x" * 33, "image/png")},
    )

    assert response.status_code == 413
    assert not (tmp_path / "uploads").exists()
