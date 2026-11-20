# EVIDENT AI
## MASTER PRODUCT & TECHNICAL SPECIFICATION

**Tagline:** Beyond Content. Into Truth.

**Version:** 1.0  
**Project:** NxtWave IDEA//FORGE AI & Agents Hackathon  
**Category:** AI & Digital Forensics  
**Development:** OpenAI Codex  
**Source Control:** GitHub  
**Frontend Deployment:** Vercel  
**Backend Deployment:** Render  

---

# 1. PRODUCT OVERVIEW

Evident AI is an AI-powered digital investigation and media intelligence platform designed to investigate misinformation, verify factual claims, detect potential manipulated media, analyze information sources and generate evidence-backed investigation reports.

The platform supports text, images, videos, audio, documents and URLs.

### Main Objectives

- Verify factual claims using reliable information sources.
- Identify potentially AI-generated or manipulated media.
- Analyze images, videos, audio and documents.
- Investigate information sources and earlier content appearances.
- Identify supporting and contradicting evidence.
- Generate transparent, explainable investigation reports.
- Track how claims and information change over time.

# 2. CORE FUNCTIONAL MODULES

## MODULE A: UNIVERSAL CONTENT VERIFICATION

1. Text verification.
2. URL and webpage verification.
3. Image verification.
4. Video verification.
5. Audio verification.
6. PDF and document verification.
7. Screenshot verification.
8. Social media content verification.
9. Batch content verification.
10. Multilingual verification.

Supported initial languages:
- English
- Telugu
- Hindi

## MODULE B: MULTI-AGENT AI INVESTIGATION

Implement a specialized multi-agent architecture using LangGraph.

### Agents

1. Master Coordinator Agent
2. Claim Extraction Agent
3. Research Agent
4. Evidence Collection Agent
5. Evidence Evaluation Agent
6. Contradiction Detection Agent
7. Context Analysis Agent
8. Source Intelligence Agent
9. Image Forensics Agent
10. Video Forensics Agent
11. Audio Forensics Agent
12. Origin Investigation Agent
13. Language Agent
14. Risk Assessment Agent
15. Report Generation Agent

### Advanced Agent Capabilities

- Dynamic agent selection.
- Parallel task execution.
- Agent-to-agent communication through structured results.
- Evidence-based reasoning.
- Agent disagreement detection.
- Retry and recovery mechanisms.
- Investigation state persistence.
- Human approval checkpoints.
- Execution logs.
- Token and API cost tracking.
- Execution time monitoring.
- Workflow replay.
- Maximum execution limits.

Agents must not fabricate evidence or present unsupported conclusions.

## MODULE C: EVIDENCE INTELLIGENCE ENGINE

1. Evidence collection.
2. Supporting and contradicting evidence.
3. Source URL recording.
4. Exact quotation extraction.
5. Publication date tracking.
6. Retrieval timestamp recording.
7. Evidence relevance scoring.
8. Source reliability assessment.
9. Duplicate-source detection.
10. Citation validation.
11. Evidence version history.
12. Evidence graph.
13. Claim relationship mapping.
14. Evidence revalidation.

Every evidence record should retain its source, quotation, publication date, retrieval date, relevance, direction and verification status.

## MODULE D: DIGITAL FORENSICS

### Image Forensics

- EXIF metadata inspection.
- Perceptual hashing.
- Duplicate image detection.
- Near-duplicate image detection.
- AI-generated image indicators.
- Face manipulation indicators.
- Image region anomaly analysis.
- Reverse-image search integration.
- C2PA/content credential inspection.
- Image compression analysis.

### Video Forensics

- Video metadata extraction.
- Frame extraction.
- Scene transition detection.
- Face consistency analysis.
- Lip synchronization analysis.
- Audio-video alignment.
- Frame duplication indicators.
- Suspicious segment identification.
- Timestamped frame gallery.
- Recycled video discovery.

### Audio Forensics

