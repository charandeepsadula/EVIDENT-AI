import Link from "next/link";
import {
  ShieldCheck,
  Search,
  Globe,
  ImageIcon,
  ArrowRight,
  Database,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Activity
} from "@/components/icons";

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* Navigation Header */}
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          padding: "16px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(9, 14, 26, 0.9)",
          backdropFilter: "blur(10px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "9px",
              background: "linear-gradient(135deg, #F97316, #C2410C)",
              color: "#FFF",
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              fontSize: "18px",
            }}
          >
            E
          </div>
          <div>
            <span style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.08em" }}>
              EVIDENT <span style={{ color: "var(--orange)" }}>AI</span>
            </span>
            <span
              style={{
                display: "block",
                fontSize: "9px",
                color: "var(--muted)",
                letterSpacing: "0.15em",
                fontWeight: 600,
              }}
            >
              DIGITAL INVESTIGATION PLATFORM
            </span>
          </div>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: "24px", fontSize: "13px" }}>
          <Link href="#capabilities" style={{ color: "var(--muted)" }}>Capabilities</Link>
          <Link href="#pipeline" style={{ color: "var(--muted)" }}>How It Works</Link>
          <Link href="#responsible-ai" style={{ color: "var(--muted)" }}>Responsible AI</Link>
          <Link href="/system-health" style={{ color: "var(--muted)" }}>System Status</Link>
          <Link href="/dashboard" className="button button-primary">
            Open Dashboard <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <ShieldCheck size={14} />
          NATIONAL HACKATHON GRADE AI INVESTIGATION
        </div>

        <h1 className="hero-title">
          Beyond Content. <span>Into Truth.</span>
        </h1>

        <p className="hero-subtitle">
          EVIDENT AI empowers researchers, investigative journalists, and analysts to verify claims,
          dissect deceptive online narratives, audit source credibility, and inspect digital media
          with verifiable citations and explainable reasoning.
        </p>

        <div className="hero-cta-group">
          <Link href="/investigations/new" className="button button-primary" style={{ padding: "0 24px", minHeight: "44px", fontSize: "13px" }}>
            Start an Investigation <ArrowRight size={15} />
          </Link>
          <Link href="/dashboard" className="button button-secondary" style={{ padding: "0 24px", minHeight: "44px", fontSize: "13px" }}>
            <Activity size={15} /> View Live Intelligence Dashboard
          </Link>
          <Link href="/labs/image" className="button button-secondary" style={{ padding: "0 24px", minHeight: "44px", fontSize: "13px" }}>
            <ImageIcon size={15} /> Open Image Lab
          </Link>
        </div>

        {/* Quick Demo Preview Card */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            padding: "24px",
            textAlign: "left",
            boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
              <b style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#E2E8F0" }}>SAMPLE INVESTIGATION OUTPUT</b>
            </div>
            <span className="verdict-chip false">FALSE VERDICT</span>
          </div>

          <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF", marginBottom: "8px" }}>
            Claim: &ldquo;The Great Wall of China is visible from the Moon with the naked eye.&rdquo;
          </div>

          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px", lineHeight: "1.6" }}>
            Reasoning: Multiple verified astronomical and space agency records (NASA, Apollo astronauts) explicitly confirm that the Great Wall is not visible from lunar orbit or the Moon without optical magnification due to optical resolution limits and human visual acuity.
          </p>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "11px" }}>
            <span style={{ padding: "4px 8px", borderRadius: "4px", background: "var(--panel2)", color: "#94A3B8" }}>
              <b>Confidence:</b> 98% (Adequate Evidence)
            </span>
            <span style={{ padding: "4px 8px", borderRadius: "4px", background: "var(--panel2)", color: "#94A3B8" }}>
              <b>Sources Cited:</b> NASA Earth Observatory, Scientific American
            </span>
            <span style={{ padding: "4px 8px", borderRadius: "4px", background: "var(--panel2)", color: "#94A3B8" }}>
              <b>Multi-Agent Verification:</b> 3 Sub-claims Decomposed
            </span>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section id="capabilities" style={{ maxWidth: "1200px", margin: "60px auto 40px", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div className="eyebrow">MULTIDISCIPLINARY CAPABILITIES</div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, margin: "6px 0" }}>Built for Thorough Investigation</h2>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            From individual statements to viral URLs and forensic image analysis.
          </p>
        </div>

        <div className="landing-grid">
          <div className="landing-card">
            <div className="landing-card-icon">
              <Search size={20} />
            </div>
            <h3>Claim Extraction & Atomic Breakdown</h3>
            <p>
              Deconstructs complex, multi-sentence statements into atomic, testable claims using Google Gemini structured outputs without hallucinating unsupported premises.
            </p>
          </div>

          <div className="landing-card">
            <div className="landing-card-icon">
              <Globe size={20} />
            </div>
            <h3>Real-Time Web Intelligence</h3>
            <p>
              Executes multi-query web research using Tavily Search API. Pulls exact quotes, retrieval timestamps, publisher metadata, and verifiable URLs.
            </p>
          </div>

          <div className="landing-card">
            <div className="landing-card-icon">
              <ImageIcon size={20} />
            </div>
            <h3>Digital Image Lab & Forensics</h3>
            <p>
              Extracts EXIF camera metadata, capture timestamps, C2PA content provenance markers, and runs Gemini Vision multimodal visual inspection.
            </p>
          </div>

          <div className="landing-card">
            <div className="landing-card-icon">
              <CheckCircle2 size={20} />
            </div>
            <h3>Evidence Matrix & Contradictions</h3>
            <p>
              Categorizes citations into supporting vs contradicting columns with exact quoted passages, allowing transparent human verification.
            </p>
          </div>

          <div className="landing-card">
            <div className="landing-card-icon">
              <Database size={20} />
            </div>
            <h3>Evidence Intelligence Explorer</h3>
            <p>
              Cross-investigation repository tracking citations across multiple investigations, domain reliability, and recurring patterns of misinformation.
            </p>
          </div>

          <div className="landing-card">
            <div className="landing-card-icon">
              <FileText size={20} />
            </div>
            <h3>Verifiable Reports & Dossiers</h3>
            <p>
              Generate formal investigation dossiers complete with audit trails, timestamps, uncertainty bounds, and printable PDF / Markdown formats.
            </p>
          </div>
        </div>
      </section>

      {/* Step by Step Pipeline */}
      <section id="pipeline" style={{ maxWidth: "1200px", margin: "60px auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div className="eyebrow">THE 5-STAGE PIPELINE</div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, margin: "6px 0" }}>How EVIDENT AI Reaches a Verdict</h2>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            A rigorous, multi-agent workflow engineered to prevent hallucinations and prioritize source grounding.
          </p>
        </div>

        <div className="pipeline-steps">
          <div className="pipeline-step">
            <div className="pipeline-step-num">STAGE 01</div>
            <h4>Input Ingestion</h4>
            <p>Sanitizes input, detects language (English, Telugu, Hindi), and validates public URLs or uploaded media.</p>
          </div>

          <div className="pipeline-step">
            <div className="pipeline-step-num">STAGE 02</div>
            <h4>Claim Decomposition</h4>
            <p>Gemini LLM breaks the submission into atomic factual claims in strict JSON schemas.</p>
          </div>

          <div className="pipeline-step">
            <div className="pipeline-step-num">STAGE 03</div>
            <h4>Targeted Research</h4>
            <p>Tavily Search API retrieves peer-reviewed, reputable, and contradicting source passages.</p>
          </div>

          <div className="pipeline-step">
            <div className="pipeline-step-num">STAGE 04</div>
            <h4>Evidence Synthesis</h4>
            <p>Evaluates passage relevance, identifies direct contradictions, and measures evidence adequacy.</p>
          </div>

          <div className="pipeline-step">
            <div className="pipeline-step-num">STAGE 05</div>
            <h4>Explainable Verdict</h4>
            <p>Assigns verdict (Verified, False, Misleading, Unverified) with explicit statements of uncertainty.</p>
          </div>
        </div>
      </section>

      {/* Responsible AI Manifesto */}
      <section
        id="responsible-ai"
        style={{
          maxWidth: "1000px",
          margin: "60px auto",
          padding: "32px",
          background: "var(--panel)",
          border: "1px solid var(--orange-line)",
          borderRadius: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <ShieldCheck size={22} className="text-orange" style={{ color: "var(--orange)" }} />
          <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#FFFFFF" }}>
            Responsible AI & Transparency Charter
          </h3>
        </div>

        <p style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: "1.7", margin: "0 0 16px" }}>
          EVIDENT AI is grounded in the principle that <b>AI must not manufacture consensus or present unverified assertions as objective truth</b>.
        </p>

        <ul style={{ paddingLeft: "20px", fontSize: "12.5px", color: "var(--muted)", lineHeight: "1.8", margin: 0 }}>
          <li><b>Traceable Evidence:</b> Every conclusion must cite exact source URLs and retrieved passages. If no corroborating sources exist, the verdict is declared UNVERIFIED.</li>
          <li><b>Explicit Uncertainty:</b> Confidence scores reflect evidence coverage, not subjective belief. Known limitations and recommended human review steps are stated in every report.</li>
          <li><b>Digital Media Boundaries:</b> Metadata and visual inspection are descriptive indicators; EVIDENT AI never claims cryptographic proof of authenticity from visual heuristics alone.</li>
          <li><b>Privacy-First:</b> Sensitive geolocation data (EXIF GPS) is intentionally stripped and never stored in the database.</li>
        </ul>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "32px",
          textAlign: "center",
          color: "var(--muted)",
          fontSize: "12px",
          background: "#05080E",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "12px" }}>
          <Link href="/dashboard" style={{ color: "var(--text)" }}>Dashboard</Link>
          <Link href="/investigations/new" style={{ color: "var(--text)" }}>New Investigation</Link>
          <Link href="/evidence" style={{ color: "var(--text)" }}>Evidence Explorer</Link>
          <Link href="/labs/image" style={{ color: "var(--text)" }}>Image Lab</Link>
          <Link href="/system-health" style={{ color: "var(--text)" }}>API Status</Link>
        </div>
        <div>EVIDENT AI &bull; Beyond Content. Into Truth. &bull; National Hackathon Ready Platform</div>
      </footer>
    </div>
  );
}
