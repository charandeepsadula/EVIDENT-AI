import pytest
from pydantic import ValidationError

from app.schemas.investigations import InvestigationCreate


def test_text_input_is_trimmed_and_language_is_validated():
    request = InvestigationCreate(submitted_type="text", content="  A factual statement.  ", language="en")
    assert request.content == "A factual statement."


@pytest.mark.parametrize("url", ["file:///etc/passwd", "ftp://example.com/a", "http://localhost/a", "http://127.0.0.1/", "http://169.254.169.254/latest/meta-data"])
def test_rejects_non_http_and_private_urls(url: str):
    with pytest.raises(ValidationError):
        InvestigationCreate(submitted_type="url", content=url)


@pytest.mark.parametrize("url", ["https://example.com/article", "https://www.example.org/news?id=42"])
def test_accepts_public_http_urls(url: str):
    request = InvestigationCreate(submitted_type="url", content=url)
    assert request.content == url


def test_rejects_secret_query_parameters():
    with pytest.raises(ValidationError, match="secret query parameters"):
        InvestigationCreate(submitted_type="url", content="https://example.com/article?access_token=private")


def test_rejects_empty_or_overlong_input():
    with pytest.raises(ValidationError):
        InvestigationCreate(submitted_type="text", content="   ")
    with pytest.raises(ValidationError):
        InvestigationCreate(submitted_type="text", content="x" * 20001)
