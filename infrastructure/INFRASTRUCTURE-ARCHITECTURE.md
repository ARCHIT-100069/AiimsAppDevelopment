# AIIMS+ — Infrastructure & DevOps Architecture (Phase 8)

**Version:** 1.0 · **Owner:** Cloud & Infrastructure Architect · **Status:** **Frozen (canonical, approved 2026-07-04)**
**Dependencies:** `../architecture/ARCHITECTURE-BLUEPRINT.md` (§17–§26), ADR 0001/0007, `../security/SECURITY-BLUEPRINT.md`
(§17/§18/§24, SDR-0005/0006/0008/0012), `../database/DATABASE-ARCHITECTURE.md`, `../backend/`, `../ai/`
**Last Updated:** 2026-07-04 · **Review Trigger:** GOVERNANCE.md §6 flaw process; new region/environment; cloud posture change.

Canonical infrastructure & DevOps reference for AIIMS+. It **builds on** the frozen phases and does not
redesign them. Decisions are recorded as **IDRs**. Consistency review is in §29, freeze report in §30. No
implementation code (Terraform is described, not written here).

**Inherited & non-negotiable:** modular monolith on **ECS Fargate**, not EKS (ADR 0001); **AWS `ap-south-1`
primary, `ap-south-2` DR** (ADR 0007); Aurora PostgreSQL + RLS (DDR 0002); private data tier, WAF, KMS
CMK hierarchy, Secrets Manager (SDR-0005/0006/0008); IaC + CI security gates (SDR-0012); isolation-test and
AI-eval gates are merge-blocking. **This phase resolves the previously-deferred RPO/RTO targets (§19).**

---

## 1. AWS Account Strategy — IDR-0001

**AWS Organizations, multi-account** for blast-radius isolation and least privilege:
- **Management** (org root, billing, SCPs) — no workloads.
- **Security/Log-archive** (centralized CloudTrail, GuardDuty, Config, audit-log archive) — write-once.
- **Shared-services** (ECR, CI runners/OIDC, Route53, shared DNS).
- **Dev**, **Staging**, **Production** — one account each, hard-isolated.
- **SCPs** enforce region allow-list (India regions), deny public-S3/PHI egress, and guardrails.

*Rationale:* separate accounts give the strongest isolation between prod PHI and lower envs and cap the
blast radius of a compromised credential (SDR assume-breach). *Alternative rejected:* single account with
tags/IAM only — weak isolation, easy cross-env mistakes.

## 2. Multi-Environment Architecture — IDR-0002

- **Dev** (fast iteration, synthetic data only — **no PHI**), **Staging** (prod-like, synthetic/anonymized
  data, integration + eval + isolation gates), **Production** (real PHI, hardened).
- **Parity:** all envs provisioned from the **same Terraform modules**, differing only by variables
  (sizing, replicas, flags) — eliminates config drift.
- Promotion path: PR → dev → staging (gated) → prod (approved, canary). Prod is the only account with PHI.

## 3. VPC Architecture — IDR-0003

Per environment, a VPC spanning **≥2 AZs** (3 in prod) with a three-tier subnet model:
- **Public subnets:** ALB + NAT gateways only.
- **Private app subnets:** ECS Fargate tasks (api, workers, ai-plane, keycloak).
- **Isolated data subnets:** Aurora, ElastiCache — **no route to the internet**.
- VPC endpoints (S3, ECR, Secrets Manager, KMS, CloudWatch) keep AWS traffic off the public internet.

## 4. Networking & Security Groups — IDR-0003 (implements SDR-0008)

- **Default-deny** security groups; least-privilege ingress/egress by tier (ALB→app, app→data only).
- **No public endpoint** on Aurora/Redis. Egress restricted via NAT + endpoint policies; **external model
  egress** (AI) is allow-listed and residency-constrained (AIDR-0004).
- **WAF** on the ALB (OWASP + rate rules); AWS Shield Standard; flow logs to the security account.

## 5. ECS / Fargate Architecture — IDR-0004

Separate Fargate **services**, independently scaled, in private subnets:
- `api` (NestJS monolith), `workers` (BullMQ), `ai-plane` (Python/FastAPI, flagged), `keycloak`.
- Task roles are least-privilege (per-service IAM); no SSH; service discovery via ALB/Cloud Map.
- **No EKS/Kubernetes** (ADR 0001) — Fargate removes cluster/node ops for a small team.

## 6. Container Strategy — IDR-0005

- **One image per service**, immutable, tagged by git SHA; stored in **ECR** (scan-on-push).
- Runtime config via env + Secrets Manager (never baked in). Rollback = redeploy a prior image tag.
- Multi-arch as needed; images are the single deploy artifact across envs (build once, promote).

