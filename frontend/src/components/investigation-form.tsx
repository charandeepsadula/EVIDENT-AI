"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { Search, Globe, Sparkles, ArrowRight, ShieldCheck, AlertTriangle } from "@/components/icons";

const sampleClaims = [
  {
    label: "Great Wall of China & Moon",
    text: "The Great Wall of China is visible from the Moon with the naked eye.",
    type: "text" as const,
  },
  {
    label: "NASA 3 Days of Darkness",
    text: "NASA has officially confirmed that the Earth will experience 3 days of complete darkness due to an astronomical solar alignment.",
    type: "text" as const,
  },
  {
    label: "Telugu Claim (భారత రాజధాని)",
    text: "భారతదేశపు రాజధాని న్యూఢిల్లీ, మరియు ఇది ప్రపంచంలోనే అతిపెద్ద ప్రజాస్వామ్య దేశం.",
    lang: "te",
    type: "text" as const,
  },
  {
    label: "Hindi Claim (ताजमहल)",
    text: "ताजमहल का निर्माण मुगल सम्राट शाहजहाँ ने 17वीं शताब्दी में करवाया था।",
    lang: "hi",
    type: "text" as const,
  },
  {
    label: "Sample Public Article URL",
    text: "https://en.wikipedia.org/wiki/Great_Wall_of_China",
    type: "url" as const,
  },
];

export function InvestigationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "url" ? "url" : "text";

  const [kind, setKind] = useState<"text" | "url">(initialTab);
  const [content, setContent] = useState("");
  const [context, setContext] = useState("");
  const [language, setLanguage] = useState("auto");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (searchParams.get("tab") === "url") {
      setKind("url");
    }
  }, [searchParams]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const value = content.trim();
    if (!value) {
      setMessage("Please enter claim or URL to investigate.");
      return;
    }

    if (kind === "url") {
      try {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        setMessage("Please enter a valid public HTTP or HTTPS web URL.");
        return;
      }
    }

    submitting.current = true;
    setBusy(true);
    setMessage("Initializing multi-agent investigation pipeline...");

    try {
      const fullContent = context.trim() ? `${value}\n\nAdditional Context:\n${context.trim()}` : value;
      const result = await apiFetch<{ id?: unknown; status?: unknown }>("/investigations", {
        method: "POST",
        body: JSON.stringify({
          submitted_type: kind,
          content: fullContent,
          language,
          title: kind === "text" ? value.slice(0, 100) : value,
        }),
      });

      if (typeof result?.id !== "string" || !result.id.trim()) {
        throw new ApiError("The API did not return an investigation ID. Please try again.", 502);
      }

      router.push(`/investigations/${encodeURIComponent(result.id)}`);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      const requirements = apiError?.missing?.length
        ? ` Required backend settings: ${apiError.missing.join(", ")}.`
        : "";
      setMessage(`${error instanceof Error ? error.message : "Investigation launch failed."}${requirements}`);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      {/* Mode Switcher */}
      <div className="segmented-control" role="group" aria-label="Investigation mode">
        <button
          type="button"
          disabled={busy}
          className={`segment ${kind === "text" ? "active" : ""}`}
          onClick={() => {
            setKind("text");
            setMessage("");
          }}
        >
          <Search size={14} /> Factual Claim or Statement
        </button>
        <button
          type="button"
          disabled={busy}
          className={`segment ${kind === "url" ? "active" : ""}`}
          onClick={() => {
            setKind("url");
            setMessage("");
          }}
        >
          <Globe size={14} /> Webpage Article URL
        </button>
      </div>

      {/* Quick Preset Buttons for Instant Hackathon Demonstration */}
      <div style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", fontSize: "11px", color: "var(--muted)" }}>
          <Sparkles size={13} style={{ color: "var(--orange)" }} />
          <span>Quick Benchmark Presets:</span>
        </div>
        <div className="preset-buttons">
          {sampleClaims.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className="preset-chip"
              onClick={() => {
                setKind(sample.type);
                setContent(sample.text);
                if (sample.lang) setLanguage(sample.lang);
                setMessage("");
              }}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Input Field */}
      <label className="field-label" htmlFor="investigation-content">
        {kind === "text" ? "Claim or Content to Investigate" : "Public Webpage Article URL"}
      </label>

      {kind === "text" ? (
        <textarea
          id="investigation-content"
          className="text-input content-textarea"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setMessage("");
          }}
          placeholder="Paste a viral tweet, news quote, online rumor, or claim to verify..."
          maxLength={20000}
          disabled={busy}
          required
        />
      ) : (
        <input
          id="investigation-content"
          className="text-input"
          type="url"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setMessage("");
          }}
          placeholder="https://example.com/news-story"
          maxLength={2048}
          disabled={busy}
          required
        />
      )}

      <div className="field-meta">
        <span>
          {kind === "text"
            ? "Enter the exact claim text for atomic decomposition."
            : "Safe extraction handles public HTTP/HTTPS URLs with redirect tracing."}
        </span>
        <span>{kind === "text" ? `${content.length} / 20,000 chars` : "Public URLs only"}</span>
      </div>

      {/* Optional Context */}
      {kind === "text" && (
        <div style={{ marginBottom: "18px" }}>
          <label className="field-label" htmlFor="investigation-context">
            Investigation Context or Source URL (Optional)
          </label>
          <input
            id="investigation-context"
            className="text-input"
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. Circulating on WhatsApp forwards in November 2026..."
            maxLength={1000}
            disabled={busy}
          />
        </div>
      )}

      {/* Language Selection */}
      <div style={{ marginBottom: "20px" }}>
        <label className="field-label" htmlFor="language">
          Language Setting
        </label>
        <select
          id="language"
          className="text-input select-input"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={busy}
        >
          <option value="auto">Auto-Detect Language</option>
          <option value="en">English</option>
          <option value="te">Telugu (తెలుగు)</option>
          <option value="hi">Hindi (हिन्दी)</option>
        </select>
      </div>

      {/* Responsible AI Guidance Banner */}
      <div className="notice notice-info" style={{ margin: "16px 0 24px" }}>
        <span className="notice-symbol">i</span>
        <p>
          <b>Ground-Truth Guarantee:</b> The investigation pipeline extracts verifiable claims, conducts live Tavily research, and computes an explainable verdict based strictly on cited sources.
        </p>
      </div>

      {/* Submit Button */}
      <button className="button button-primary" type="submit" disabled={busy} style={{ minHeight: "42px", minWidth: "180px", fontSize: "13px" }}>
        {busy ? (
          <>
            <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◷</span>
            Processing Pipeline...
          </>
        ) : (
          <>
            Launch Full Investigation <ArrowRight size={14} />
          </>
        )}
      </button>

      {message && (
        <div className={message.includes("failed") || message.includes("Error") ? "form-message error-message" : "form-message"}>
          {message}
        </div>
      )}
    </form>
  );
}
