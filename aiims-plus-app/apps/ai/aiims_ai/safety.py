"""Safety gates (AIDR-0012 / TDR-0007).

Prompt-injection detection and operational-only enforcement. These are the
release-blocking guardrails: the capability refuses anything that tries to
change the model's instructions or push it toward clinical decision-making.
"""

from __future__ import annotations

import re

_INJECTION_PATTERNS = [
    re.compile(r"ignore (all |the )?(previous|prior|above) (instructions|prompts)", re.IGNORECASE),
    re.compile(r"disregard .*(instruction|rule|policy)", re.IGNORECASE),
    re.compile(r"\byou are now\b", re.IGNORECASE),
    re.compile(r"system prompt", re.IGNORECASE),
    re.compile(r"\bjailbreak\b", re.IGNORECASE),
    re.compile(r"reveal .*(prompt|instructions|system)", re.IGNORECASE),
    re.compile(r"act as .*(admin|root|developer|dan)\b", re.IGNORECASE),
]

# Operational-only: coding assist must never be steered into treatment advice.
_CLINICAL_DECISION_PATTERNS = [
    re.compile(r"what (should|do) (i|we) (prescribe|treat|do)", re.IGNORECASE),
    re.compile(r"recommend .*(treatment|medication|drug|dose|therapy)", re.IGNORECASE),
    re.compile(r"\bdiagnos(e|is)\b.*\?", re.IGNORECASE),
]


class SafetyViolation(Exception):
    """Raised when input trips a safety gate (injection or clinical-decision)."""

    def __init__(self, kind: str) -> None:
        super().__init__(kind)
        self.kind = kind


def assert_safe(text: str) -> None:
    """Raise SafetyViolation if the text trips injection or clinical-decision gates."""
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(text):
            raise SafetyViolation("prompt_injection")
    for pattern in _CLINICAL_DECISION_PATTERNS:
        if pattern.search(text):
            raise SafetyViolation("clinical_decision_out_of_scope")


# Output guard: the label that must accompany every AI output (AIDR-0010).
AI_LABEL = "AI-generated — verify"