## 7. Docker Standards — IDR-0005 (implements SDR-0012)

- **Multi-stage builds**, **minimal/distroless base**, **non-root** user, read-only root FS where possible,
  pinned base digests, no secrets/build args with secrets, `.dockerignore` hygiene.
- **Image scanning** (ECR/Trivy) + SBOM in CI; **signing/provenance** (cosign/SLSA) in Production.

## 8. Aurora PostgreSQL Deployment — IDR-0006 (implements DDR 0002, ADR 0007)

- **Aurora PostgreSQL, Multi-AZ** (writer + ≥1 reader) in `ap-south-1`; **RDS Proxy** for pooling +
  failover (supports the `SET LOCAL` tenant-context model, DB §2).
- **Read replicas** for read models/reporting (`aiims_readonly`); **pgvector** enabled for RAG (AIDR-0006).
- **Encryption at rest (KMS)**, TLS-required connections, private subnets only. **PITR** enabled; automated
  backups; **cross-region snapshot copy to `ap-south-2`** (§19/§20).
- Version target Aurora PG 16+, adopting PG 18 features (native `uuidv7`) when Aurora GAs them.

## 9. Redis Deployment — IDR-0007

- **ElastiCache for Redis, Multi-AZ** with automatic failover; **encryption in transit + at rest (KMS)**;
  private subnets; AUTH enabled. Uses: cache, rate limiting, BullMQ queues (backend §15).

## 10. Object Storage (S3) — IDR-0008 (implements SDR-0004, Blueprint §16/§19)

- **Private buckets**, **Block Public Access** enforced org-wide; **SSE-KMS**; per-tenant key prefixes;
  access via **presigned URLs** only. **Object Lock (WORM)** for audit archive + legally-retained docs.
- Lifecycle/tiering driven by retention policy (ADR 0009). Cross-region replication for critical buckets (§20).

## 11. CDN Strategy — IDR-0008

- **CloudFront** in front of the web app's static assets and the marketing/status surface; TLS via ACM;
  WAF association. **No PHI cached at the CDN** — authenticated API/PHI responses bypass the CDN (private,
  no-store). CDN serves only public/static content and the Next.js static layer.

## 12. Load Balancing — IDR-0009

- **Application Load Balancer** (per env) terminates TLS (ACM), routes to Fargate services, health checks,
  and integrates **WAF**. Supports **blue/green + canary** target groups (§24). SSE (APDR-0009) works over
  ALB HTTP; WebSockets deferred (would need ALB WS config).

## 13. DNS Architecture — IDR-0009

- **Route 53** hosted zones (in shared-services); per-env subdomains; health-check-based failover records
  for DR (§19). ACM-managed certs; DNSSEC where supported. Private hosted zones for internal service DNS.

## 14. Secrets Manager & KMS — IDR-0010 (implements SDR-0005/0006)

- **KMS CMK hierarchy:** separate CMKs for DB storage, S3, secrets, and **PHI field-data keys** (envelope
  encryption per DDR 0006/SDR-0005); auto-rotation; least-privilege key policies; **no standing human
  access** to the prod PHI CMK. **Per-tenant CMK** option for dedicated tenants (Production).
- **AWS Secrets Manager** for all runtime secrets (DB, Keycloak, provider keys), injected via task roles,
  rotation enabled; **nothing sensitive in images/repo** (SDR-0006).

## 15. CI/CD Pipelines — IDR-0011 (implements SDR-0012)

- **GitHub Actions**, **OIDC-federated short-lived AWS creds** (no long-lived keys). Pipeline:
  lint → typecheck → unit → **integration (RLS)** → **cross-tenant isolation gate** → **AI safety/eval gate**
  → SAST/dep/secret/container/IaC scans → build image → push ECR → deploy (env-gated).
- **Protected branches**, required reviews, security review for authz/RLS/crypto/secrets/infra changes.
- Separate pipelines for **web** and **mobile** builds (§27). All gates are **merge/deploy-blocking**.

## 16. Terraform / IaC — IDR-0012

- **Terraform** for 100% of infrastructure; **remote state** (S3 + DynamoDB lock) per account; reusable
  **modules** (vpc, ecs-service, aurora, redis, s3, cloudfront, alb, kms, observability); environments are
  module instantiations with different variables (parity, §2).
- **IaC scanning** (tfsec/checkov) + plan review in CI; **no ClickOps** in staging/prod; drift detection.

## 17. Observability (logs, metrics, traces) — IDR-0013 (implements SDR-0010)