- Speech-to-text transcription.
- Timestamped transcripts.
- Speaker segmentation where supported.
- Synthetic speech detection indicators.
- Waveform analysis.
- Spectral analysis.
- Audio splice indicators.
- Suspicious segment identification.

### Document Forensics

- PDF metadata inspection.
- OCR and text extraction.
- Embedded image inspection.
- Document structure analysis.
- Document comparison.
- Citation verification.
- Contradictory statement detection.

Forensic findings must be presented as indicators, not absolute proof of authenticity or manipulation.

## MODULE E: MISINFORMATION INTELLIGENCE

1. Origin investigation.
2. Claim evolution tracking.
3. Information spread timeline.
4. Cross-platform content comparison.
5. Similar-content discovery.
6. Recycled media detection.
7. Narrative clustering.
8. Context recovery.
9. Source relationship analysis.
10. Configurable public-source monitoring.
11. Trending suspicious claim alerts.
12. Emerging narrative detection.

Only accessible and supported sources may be monitored or investigated.

## MODULE F: VERDICT AND REASONING ENGINE

The system must distinguish factual accuracy from media authenticity.

### Verdict categories

- VERIFIED: Reliable evidence supports the claim.
- FALSE: Strong evidence contradicts the claim.
- MISLEADING: Important context is missing or distorted.
- UNVERIFIED: Available evidence is insufficient.
- MANIPULATION INDICATORS FOUND: Forensic indicators require additional investigation.

Every verdict must include:

- Reasoning summary.
- Supporting evidence.
- Contradicting evidence.
- Source links.
- Confidence and uncertainty explanation.
- Investigation limitations.
- Recommended next steps.

## MODULE G: ADVANCED REPORTING

Every completed investigation should generate a structured report containing:

1. Executive summary.
2. Submitted content details.
3. Extracted claims.
4. Claim-by-claim verdicts.
5. Supporting evidence.
6. Contradicting evidence.
7. Source assessment.
8. Forensic analysis.
9. Timeline of discovered appearances.
10. Agent findings.
11. Confidence and uncertainty.
12. Investigation limitations.
13. Recommended actions.

Export formats:

- PDF
- JSON
- Private shareable report
- Evidence archive

Reports must support versioning and unique investigation IDs.

## MODULE H: USER AND COLLABORATION FEATURES

- User registration and login.
- User dashboard.
- Investigation history.
- Saved investigations.
- Bookmarks.
- User annotations.
- Notifications.
- Private report sharing.
- Multilingual settings.
- Team workspaces.
- Organization accounts.
- Role-based access control.
- Human review.
- Developer API.
- Usage analytics.

## MODULE I: ENTERPRISE CAPABILITIES

- Multi-organization architecture.
- Team permissions.
- Investigation assignment.
- Team comments.
- Organization audit logs.
- API key management.
- Usage and cost tracking.
- Configurable processing limits.
- Webhook notifications.
- Admin moderation.
- Model version management.
- Prompt version management.
- Background job monitoring.
- System health monitoring.

# 3. TECHNOLOGY STACK

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- React visualization libraries

### Backend

- Python
- FastAPI
- Pydantic
- REST APIs

### AI and Agent Architecture

- Gemini API
- LangGraph
- Specialized forensic models
- Structured AI outputs
- Evidence evaluation workflows

### Database and Storage

- Supabase
- PostgreSQL
- pgvector
- Supabase Storage
- Row Level Security

### Background Processing

- Redis
- Python workers
- Asynchronous job processing

### Media Processing

- OpenCV
- FFmpeg
- Whisper-compatible transcription
- OCR engine
- Image hashing tools

### Testing

- Pytest
- Playwright
- Unit testing
- Integration testing
- API testing
- AI evaluation benchmarks

### Development and Deployment

- Codex
- Git
- GitHub
- Vercel
- Render

# 4. SYSTEM ARCHITECTURE

USER
  |
  v
