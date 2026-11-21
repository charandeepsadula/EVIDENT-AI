"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, apiUpload } from "@/lib/api";
import {
  ImageIcon,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Cpu
} from "@/components/icons";

export type MediaKind = "image" | "video" | "audio" | "document";

const configs: Record<
  MediaKind,
  {
    title: string;
    description: string;
    accept: string;
    types: string[];
    max: number;
    checks: string[];
  }
> = {
  image: {
    title: "Digital Image Forensics Lab",
    description:
      "Inspect image EXIF metadata, camera specifications, capture timestamps, C2PA provenance credentials, and Gemini Vision multimodal scene analysis.",
    accept: "image/jpeg,image/png,image/webp,image/tiff",
    types: ["image/jpeg", "image/png", "image/webp", "image/tiff"],
    max: 25,
    checks: [
      "EXIF hardware metadata & camera make/model",
      "Capture timestamps & device time logs",
      "Missing metadata detection (stripped EXIF)",
      "C2PA content provenance credential scan",
      "Perceptual hashing (dHash) & dimensions",
      "Gemini Vision multimodal scene & OCR analysis",
      "Privacy guarantee: Geolocation (GPS) sanitized",
    ],
  },
  video: {
    title: "Video Forensics Lab",
    description: "Prepare video streams for container metadata and frame inspection.",
    accept: "video/mp4,video/quicktime,video/webm",
    types: ["video/mp4", "video/quicktime", "video/webm"],
    max: 100,
    checks: ["Container metadata", "Frame rate & duration", "Audio alignment"],
  },
  audio: {
    title: "Audio Forensics Lab",
    description: "Prepare audio media for transcription and signal analysis.",
    accept: "audio/mpeg,audio/wav,audio/mp4",
    types: ["audio/mpeg", "audio/wav", "audio/mp4"],
    max: 50,
    checks: ["Audio container metadata", "Duration & sample rate"],
  },
  document: {
    title: "Document Investigation Lab",
    description: "Analyze PDF and text documents for embedded claims and metadata.",
    accept: "application/pdf,text/plain",
    types: ["application/pdf", "text/plain"],
    max: 25,
    checks: ["Document metadata", "Embedded text extraction"],
  },
};