- **OpenTelemetry** everywhere → traces (API→workers→AI plane), RED metrics, **structured JSON logs with
  correlation + tenant + actor ids and NO PHI**. Backends: CloudWatch + a managed OTel/Grafana stack.
- **Audit log** archived to WORM (security account); log retention per policy; centralized in the
  security/log-archive account (§1).

## 18. Monitoring & Alerting — IDR-0013

- **SLOs** per service (latency/error/availability) with error budgets; alerts on SLO burn, 5xx spikes,
  queue backlog, DB/replica lag, **RLS/isolation anomalies**, **audit-integrity failures**, cost spikes,
  and AI guardrail/eval-regression triggers. Paging via on-call (Ops phase defines rotations). Synthetic
  canaries for the OPD hero flow.

## 19. Disaster Recovery — IDR-0014 (implements ADR 0007; resolves deferred RPO/RTO)

- **In-region resilience:** Multi-AZ Aurora + Fargate across AZs → automatic failover in minutes.
- **Cross-region DR:** `ap-south-2` — Aurora cross-region backups/snapshots, S3 CRR, audit WORM replicated,
  IaC redeployable, Route53 failover.
- **Proposed targets (this phase sets them; business RTO sign-off pending):**
  **RPO ≤ 5 minutes** (Aurora continuous backup/PITR); **in-region RTO ≤ 30 minutes** (AZ failover);
  **cross-region RTO ≤ 2 hours** for MVP, tightened toward ≤ 1 hour approaching scale.
- **DR is tested** (game-days), not assumed; restores re-apply RLS/roles/secrets — no weakened posture.

## 20. Backup & Restore — IDR-0014

- **Aurora:** automated backups + **PITR**; periodic snapshots; cross-region copy. **S3:** versioning +
  CRR; Object Lock for WORM data. **Redis:** it's a cache/queue — treated as reproducible, not a backup
  source of truth. **Restore runbooks** versioned (Ops phase); backups + restore actions are **audited**
  and **encrypted** (KMS). Periodic **restore drills** validate RPO/RTO.

## 21. Auto Scaling — IDR-0015

- **ECS target-tracking autoscaling** (CPU/memory/RPS/queue-depth) per service; workers scale on queue
  depth. Aurora read replicas scale reads; Aurora Serverless v2 considered for non-prod/bursty. Scaling
  adds capacity, **never** requires re-architecture (Blueprint §26).

## 22. Cost Optimization — IDR-0015

- **Fargate Spot** for stateless workers/non-prod; right-sizing from metrics; Savings Plans/Reserved for
  steady prod; S3 lifecycle tiering; **per-tenant + per-service cost tags** (incl. AI token cost, AIDR-0013);
  budgets + anomaly alerts. Non-prod auto-stop off-hours.

## 23. Release Strategy — IDR-0015

- **Trunk-based + short-lived branches**; **immutable image promotion** (build once → dev → staging → prod);
  **feature flags decouple deploy from release** (ADR 0010) — deploy dark, enable progressively.
- Every release is traceable to a git SHA + image digest; instant rollback by redeploying a prior digest.

## 24. Blue/Green & Canary Deployments — IDR-0015

- **ECS blue/green via CodeDeploy** (ALB target-group shift) with **canary** (e.g. 10% → bake → 100%) and
  automated rollback on alarm (5xx/latency/health). Zero-downtime for a 24/7 clinical system (Blueprint
  §26; expand/contract DB migrations from DDR 0011 make schema changes safe alongside).

## 25. Security Hardening — IDR-0003/0010 (implements SDR-0008/0012)

- Private data tier, default-deny SGs, WAF/Shield, VPC endpoints, least-privilege IAM (no wildcard admin),
  CloudTrail + GuardDuty + Config org-wide, immutable non-root containers, image/IaC scanning, secret
  scanning, KMS everywhere, SCP region/PHI guardrails, no SSH to tasks. Assume-breach posture throughout.

## 26. AI Infrastructure Requirements — IDR-0004/0006 (implements AI phase)

- `ai-plane` as an **isolated Fargate service** (feature-flagged), least-privilege task role, **no direct
  clinical-DB write**; **pgvector** in Aurora for RAG (AIDR-0006). **No GPUs in MVP** (API-based models);
  GPU/inference infra is a Future option if self-hosting.
- **Egress control:** external model calls are allow-listed and **residency-constrained**; provider keys in
  Secrets Manager; all AI I/O audited (AIDR-0011). AI load isolated so it never degrades clinical APIs.

## 27. Mobile & Web Deployment Strategy — IDR-0011

