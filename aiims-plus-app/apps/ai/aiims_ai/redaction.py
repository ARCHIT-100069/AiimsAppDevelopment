"""PHI redaction pipeline (AIDR-0008).

Removes direct identifiers from clinical text BEFORE it ever reaches a model
provider. Conservative by design: over-redaction is safe, under-redaction is
not. No PHI is logged anywhere in this plane (SDR-0010).
"""

from __future__ import annotations

import re

# Direct-identifier patterns. Order matters (longest/most-specific first).
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("EMAIL", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
    # ABHA address (name@abdm) — a routable handle.
    ("ABHA_ADDRESS", re.compile(r"\b[A-Za-z0-9._]{3,}@(?:abdm|sbx|pbx)\b")),
    # 14-digit ABHA number, optionally hyphen-grouped.
    ("ABHA", re.compile(r"\b\d{2}-?\d{4}-?\d{4}-?\d{4}\b")),
    # MRN-000123 style medical record numbers.
    ("MRN", re.compile(r"\bMRN[-\s]?\d{3,}\b", re.IGNORECASE)),
    # E.164-ish phone numbers.
    ("PHONE", re.compile(r"\+?\d[\d \-]{7,}\d")),
    # Long bare digit runs (ids); keep short clinical numbers like "38.5".
    ("ID", re.compile(r"\b\d{7,}\b")),
]


def redact(text: str) -> tuple[str, bool]:
    """Return (redacted_text, applied). `applied` is True if anything changed."""
    redacted = text
    for label, pattern in _PATTERNS:
        redacted = pattern.sub(f"[REDACTED_{label}]", redacted)
    return redacted, redacted != text
