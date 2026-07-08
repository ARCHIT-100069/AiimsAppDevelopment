"""FastAPI surface for the AI plane (AIDR-0003).

Reached ONLY by the core's AiGateway (never by browsers/clients directly). The
core enforces auth, tenant scope, feature flags, and AI audit; this plane
enforces redaction + safety + operational-only output. No PHI is logged here.
"""

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field

from . import __version__
from .capabilities import coding_assist
from .safety import AI_LABEL, SafetyViolation

app = FastAPI(title="aiims-ai", version=__version__)


class SuggestRequest(BaseModel):
    capability: str = Field(pattern="^coding_assist$")
    text: str = Field(min_length=1, max_length=4000)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "aiims-ai", "version": __version__}


@app.post("/v1/ai/suggest")
def suggest(req: SuggestRequest) -> dict[str, object]:
    """Operational suggestion. Returns 200 with a labelled, advisory result;
    a safety violation returns a 4xx-style body the gateway maps to 422."""
    try:
        result = coding_assist(req.text)
    except SafetyViolation as exc:
        return {"error": "safety_violation", "kind": exc.kind, "label": AI_LABEL}
    return {
        "capability": "coding_assist",
        "label": result.label,
        "suggestions": result.suggestions,
        "redactionApplied": result.redaction_applied,
        "provider": result.provider,
        "disclaimer": result.disclaimer,
    }