- **Web (Next.js):** containerized → ECR → **Fargate** behind ALB/CloudFront (SSR + static); same
  build-once/promote pipeline.
- **Mobile (React Native + Expo):** **EAS Build** produces native iOS/Android binaries → **App Store /
  Play Store**; **EAS Update (OTA)** for JS-layer updates within store policy; env-specific builds
  (dev/staging/prod) point at the right API. Mobile CI runs tests + build in the same GitHub Actions org.
- Secrets/config for clients are build-time public config only (no server secrets on device; SDR/FEDR-0013).

## 28. Infrastructure Governance — IDR-0012/0001

- **All infra via Terraform + PR review**; IaC scanning + plan approval; **no ClickOps** in staging/prod.
- **SCPs** enforce region allow-list, block public S3/PHI egress, and restrict dangerous actions.
- Change management: infra changes are IDR-worthy when they alter topology/security/cost materially;
  tagging + cost governance; periodic security/cost/DR reviews. Least-privilege by default in every module.

## 29. Infrastructure Consistency Review (vs frozen foundation)

| Frozen source | Infra position | Consistent? |
|---|---|---|
| ADR 0001 (Fargate, not EKS) | §5 Fargate services; §21 autoscale; no K8s | ✅ |
| ADR 0007 (ap-south-1 + ap-south-2 DR) | §1/§8/§19/§20 India regions + cross-region DR | ✅ |
| DDR 0002 (RLS tenancy) | §8 RDS Proxy supports SET LOCAL; §17 RLS-anomaly alerts | ✅ |
| DDR 0006 / SDR-0005 (KMS envelope, per-record keys) | §14 CMK hierarchy + per-tenant CMK | ✅ |
| SDR-0006 (secrets) | §14 Secrets Manager, task roles, no secrets in images | ✅ |
| SDR-0008 (network) | §3/§4/§25 private data tier, default-deny, WAF, endpoints | ✅ |
| SDR-0012 (supply chain/SDLC) | §7/§15 scanning, signing, OIDC CI, gates | ✅ |
| SDR-0007/DDR-0007 (audit WORM) | §10/§17 Object Lock + security-account archive | ✅ |
| Blueprint §26 (scalability) | §21/§24 autoscale + zero-downtime deploys | ✅ |
| DDR 0011 (expand/contract migrations) | §24 safe schema changes alongside blue/green | ✅ |
| AI phase (isolated plane, pgvector, egress) | §26 isolated Fargate ai-plane, pgvector, allow-listed egress | ✅ |
| Frontend (web Next.js, mobile Expo) | §27 Fargate web + EAS mobile | ✅ |
| Open item: RPO/RTO numbers | §19 **now set** (proposed; business RTO sign-off) | ✅ Resolves prior deferral |

**Result: no contradictions, no critical flaws.** Infrastructure faithfully realizes every frozen phase and
**closes the previously-deferred RPO/RTO item** (proposed targets, pending business RTO sign-off). It also
provides the substrate needed to later resolve the offline-PHI (device posture) and LLM-residency questions.

## 30. Infrastructure Freeze Report

**Defined & authoritative:**
- [x] AWS multi-account org + SCP guardrails (§1) — IDR-0001
- [x] Multi-environment parity via Terraform (§2) — IDR-0002
- [x] VPC, networking, security groups (§3–§4) — IDR-0003
- [x] ECS Fargate topology; containers & Docker standards (§5–§7) — IDR-0004/0005
- [x] Aurora, Redis, S3, CDN (§8–§11) — IDR-0006/0007/0008
- [x] Load balancing, DNS (§12–§13) — IDR-0009
- [x] KMS + Secrets Manager (§14) — IDR-0010
- [x] CI/CD + mobile/web pipelines (§15, §27) — IDR-0011
- [x] Terraform/IaC + governance (§16, §28) — IDR-0012
- [x] Observability, monitoring/alerting (§17–§18) — IDR-0013
- [x] DR, backup/restore, **RPO/RTO set** (§19–§20) — IDR-0014
- [x] Autoscaling, cost, release, blue/green/canary (§21–§24) — IDR-0015
- [x] Security hardening, AI infra (§25–§26)
- [x] Consistency review (§29) — no contradictions

**Deferred (non-blocking):** business sign-off on exact RTO; per-tenant CMK rollout (Production); GPU/self-
hosted inference (Future); detailed on-call/runbooks (**Operations phase / ODR**); WebSocket infra (if adopted).

**Freeze status: READY TO FREEZE** on approval. The stack is now fully deployable in design; safe for the
Testing, Operations, and Deployment phases to build upon.

*End of Infrastructure & DevOps Architecture v1.0.*
