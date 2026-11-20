# Architecture

## Phase 1 foundation

The system is a monorepo with independently runnable applications: a Next.js TypeScript frontend and a FastAPI Python backend. The frontend will call the versioned REST API. The API owns validation, authorization, investigation orchestration, persistence, and integration boundaries. Long-running media tasks will move to workers in a later phase.

## Target services

- Vercel: Next.js frontend.
- Render: FastAPI API and background worker processes.
- Supabase: PostgreSQL, authentication, and private object storage.
- Redis: background job transport/state coordination.
- Gemini and selected research/forensic providers: external AI and source integrations.

No external service is connected in the foundation phase. Integration credentials must be configured server-side and must never be exposed to browser bundles.

## Investigation integrity

Claims, evidence, forensic indicators, and verdicts will be distinct records. Verdicts must cite stored evidence and state uncertainty and limitations. Media authenticity assessments remain separate from factual claim assessments. The API health endpoint reports process liveness only; service readiness checks will be added when dependencies are configured.