NEXT.JS FRONTEND
  |
  v
FASTAPI BACKEND
  |
  +--- Authentication Service
  |
  +--- Upload Service
  |
  +--- Investigation API
  |
  +--- LangGraph Coordinator
          |
          +--- Research Agent
          |
          +--- Evidence Agent
          |
          +--- Contradiction Agent
          |
          +--- Forensics Agents
          |
          +--- Source Intelligence Agent
          |
          +--- Report Agent
  |
  v
VERDICT ENGINE
  |
  v
POSTGRESQL DATABASE
  |
  v
REPORT GENERATION

Long-running media investigations must run through background workers.

# 5. DATABASE SPECIFICATION

Required database tables:

1. profiles
2. organizations
3. organization_members
4. investigations
5. uploaded_files
6. claims
7. sources
8. evidence
9. agent_runs
10. agent_findings
11. forensic_results
12. investigation_events
13. entity_relationships
14. reports
15. monitoring_rules
16. notifications
17. audit_logs
18. api_keys
19. usage_records

### Database Requirements

- Proper foreign key relationships.
- Database indexes.
- Row Level Security.
- Private user data.
- Secure file storage.
- Database migrations.
- Data deletion controls.
- Backup and recovery support.

# 6. FRONTEND PAGE SPECIFICATION

1. Landing Page
2. Login Page
3. Registration Page
4. Main Dashboard
5. Investigation Studio
6. Text Analyzer
7. Image Lab
8. Video Lab
9. Audio Lab
10. Document Lab
11. Evidence Explorer
12. Evidence Graph
13. Source Intelligence
14. Truth Timeline
15. Trend Monitor
16. Investigation History
17. Report Center
18. API Playground
19. Notifications
20. User Settings
21. Admin Console

### User Interface Requirements

- Premium professional dark theme.
- Responsive desktop and mobile layouts.
- Modern typography.
- Consistent spacing and component design.
- Interactive evidence visualizations.
- Drag-and-drop upload.
- Real-time investigation progress.
- Agent activity logs.
- Loading and error states.
- Search, filtering and sorting.
- Accessible navigation.
- Functional buttons and controls.

# 7. API SPECIFICATION

Base URL: `/api/v1`

### Investigation APIs

- POST `/investigations`
- GET `/investigations`
- GET `/investigations/{id}`
- POST `/investigations/{id}/cancel`

### Verification APIs

- POST `/verify/text`
- POST `/verify/url`
- POST `/claims/extract`

### Media APIs

- POST `/media/image/analyze`
- POST `/media/video/analyze`
- POST `/media/audio/analyze`
- POST `/media/document/analyze`

### Evidence APIs

- GET `/investigations/{id}/evidence`
- GET `/investigations/{id}/graph`
- GET `/investigations/{id}/timeline`

### Report APIs

- POST `/reports`
- GET `/reports/{id}`

### System APIs

- GET `/health`

All endpoints must have defined request schemas, response schemas, validation, authentication requirements and error responses.

# 8. SECURITY SPECIFICATION

1. Secure authentication.
2. Row Level Security.
3. Private file storage.
4. File type and size validation.
5. Safe file processing.
6. Malware scanning where available.
7. SSRF protection.
8. Prompt injection protection.
9. API rate limiting.
10. Environment variable secret management.
11. Secure logging.
12. Audit logs.
13. Data deletion controls.
14. Database backups.
15. Background job recovery.
16. Input and output validation.
17. Access control.
18. API abuse prevention.

# 9. INVESTIGATION STATUS SYSTEM

Supported states:

- QUEUED
- PROCESSING
- ANALYZING
- EVIDENCE_REVIEW
- NEEDS_REVIEW
- COMPLETED
- PARTIALLY_COMPLETED
- FAILED
- CANCELLED

The frontend must display:

- Current processing stage.
- Progress.
- Elapsed time.
- Agent execution status.
- Errors.
- Completion status.

