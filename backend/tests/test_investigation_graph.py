import httpx
import pytest

from app.agents import investigation_graph as workflow


class _FakeGeminiClient:
    def __init__(self, response):
        self.response = response
        self.request = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, *, headers, json):
        self.request = {"url": url, "headers": headers, "json": json}
        return self.response


class _SequencedGeminiClient:
    def __init__(self, responses, model_response=None):
        self.responses = list(responses)
        self.model_response = model_response
        self.posts = []
        self.gets = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, *, headers, json):
        self.posts.append({"url": url, "headers": headers, "json": json})
        return self.responses.pop(0)

    async def get(self, url, *, headers):
        self.gets.append({"url": url, "headers": headers})
        return self.model_response


def _gemini_response(status, *, body=None):
    return httpx.Response(
        status,
        json=body if body is not None else {"candidates": [{"content": {"parts": [{"text": '{"claims":["supported claim"]}'}]}}]},
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com/test"),
    )


def _gemini_503():
    return _gemini_response(503, body={"error": {"status": "UNAVAILABLE", "message": "Temporary capacity issue"}})


def _disable_retry_delays(monkeypatch):
    async def no_sleep(_delay):
        return None

    monkeypatch.setattr(workflow.asyncio, "sleep", no_sleep)
    monkeypatch.setattr(workflow.random, "uniform", lambda _low, _high: 0)


@pytest.mark.asyncio
async def test_gemini_json_uses_generate_content_json_schema_and_parses_response(monkeypatch):
    request = httpx.Request("POST", "https://generativelanguage.googleapis.com/test")
    response = httpx.Response(
        200,
        json={
            "candidates": [{"content": {"parts": [
                {"text": "internal reasoning", "thought": True},
                {"text": '{"claims":["A verifiable claim"]}'},
            ]}, "finishReason": "STOP"}],
            "usageMetadata": {"totalTokenCount": 19},
        },
        request=request,
    )
    fake_client = _FakeGeminiClient(response)
    monkeypatch.setattr(workflow.settings, "gemini_api_key", "test-secret-key")
    monkeypatch.setattr(workflow.settings, "gemini_model", "gemini-3.8-flash")
    monkeypatch.setattr(workflow.httpx, "AsyncClient", lambda **_kwargs: fake_client)

    schema = {"type": "OBJECT", "properties": {"claims": {"type": "ARRAY"}}}
    result, tokens = await workflow.gemini_json("private investigation prompt", schema)

    assert result == {"claims": ["A verifiable claim"]}
    assert tokens == 19
    assert fake_client.request["url"].endswith("/models/gemini-3.8-flash:generateContent")
    assert fake_client.request["headers"]["x-goog-api-key"] == "test-secret-key"
    assert fake_client.request["json"]["generationConfig"] == {
        "responseMimeType": "application/json",
        "responseSchema": schema,
    }


@pytest.mark.asyncio
async def test_gemini_http_error_is_classified_and_logs_redacted_provider_detail(monkeypatch, caplog):
    secret = "test-secret-key"
    response = httpx.Response(
        429,
        json={"error": {"status": "RESOURCE_EXHAUSTED", "message": f"Quota exceeded for {secret}"}},
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com/test"),
    )
    fake_client = _FakeGeminiClient(response)
    monkeypatch.setattr(workflow.settings, "gemini_api_key", secret)
    monkeypatch.setattr(workflow.settings, "gemini_model", "gemini-3.8-flash")
    monkeypatch.setattr(workflow.settings, "gemini_fallback_model", None)
    monkeypatch.setattr(workflow.httpx, "AsyncClient", lambda **_kwargs: fake_client)

    with pytest.raises(workflow.ProviderUnavailable, match="GEMINI_HTTP_429_RESOURCE_EXHAUSTED") as error:
        await workflow.gemini_json("private investigation prompt", workflow.CLAIM_SCHEMA)

    assert error.value.retryable is True
    assert "RESOURCE_EXHAUSTED" in caplog.text
    assert "Quota exceeded for [REDACTED]" in caplog.text
    assert secret not in caplog.text
    assert "private investigation prompt" not in caplog.text


