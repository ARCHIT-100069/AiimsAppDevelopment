"""The one operational capability shipped in Stage 7: ICD-10 coding assist.

Pipeline (every step is a Constitution gate):
  1. safety guard (injection / clinical-decision) — refuse if tripped;
  2. PHI redaction (AIDR-0008) — nothing identifying reaches the provider;
  3. provider.complete on the REDACTED text;
  4. parse to structured, bounded, labelled suggestions (AIDR-0010);
  5. any failure → empty suggestions, never an exception to the caller (AIDR-0014).
The output is ADVISORY: it is never written to clinical records here.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from .providers import AiProvider, provider_from_env
from .redaction import redact
from .safety import AI_LABEL, SafetyViolation, assert_safe

_DISCLAIMER = (
    "Operational assistance only. Suggestions are advisory, must be verified by a "
    "clinician, and are never applied automatically (AI Constitution)."
)

_ICD10 = __import__("re").compile(r"^[A-TV-Z][0-9][0-9AB](?:\.[0-9A-Z]{1,4})?$")


@dataclass
class CodingResult:
    suggestions: list[dict[str, object]] = field(default_factory=list)
    redaction_applied: bool = False
    provider: str = "mock"
    label: str = AI_LABEL
    disclaimer: str = _DISCLAIMER


def coding_assist(text: str, provider: AiProvider | None = None) -> CodingResult:
    provider = provider or provider_from_env()

    # 1. Safety gate FIRST (on the raw text) — refuse injection / out-of-scope.
    assert_safe(text)  # raises SafetyViolation upstream → 422

    # 2. Redact before the model sees anything.
    redacted, applied = redact(text)

    # 3–5. Provider call + tolerant parse; failure ⇒ empty (care never blocked).
    raw = provider.complete(capability="coding_assist", prompt=redacted)
    suggestions = _parse(raw)
    return CodingResult(
        suggestions=suggestions,
        redaction_applied=applied,
        provider=provider.name,
    )


def _parse(raw: str) -> list[dict[str, object]]:
    try:
        data = json.loads(raw)
        items = data.get("suggestions", []) if isinstance(data, dict) else []
    except Exception:
        return []
    out: list[dict[str, object]] = []
    for item in items[:10]:
        code = str(item.get("code", "")).strip().upper()
        display = str(item.get("display", "")).strip()
        if not code or not display or not _ICD10.match(code):
            continue  # drop anything that isn't a well-formed ICD-10 code
        try:
            confidence = float(item.get("confidence", 0.5))
        except Exception:
            confidence = 0.5
        confidence = max(0.0, min(1.0, confidence))
        out.append(
            {"code": {"system": "icd-10", "code": code, "display": display}, "confidence": confidence}
        )
    return out
