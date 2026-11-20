# Integration configuration

Copy `backend/.env.example` to `backend/.env` and set values locally. The frontend uses `frontend/.env.local`. These files are ignored by Git.

| Variable | Service | Used for |
|---|---|---|
| `SUPABASE_URL` | Supabase | Backend Auth and Postgres Data API |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase | Public project identifier/key for API clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Private trusted worker writes; backend only |
| `GEMINI_API_KEY` | Google AI Studio / Gemini API | Claim extraction and evidence-grounded assessment |
| `GEMINI_MODEL` | Gemini API | Model selection; default is `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | Gemini API | Optional fallback. Before use, the backend checks that the model is available and advertises `generateContent` for this key. |
| `TAVILY_API_KEY` | Tavily | Accessible-source search and submitted-URL extraction |
| `REDIS_URL` | Redis | Durable background investigation queue |

Text and URL investigations require Supabase, Redis, Gemini, and Tavily. Without them, the API returns a configuration error and does not queue the investigation. Cost and availability depend on each provider’s current plan and usage limits.

Never log or share secrets. Store them in the local ignored environment files during development and in the deployment secret manager in production. Frontend publishable keys are intended for browser use; service role and AI/research provider keys are server-only.

Gemini calls use `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` through `httpx` (the backend does not depend on the Google GenAI SDK). Transient 429, 500, and 503 responses get at most three attempts per model with exponential backoff and jitter. If configured, a fallback model is checked with `models.get` and used only when it advertises `generateContent`. Requests use a 45-second total and 10-second connect timeout; the ARQ worker timeout is sized to allow retries through both configured models across both structured analysis stages. Provider failures are recorded on the investigation with a specific error category. Backend logs include model, HTTP status, Google's error status/message when provided, or safe response-shape diagnostics. Prompts, generated content, and API keys are not logged. For `*_HTTP_429`, check quota and rate limits; for `*_HTTP_401` or `*_HTTP_403`, check the key and account restrictions; for `*_HTTP_400`, use the logged provider message to inspect request/schema compatibility; and for `GEMINI_HTTP_404`, check model availability. Local processing updates stage and agent activity in the saved investigation as work proceeds.