@pytest.mark.asyncio
async def test_gemini_retries_503_and_succeeds_on_second_attempt(monkeypatch):
    _disable_retry_delays(monkeypatch)
    client = _SequencedGeminiClient([_gemini_503(), _gemini_response(200)])
    monkeypatch.setattr(workflow.settings, "gemini_api_key", "test-secret-key")
    monkeypatch.setattr(workflow.settings, "gemini_model", "gemini-3.8-flash")
    monkeypatch.setattr(workflow.settings, "gemini_fallback_model", None)
    monkeypatch.setattr(workflow.httpx, "AsyncClient", lambda **_kwargs: client)

    result, _tokens = await workflow.gemini_json("claim text", workflow.CLAIM_SCHEMA)

    assert result == {"claims": ["supported claim"]}
    assert len(client.posts) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [429, 500])
async def test_gemini_retries_rate_limit_and_server_error(monkeypatch, status):
    _disable_retry_delays(monkeypatch)
    transient = _gemini_response(status, body={"error": {"status": "TEMPORARY_FAILURE", "message": "retry later"}})
    client = _SequencedGeminiClient([transient, _gemini_response(200)])
    monkeypatch.setattr(workflow.settings, "gemini_api_key", "test-secret-key")
    monkeypatch.setattr(workflow.settings, "gemini_model", "gemini-3.8-flash")
    monkeypatch.setattr(workflow.settings, "gemini_fallback_model", None)
    monkeypatch.setattr(workflow.httpx, "AsyncClient", lambda **_kwargs: client)

    result, _tokens = await workflow.gemini_json("claim text", workflow.CLAIM_SCHEMA)

    assert result == {"claims": ["supported claim"]}
    assert len(client.posts) == 2


@pytest.mark.asyncio
async def test_gemini_stops_after_three_transient_attempts(monkeypatch):
    _disable_retry_delays(monkeypatch)
    client = _SequencedGeminiClient([_gemini_503(), _gemini_503(), _gemini_503()])
    monkeypatch.setattr(workflow.settings, "gemini_api_key", "test-secret-key")
    monkeypatch.setattr(workflow.settings, "gemini_model", "gemini-3.8-flash")
    monkeypatch.setattr(workflow.settings, "gemini_fallback_model", None)
    monkeypatch.setattr(workflow.httpx, "AsyncClient", lambda **_kwargs: client)

    with pytest.raises(workflow.ProviderUnavailable, match="GEMINI_HTTP_503_UNAVAILABLE") as error:
        await workflow.gemini_json("claim text", workflow.CLAIM_SCHEMA)

    assert error.value.retryable is True
    assert len(client.posts) == workflow.GEMINI_MAX_ATTEMPTS == 3