# 10. GITHUB REPOSITORY STRUCTURE

evident-ai/
|
|-- AGENTS.md
|-- README.md
|-- .gitignore
|-- .github/
|
|-- frontend/
|   |-- app/
|   |-- components/
|   |-- features/
|   |-- hooks/
|   |-- lib/
|   |-- tests/
|
|-- backend/
|   |-- app/
|   |   |-- api/
|   |   |-- agents/
|   |   |-- pipelines/
|   |   |-- services/
|   |   |-- models/
|   |   |-- schemas/
|   |   |-- workers/
|   |   |-- security/
|   |   |-- database/
|   |   |-- core/
|   |
|   |-- tests/
|   |-- requirements.txt
|
|-- docs/
|   |-- PRD.md
|   |-- ARCHITECTURE.md
|   |-- DATABASE.md
|   |-- API_SPEC.md
|   |-- AI_AGENTS.md
|   |-- SECURITY.md
|   |-- TESTING.md
|   |-- DEPLOYMENT.md
|
|-- infrastructure/

# 11. DEVELOPMENT ROADMAP

PHASE 1: Project foundation and repository setup.

PHASE 2: Frontend, backend and database integration.

PHASE 3: Authentication and dashboard.

PHASE 4: Text and URL verification.

PHASE 5: Evidence intelligence engine.

PHASE 6: Multi-agent investigation architecture.

PHASE 7: Image forensics.

PHASE 8: Video and audio forensics.

PHASE 9: Document analysis.

PHASE 10: Evidence graph and timeline.

PHASE 11: Advanced reporting and multilingual support.

PHASE 12: Monitoring and collaboration.

PHASE 13: Security and performance testing.

PHASE 14: Production deployment and hackathon presentation.

# 12. FEATURE COMPLETION STANDARD

A feature is complete only when:

- Frontend interface works.
- Backend endpoint works.
- Database integration works.
- Authentication and authorization work.
- Input validation is implemented.
- Error handling is implemented.
- Loading and empty states are implemented.
- Real AI or service integration is working.
- Evidence is traceable.
- Tests pass.
- Mobile responsiveness is verified.
- Deployment is tested.
- Documentation is updated.

No fake AI results, placeholder functionality presented as complete, nonfunctional buttons or unsupported accuracy claims.

# 13. DEPLOYMENT CONFIGURATION

### GitHub
- Store complete source code.
- Maintain feature branches.
- Use pull requests and commits.
- Track issues and development progress.

### Vercel
- Deploy Next.js frontend.
- Configure production environment variables.
- Connect frontend to backend API.

### Render
- Deploy FastAPI backend.
- Deploy background workers.
- Configure Redis and persistent services where required.
- Configure health checks and environment variables.

### Supabase
- Host PostgreSQL database.
- Configure authentication.
- Configure private storage.
- Enable and test Row Level Security.

# 14. PROJECT IDENTITY

**Product:** Evident AI

**Tagline:** Beyond Content. Into Truth.

**Category:** AI-powered Digital Investigation and Media Intelligence.

**Hackathon Track:** Track 1 — Civic Pulse, Digital Governance & Public Information.

**Problem Statement:** Problem 4 — Real-Time Fact-Verification & Deepfake Audit Engine.

**Development Environment:** Codex.

**Repository:** evident-ai.

**Frontend Hosting:** Vercel.

**Backend Hosting:** Render.

**Database:** Supabase.

**AI Architecture:** Gemini + LangGraph + Specialized Forensic Models.

---

# FINAL DEVELOPMENT PRINCIPLE

Build Evident AI as a complete, reliable, scalable and evidence-driven AI product.

Implement each feature in phases, with working frontend, backend, database, AI integration, validation, testing, security and deployment.

Do not prioritize the number of features over their quality.

Every investigation must be transparent, evidence-backed, reproducible and honest about uncertainty.

**EVIDENT AI — Beyond Content. Into Truth.**