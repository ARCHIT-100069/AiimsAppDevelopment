# apps/ai — isolated Python AI plane (stub)

**Status:** Stage 0 stub. Health endpoint only; not part of the pnpm workspace (own runtime,
AIDR-0003). Activates in **Stage 7** behind feature flags + HITL + release-blocking safety evals.

**The AI Constitution (non-negotiable):** AI assists operations only. It never diagnoses, never
prescribes, never makes autonomous clinical decisions; doctors decide. Enforced by architecture:
the core reaches AI only via the `AiGateway` port, PHI is redacted before any model call
(AIDR-0008), every interaction is audited (AIDR-0011), and AI failure never blocks care
(AIDR-0014).

Run locally (optional):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn main:app --port 8000
curl localhost:8000/healthz
```
