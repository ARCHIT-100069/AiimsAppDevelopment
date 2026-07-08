"""AIIMS+ AI plane entrypoint (Stage 7, AIDR-0003).

Operational-only by Constitution (AI-ARCHITECTURE §3): no diagnosis, no
treatment recommendations, no autonomous clinical decisions, no write path to
clinical records. The core reaches this plane ONLY through the AiGateway port.
Activates behind feature flags, PHI redaction (AIDR-0008), and release-blocking
safety evals (AIDR-0012/TDR-0007). No PHI is ever logged here (SDR-0010).

Run: uvicorn main:app --port 8000
"""

from aiims_ai.app import app

__all__ = ["app"]
