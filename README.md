# EVIDENT AI
## Beyond Content. Into Truth.

**EVIDENT AI** is an AI-powered Digital Investigation and Media Intelligence Platform engineered to help investigators, analysts, journalists, and citizens investigate suspicious online claims, news articles, website URLs, and digital media using multi-agent AI verification, live web research, source corroboration, and explainable conclusions.

Built for the **NxtWave IDEA//FORGE AI & Agents National Hackathon**.

---

## 1. Product Identity & Core Philosophy

- **Product:** EVIDENT AI
- **Tagline:** Beyond Content. Into Truth.
- **Mission:** Anchor digital media evaluation in traceable, cited, verifiable ground-truth evidence.
- **Responsible AI Guarantee:** EVIDENT AI never fabricates consensus or presents unsupported premises as truth. If reputable research does not establish a claim, it is declared `UNVERIFIED` with explicit statements of uncertainty and limitations.

---

## 2. Technology Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Modern Responsive CSS, Lucide Icons.
- **Backend:** Python 3.13, FastAPI, Pydantic v2, REST API, Asynchronous Background Pipeline.
- **Database:** SQLite (local persistent intelligence vault) with SQLAlchemy models, cascading foreign keys, and migration paths.
- **AI Engine:** Google Gemini API (`gemini-3.8-flash` / `gemini-2.5-flash`) with structured JSON schema outputs for atomic claim decomposition and verdict synthesis.
- **Web Intelligence:** Tavily Search API with passage extraction, publisher domain identification, and retrieval scoring.
- **Digital Media Forensics:** Pillow (PIL) for EXIF camera metadata, capture timestamps, missing metadata detection, C2PA content provenance marker detection, and Gemini Vision multimodal scene & OCR inspection.

---

## 3. Application Structure (10 Core Pages)

Every page is connected to live, functional backend endpoints:

1. **Landing Page (`/`):** High-impact presentation with branding, tagline, 5-stage pipeline walkthrough, capability matrix, interactive benchmark preview, and Responsible AI charter.
2. **Dashboard (`/dashboard`):** Real-time backend statistics (Total, Completed, Active, Failed), quick action launchpad, recent investigations feed with verdicts and progress, and engine readiness monitors.
3. **New Investigation (`/investigations/new` and `/investigate`):** Multi-modal investigation studio supporting Factual Claims (Text) and Website URLs with one-click benchmark presets and language selection (English, Telugu, Hindi, Auto-detect).
4. **Investigation Results (`/investigations/[id]`):** Live progress polling, atomic sub-claim verdicts, supporting vs. contradicting evidence matrix, clickable source URLs, exact quoted passages, confidence meters, and audit trails.
5. **Investigation History (`/investigations/history` and `/history`):** Complete vault of past investigations with keyword search, type and status filtering, deletion, and quick audit access.
6. **Evidence Explorer (`/evidence`):** Cross-investigation repository of all gathered citations, filterable by direction (supporting/contradicting), search quotes, and top cited publisher domain breakdown.
7. **Image Lab (`/labs/image` and `/image-lab`):** Dedicated forensic upload studio with file validation (<25 MB), EXIF camera metadata, capture timestamps, C2PA marker detection, GPS privacy protection, and Gemini Vision multimodal analysis.
8. **Reports Center (`/reports` and `/reports/[id]`):** Generates versioned intelligence dossiers from completed investigations, featuring printable PDF layouts, JSON downloads, and audit logs.
9. **Settings & Integrations (`/settings`):** Manage Gemini & Tavily credentials, model configuration, latency test pings, language preferences, and SQLite database diagnostics.
10. **System Health & API Playground (`/system-health` and `/api-playground`):** Live telemetry for API Gateway, SQLite, Gemini, and Tavily, accompanied by an interactive OpenAPI test console.

---

## 4. Multi-Agent Verification Pipeline

```
[ User Claim / URL / Image ]
            │
            ▼
┌─────────────────────────┐
│ 1. Claim Decomposition  │ ──► Gemini extracts up to 5 atomic verifiable claims
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. Multi-Source Search  │ ──► Tavily Search retrieves peer-reviewed / news sources
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. Evidence Matrix      │ ──► Separates supporting vs. contradicting passages
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. Verdict Evaluation   │ ──► Verified / False / Misleading / Unverified
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ 5. Dossier Persistence  │ ──► Saved to SQLite Vault with complete audit trail
└─────────────────────────┘
```

---

## 5. Quick Start & Execution

### Prerequisites
- Python 3.11+
- Node.js 20+

### Step 1: Start Backend API
```powershell
# In project root:
backend\.venv\Scripts\python.exe backend\run.py
```
Backend runs at `http://127.0.0.1:8000` with interactive docs at `http://127.0.0.1:8000/docs`.

### Step 2: Start Frontend Application
```powershell
# In frontend directory:
cd frontend
npm install
npm run dev
```
Open `http://127.0.0.1:3001` or `http://localhost:3000` in your browser.

### Step 3: Run Backend Test Suite
```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests
```
All 39 automated tests validate forensic processors, API schemas, local SQLite persistence, and system telemetry endpoints.