export function MediaLab({ kind }: { kind: MediaKind }) {
  const config = configs[kind];
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function validate(candidate?: File) {
    setMessage("");
    if (!candidate) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!config.types.includes(candidate.type)) {
      setFile(null);
      setPreviewUrl(null);
      setMessage("Unsupported format. Please upload JPG, PNG, WebP, or TIFF.");
      return;
    }
    if (candidate.size > config.max * 1024 * 1024) {
      setFile(null);
      setPreviewUrl(null);
      setMessage(`File exceeds maximum allowed size of ${config.max} MB.`);
      return;
    }
    setFile(candidate);
    if (candidate.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(candidate));
    }
  }

  function changed(event: ChangeEvent<HTMLInputElement>) {
    validate(event.target.files?.[0]);
  }

  function dropped(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    validate(event.dataTransfer.files?.[0]);
  }

  async function analyze() {
    if (!file) {
      setMessage("Please choose an image file first.");
      return;
    }

    const isSupabaseConfigured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
    const isLocal = !isSupabaseConfigured || process.env.NEXT_PUBLIC_LOCAL_DEV_MODE === "true";

    if (isLocal) {
      setBusy(true);
      setMessage("Analyzing image EXIF metadata and running Gemini Vision inspection...");
      try {
        const result = await apiUpload<{ id: string; status: string }>(
          "/investigations/local-image",
          file
        );
        router.push(`/investigations/${result.id}`);
      } catch (reason) {
        setMessage(reason instanceof Error ? reason.message : "Image analysis failed.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setBusy(true);
    setMessage("Creating private investigation record...");
    try {
      const created = await apiFetch<{ id: string }>("/investigations/uploads", {
        method: "POST",
        body: JSON.stringify({
          submitted_type: kind,
          title: file.name.replace(/\.[^.]+$/, ""),
          language: "auto",
        }),
      });
      const investigationId = created.id;
      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `${investigationId}/${crypto.randomUUID()}.${ext}`;

      const upload = await supabase.storage
        .from("investigation-files")
        .upload(storagePath, file, { cacheControl: "0", contentType: file.type });
      if (upload.error) throw new Error(upload.error.message);

      await apiFetch(`/investigations/${investigationId}/files`, {
        method: "POST",
        body: JSON.stringify({
          storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        }),
      });

      await apiFetch(`/investigations/${investigationId}/analyze-media`, { method: "POST" });
      router.push(`/investigations/${investigationId}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceShell active="Image Lab">
      <div className="page-content narrow-content">
        <PageHeading
          eyebrow="DIGITAL MEDIA INTELLIGENCE"
          title={config.title}
          description={config.description}
        />

        <div className="lab-layout">
          {/* Upload Area */}
          <section className="form-card lab-card">
            <label className="field-label">Upload Digital Image for Forensic Inspection</label>
            <div
              className={`dropzone ${file ? "active" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={dropped}
              onClick={() => input.current?.click()}
            >
              {previewUrl ? (
                <div style={{ textAlign: "center", marginBottom: "12px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{
                      maxHeight: "160px",
                      maxWidth: "100%",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      objectFit: "contain",
                      margin: "0 auto",
                    }}
                  />
                  <div style={{ fontSize: "11px", color: "var(--text)", marginTop: "8px", fontWeight: 600 }}>
                    {file?.name}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--muted)" }}>
                    {(Number(file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB &bull; {file?.type}
                  </div>
                </div>
              ) : (
                <>
                  <span className="drop-icon">
                    <ImageIcon size={24} />
                  </span>
                  <b>Drag & drop an image or click to browse</b>
                  <p>Supports JPG, JPEG, PNG, WebP (Max {config.max} MB)</p>
                </>
              )}

              <button
                className="button button-secondary button-sm"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  input.current?.click();
                }}
              >
                {file ? "Choose Different Image" : "Browse Files"}
              </button>
              <input
                ref={input}
                className="visually-hidden"
                type="file"
                accept={config.accept}
                onChange={changed}
              />
            </div>

            {/* Validation Notice */}
            {file && (
              <div className="notice notice-info" style={{ margin: "14px 0" }}>
                <span className="notice-symbol">✓</span>
                <p>
                  <b>File Validated:</b> Ready to inspect EXIF metadata, C2PA markers, and trigger Gemini Vision visual analysis.
                </p>
              </div>
            )}

            {message && (
              <p className={`form-message ${busy ? "" : "error-message"}`} role="status">
                {message}
              </p>
            )}

            <button
              className="button button-primary form-submit"
              type="button"
              onClick={() => void analyze()}
              disabled={busy || !file}
              style={{ marginTop: "14px", width: "100%", minHeight: "42px" }}
            >
              {busy ? "Analyzing Image Forensics..." : "Run Forensic & Vision Analysis →"}
            </button>
          </section>

          {/* Analysis Methodology & Caveats Panel */}
          <aside className="panel checks-panel">
            <div className="panel-head">
              <div>
                <h2>Forensic Inspection Protocol</h2>
                <p>Automated verification steps performed</p>
              </div>
            </div>

            <ul className="check-list">
              {config.checks.map((check) => (
                <li key={check}>
                  <CheckCircle2 size={14} style={{ color: "var(--green)", flex: "none" }} />
                  <span>{check}</span>
                </li>
              ))}
            </ul>

            {/* Responsible Forensic Caveat */}
            <div className="limitation-note" style={{ marginTop: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <AlertTriangle size={14} style={{ color: "var(--amber)" }} />
                <b style={{ color: "var(--amber)", fontSize: "11px" }}>Forensic Boundary Notice</b>
              </div>
              <p style={{ margin: 0, fontSize: "10.5px", color: "var(--muted)", lineHeight: "1.6" }}>
                Metadata (EXIF) can be stripped or modified; its presence or absence does not prove manipulation.
                AI visual inspection provides descriptive observations and does not constitute cryptographic proof of deepfakes or authenticity.
              </p>
            </div>
          </aside>
        </div>

        <div style={{ marginTop: "24px" }}>
          <Link href="/dashboard" style={{ fontSize: "11px", color: "var(--orange)" }}>
            &larr; Return to Dashboard
          </Link>
        </div>
      </div>
    </WorkspaceShell>
  );
}
