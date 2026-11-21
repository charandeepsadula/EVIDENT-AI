import asyncio
import base64
import hashlib
import json
import logging
import shutil
import tempfile
from pathlib import Path
from typing import Any

import httpx
from docx import Document
from PIL import ExifTags, Image
from PIL import __version__ as pillow_version
from pypdf import PdfReader

from app.core.config import settings

logger = logging.getLogger(__name__)


class ToolUnavailable(Exception):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def difference_hash(image: Image.Image) -> str:
    gray = image.convert("L").resize((9, 8))
    pixels = list(gray.getdata())
    value = 0
    for row in range(8):
        for col in range(8):
            value = (value << 1) | int(pixels[row * 9 + col] > pixels[row * 9 + col + 1])
    return f"{value:016x}"


def analyze_image(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        if image.width * image.height > 50_000_000:
            raise ValueError("Image exceeds the maximum supported pixel dimensions.")
        image.verify()
    with Image.open(path) as image:
        exif = image.getexif()
        exif_names = {str(ExifTags.TAGS.get(tag, tag)) for tag in exif.keys()}
        exif_values = {ExifTags.TAGS.get(tag, tag): value for tag, value in exif.items()}
        try:
            exif_values.update({ExifTags.TAGS.get(tag, tag): value for tag, value in exif.get_ifd(ExifTags.IFD.Exif).items()})
        except (AttributeError, KeyError, TypeError):
            pass
        phash = difference_hash(image)
        findings = [
            {"indicator": "image_dimensions", "finding": f"Image is {image.width} × {image.height} pixels ({image.format or 'unknown format'}).", "tool_name": "Pillow", "tool_version": pillow_version, "limitations": "Dimensions and format do not establish authenticity."},
            {"indicator": "exif_metadata", "finding": f"EXIF metadata {'is present' if exif else 'was not found'}; GPS fields {'are present' if any('GPS' in name for name in exif_names) else 'were not found'}.", "tool_name": "Pillow EXIF", "tool_version": pillow_version, "limitations": "Metadata can be edited or stripped; GPS values are not stored by this processor."},
        ]
        capture_time = next((exif_values.get(name) for name in ("DateTimeOriginal", "DateTimeDigitized", "DateTime") if exif_values.get(name)), None)
        if capture_time:
            findings.append({"indicator": "exif_capture_time", "finding": f"EXIF records a capture time of {str(capture_time)[:40]} (device-supplied and not independently verified).", "tool_name": "Pillow EXIF", "tool_version": pillow_version, "limitations": "EXIF timestamps may be edited or incorrect and do not establish when an image was actually created."})
        camera = " ".join(str(exif_values.get(name, "")).strip() for name in ("Make", "Model") if exif_values.get(name))
        if camera:
            findings.append({"indicator": "exif_camera", "finding": f"EXIF camera make/model: {camera[:160]}.", "tool_name": "Pillow EXIF", "tool_version": pillow_version, "limitations": "Camera metadata can be edited or copied from another file."})
        raw = path.read_bytes()
        if b"c2pa" in raw.lower():
            findings.append({"indicator": "c2pa_marker", "finding": "A C2PA marker string was detected. The credential signature was not validated.", "tool_name": "C2PA marker scan", "tool_version": "1", "limitations": "Marker presence alone is not proof of valid provenance."})
        else:
            findings.append({"indicator": "c2pa_marker", "finding": "No C2PA marker string was detected.", "tool_name": "C2PA marker scan", "tool_version": "1", "limitations": "Credentials may be absent, removed, or stored in another representation; this is not evidence of manipulation."})
        return {"findings": findings, "perceptual_hash": phash, "metadata": {"width": image.width, "height": image.height, "format": image.format}}


async def analyze_image_with_ai(path: Path, mime_type: str = "image/jpeg") -> dict[str, Any]:
    """Run standard Pillow forensic extraction and enrich with Gemini Vision analysis if configured."""
    base_result = analyze_image(path)
    findings = list(base_result.get("findings", []))
    
    if not settings.gemini_api_key:
        findings.append({
            "indicator": "ai_vision_analysis",
            "finding": "Gemini API key is not configured; AI visual scene inspection was skipped.",
            "tool_name": "Gemini Vision",
            "tool_version": None,
            "limitations": "Provide GEMINI_API_KEY to enable AI visual inspection."
        })
        base_result["findings"] = findings
        return base_result

    try:
        raw_bytes = path.read_bytes()
        b64_data = base64.b64encode(raw_bytes).decode("utf-8")
        vision_model = settings.gemini_model.strip() or "gemini-3.5-flash-lite"
        
        prompt = (
            "You are an expert digital forensics investigator and media intelligence analyst. "
            "Analyze this submitted image carefully and provide an objective, evidence-based assessment. "
            "Follow these guidelines strictly:\n"
            "1. Scene Description: Describe the primary subjects, background, and visual context.\n"
            "2. Extracted Text (OCR): Transcribe any visible textual elements, signs, watermarks, or overlays accurately (or note 'No text detected').\n"
            "3. Visual Observations: Note lighting consistency, shadow direction, perspective alignment, edge artifacts, compression patterns, or unnatural digital noise.\n"
            "4. AI/Synthetic Indicators: Note whether there are hallmarks commonly seen in AI-generated imagery (e.g. skin over-smoothing, distorted background text, anatomical inconsistencies, unusual blending) or if it appears consistent with standard photographic capture.\n"
            "5. Caveat: State clearly that visual inspection is descriptive and is NOT definitive proof of authenticity or manipulation.\n\n"
            "Return a JSON object with these keys: scene_description, visible_text, visual_observations, synthetic_media_indicators, forensic_summary."
        )

        schema = {
            "type": "OBJECT",
            "properties": {
                "scene_description": {"type": "STRING"},
                "visible_text": {"type": "STRING"},
                "visual_observations": {"type": "STRING"},
                "synthetic_media_indicators": {"type": "STRING"},
                "forensic_summary": {"type": "STRING"}
            },
            "required": ["scene_description", "visible_text", "visual_observations", "synthetic_media_indicators", "forensic_summary"]
        }

        payload = {
            "contents": [{
                "parts": [
                    {"inlineData": {"mimeType": mime_type, "data": b64_data}},
                    {"text": prompt}
                ]
            }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": schema
            }
        }

        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{vision_model}:generateContent"
        async with httpx.AsyncClient(timeout=httpx.Timeout(35.0, connect=10.0)) as client:
            resp = await client.post(endpoint, headers={"x-goog-api-key": settings.gemini_api_key}, json=payload)
            if resp.status_code == 200:
                resp_data = resp.json()
                candidates = resp_data.get("candidates") or []
                if candidates:
                    parts = (candidates[0].get("content") or {}).get("parts") or []
                    text_out = "".join(p.get("text", "") for p in parts if isinstance(p, dict) and "text" in p)
                    if text_out:
                        parsed = json.loads(text_out)
                        if parsed.get("scene_description"):
                            findings.append({
                                "indicator": "ai_scene_analysis",
                                "finding": f"Scene Context: {parsed['scene_description']}",
                                "tool_name": f"Gemini Vision ({vision_model})",
                                "tool_version": vision_model,
                                "limitations": "AI visual description is for contextual assistance and does not replace human verification."
                            })
                        if parsed.get("visible_text") and parsed["visible_text"] != "No text detected":
                            findings.append({
                                "indicator": "ai_ocr_text",
                                "finding": f"Visible Text / Inscriptions: {parsed['visible_text']}",
                                "tool_name": f"Gemini Vision OCR",
                                "tool_version": vision_model,
                                "limitations": "OCR extraction may omit degraded, stylized, or low-resolution text."
                            })
                        if parsed.get("visual_observations") or parsed.get("synthetic_media_indicators"):
                            findings.append({
                                "indicator": "ai_visual_forensics",
                                "finding": f"Visual & Synthesis Observations: {parsed.get('synthetic_media_indicators', '')} | {parsed.get('visual_observations', '')}",
                                "tool_name": f"Gemini Visual Intelligence",
                                "tool_version": vision_model,
                                "limitations": "Visual heuristic inspection cannot definitively prove authenticity or synthetic manipulation."
                            })
            else:
                logger.warning("Gemini vision analysis returned non-200 status: %s", resp.status_code)
                findings.append({
                    "indicator": "ai_vision_status",
                    "finding": f"Gemini Vision service returned HTTP {resp.status_code}. EXIF metadata was analyzed successfully.",
                    "tool_name": "Gemini Vision",
                    "tool_version": vision_model,
                    "limitations": "API rate limit, model availability, or quota limits may apply."
                })
    except Exception as exc:
        logger.warning("Gemini vision analysis failed: %s", exc)
        findings.append({
            "indicator": "ai_vision_error",
            "finding": f"AI visual content inspection was skipped due to temporary service unavailability ({type(exc).__name__}).",
            "tool_name": "Gemini Vision",
            "tool_version": None,
            "limitations": "Offline/fallback mode retained; metadata extraction remains valid."
        })

    base_result["findings"] = findings
    return base_result


async def _ffprobe(path: Path) -> dict[str, Any]:
    executable = shutil.which("ffprobe")
    if not executable:
        raise ToolUnavailable("FFprobe is not installed on the worker.")
    process = await asyncio.create_subprocess_exec(executable, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    try:
        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=35)
    except TimeoutError as exc:
        process.kill()
        await process.wait()
        raise ToolUnavailable("Media metadata extraction timed out.") from exc
    if process.returncode != 0:
        raise ValueError("Media container could not be parsed.")
    return json.loads(stdout[:2_000_000])


async def analyze_av(path: Path, media_type: str) -> dict[str, Any]:
    data = await _ffprobe(path)
    info = data.get("format", {})
    streams = data.get("streams", [])
    duration = float(info.get("duration") or 0)
    kinds = [stream for stream in streams if stream.get("codec_type") == media_type]
    if not kinds:
        raise ValueError(f"No {media_type} stream found in the uploaded file.")
    findings = [{"indicator": "container_metadata", "finding": f"Container {info.get('format_name','unknown')}; duration {duration:.2f} seconds; codec {kinds[0].get('codec_name','unknown')}.", "tool_name": "FFprobe", "tool_version": "system", "limitations": "Container metadata may be edited and does not establish authenticity."}]
    metadata = {"duration_seconds": duration, "codec": kinds[0].get("codec_name"), "format": info.get("format_name")}
    frames: list[dict[str, Any]] = []
    if media_type == "video":
        metadata.update({"width": kinds[0].get("width"), "height": kinds[0].get("height")})
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            findings.append({"indicator": "frame_extraction_unavailable", "finding": "FFmpeg is not installed; video frames were not extracted.", "tool_name": "FFmpeg", "tool_version": None, "limitations": "No frame-level analysis was run."})
        elif duration <= 0 or duration > 3 * 60 * 60:
            findings.append({"indicator": "frame_extraction_limit", "finding": "Video duration is missing or exceeds the three-hour frame sampling limit.", "tool_name": "FFmpeg", "tool_version": None, "limitations": "Frame sampling was skipped due to the configured processing limit."})
        else:
            count = min(6, max(1, int(duration // 30) + 1))
            positions = sorted({round((duration - 0.25) * index / max(1, count - 1), 3) for index in range(count)})
            with tempfile.TemporaryDirectory(prefix="evident-frames-") as directory:
                for index, timestamp in enumerate(positions):
                    frame_path = Path(directory) / f"frame-{index:02d}.jpg"
                    process = await asyncio.create_subprocess_exec(ffmpeg, "-nostdin", "-v", "error", "-ss", str(timestamp), "-i", str(path), "-frames:v", "1", "-vf", "scale=320:-1", "-y", str(frame_path), stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
                    try:
                        await asyncio.wait_for(process.wait(), timeout=18)
                    except TimeoutError:
                        process.kill()
                        await process.wait()
                        continue
                    if process.returncode == 0 and frame_path.exists():
                        with Image.open(frame_path) as image:
                            frames.append({"timestamp_ms": int(timestamp * 1000), "perceptual_hash": difference_hash(image)})
            counts: dict[str, int] = {}
            for frame in frames:
                counts[frame["perceptual_hash"]] = counts.get(frame["perceptual_hash"], 0) + 1
            duplicates = [frame for frame in frames if counts[frame["perceptual_hash"]] > 1]
            if duplicates:
                for frame in duplicates:
                    findings.append({"indicator": "sampled_frame_duplicate", "finding": "This sampled frame matched another sampled frame by perceptual hash.", "tool_name": "Perceptual hash", "tool_version": "difference-hash-v1", "timestamp_ms": frame["timestamp_ms"], "limitations": "A repeated sampled frame can be intentional and is not proof of manipulation."})
    return {"findings": findings, "metadata": metadata, "frames": frames}


def extract_document(path: Path, mime_type: str, limit: int = 20000) -> dict[str, Any]:
    if mime_type == "application/pdf":
        reader = PdfReader(path, strict=False)
        text = "\n".join((page.extract_text() or "") for page in reader.pages)[:limit]
        return {"text": text, "pages": len(reader.pages), "metadata_fields": len(reader.metadata or {})}
    if mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        document = Document(path)
        text = "\n".join(paragraph.text for paragraph in document.paragraphs)[:limit]
        return {"text": text, "pages": None, "metadata_fields": 0}
    if mime_type == "text/plain":
        text = path.read_text(encoding="utf-8", errors="replace")[:limit]
        return {"text": text, "pages": None, "metadata_fields": 0}
    raise ValueError("Unsupported document format.")
