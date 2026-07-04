"""AIIMS+ AI plane — Stage 0 stub (AIDR-0003).

Operational-only by Constitution (AI-ARCHITECTURE §3): no diagnosis, no
treatment recommendations, no autonomous clinical decisions, no write path to
clinical records. The core reaches this plane ONLY through the AiGateway port
(mocked in Stage 0); real capabilities activate in Stage 7 behind feature
flags, PHI redaction (AIDR-0008), and release-blocking safety evals
(AIDR-0012/TDR-0007).

Typed per Master Plan §29 (mypy); no PHI is ever logged here (SDR-0010).
"""

from fastapi import FastAPI

app = FastAPI(title="aiims-ai", version="0.0.0")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "aiims-ai", "version": "0.0.0"}