@pytest.mark.asyncio
async def test_gemini_fallback_is_verified_then_used_after_primary_exhaustion(monkeypatch):
    _disable_retry_delays(monkeypatch)
    client = _SequencedGeminiClient(
        [_gemini_503(), _gemini_503(), _gemini_503(), _gemini_response(200)],
        model_response=httpx.Response(
            200,
            json={"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]},
            request=httpx.Request("GET", "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash"),
        ),
    )
    monkeypatch.setattr(workflow.settings, "gemini_api_key", "test-secret-key")
    monkeypatch.setattr(workflow.settings, "gemini_model", "gemini-3.8-flash")
    monkeypatch.setattr(workflow.settings, "gemini_fallback_model", "gemini-3.5-flash")
    monkeypatch.setattr(workflow.httpx, "AsyncClient", lambda **_kwargs: client)

    result, _tokens = await workflow.gemini_json("claim text", workflow.CLAIM_SCHEMA)

    assert result == {"claims": ["supported claim"]}
    assert len(client.gets) == 1
    assert [post["url"].rsplit("/", 1)[-1] for post in client.posts] == [
        "gemini-3.8-flash:generateContent",
        "gemini-3.8-flash:generateContent",
        "gemini-3.8-flash:generateContent",
        "gemini-3.5-flash:generateContent",
    ]


@pytest.mark.asyncio
async def test_gemini_does_not_call_unverified_fallback(monkeypatch):
    _disable_retry_delays(monkeypatch)
    unsupported = httpx.Response(
        200,
        json={"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["countTokens"]},
        request=httpx.Request("GET", "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash"),
    )
    client = _SequencedGeminiClient([_gemini_503(), _gemini_503(), _gemini_503()], unsupported)
    monkeypatch.setattr(workflow.settings, "gemini_api_key", "test-secret-key")
    monkeypatch.setattr(workflow.settings, "gemini_model", "gemini-3.8-flash")
    monkeypatch.setattr(workflow.settings, "gemini_fallback_model", "gemini-3.5-flash")
    monkeypatch.setattr(workflow.httpx, "AsyncClient", lambda **_kwargs: client)

    with pytest.raises(workflow.ProviderUnavailable, match="GEMINI_HTTP_503_UNAVAILABLE"):
        await workflow.gemini_json("claim text", workflow.CLAIM_SCHEMA)

    assert len(client.posts) == 3
    assert len(client.gets) == 1


@pytest.mark.asyncio
async def test_successful_gemini_flow_reaches_research_and_evidence_evaluation(monkeypatch):
    calls = []
    events = []
    source_url = "https://example.com/primary-source"

    async def fake_gemini(prompt, schema):
        calls.append(schema)
        if schema is workflow.CLAIM_SCHEMA:
            return {"claims": ["The claim is fact-checkable."]}, 5
        return {"assessments": [{
            "claim": "The claim is fact-checkable.",
            "verdict": "VERIFIED",
            "reasoning_summary": "The supplied research passage supports this claim.",
            "uncertainty": "One retrieved source was reviewed.",
            "confidence": 0.7,
            "supporting_source_urls": [source_url],
            "contradicting_source_urls": [],
            "limitations": ["Only one source was available."],
            "next_steps": ["Review additional independent sources."],
        }]}, 8

    async def fake_search(query):
        assert query == "The claim is fact-checkable."
        events.append("research")
        return [{"url": source_url, "title": "Primary source", "publisher": "example.com", "published_at": None, "passage": "Retrieved evidence passage", "retrieval_score": 0.9}]

    async def progress(_event, stage, _output):
        events.append(stage)

    monkeypatch.setattr(workflow, "gemini_json", fake_gemini)
    monkeypatch.setattr(workflow, "search_sources", fake_search)

    result = await workflow.build_investigation_graph().ainvoke({
        "content": "The claim is fact-checkable.",
        "submitted_type": "text",
        "language": "en",
        "token_count": 0,
        "progress_callback": progress,
    })

    assert calls == [workflow.CLAIM_SCHEMA, workflow.ASSESSMENT_SCHEMA]
    assert result["sources"][0]["url"] == source_url
    assert result["assessments"][0]["verdict"] == "VERIFIED"
    assert result["assessments"][0]["supporting_source_urls"] == [source_url]
    assert "research" in events
    assert "evidence_evaluation" in events


def test_citation_url_sanitizer_removes_credentials_and_secrets():
    assert workflow.safe_citation_url("https://example.com/story?access_token=secret&id=7#part") == "https://example.com/story?id=7"
    assert workflow.safe_citation_url("https://user:password@example.com/story") is None
    assert workflow.safe_citation_url("javascript:alert(1)") is None


@pytest.mark.asyncio
async def test_assessment_with_unknown_citations_is_forced_unverified(monkeypatch):
    async def fake_gemini(_prompt, _schema):
        return {"assessments": [{
            "claim": "The claim",
            "verdict": "VERIFIED",
            "reasoning_summary": "Unsupported output.",
            "confidence": 0.99,
            "supporting_source_urls": ["https://unknown.example/source"],
            "contradicting_source_urls": [],
            "limitations": [],
            "next_steps": [],
        }]}, 10

    monkeypatch.setattr(workflow, "gemini_json", fake_gemini)
    result = await workflow.evaluate_claims({
        "claims": ["The claim"],
        "sources": [{"url": "https://known.example/source", "title": "Known", "publisher": "known.example", "passage": "A real retrieved passage."}],
    })
    assessment = result["assessments"][0]
    assert assessment["verdict"] == "UNVERIFIED"
    assert assessment["confidence"] == 0
    assert assessment["supporting_source_urls"] == []
