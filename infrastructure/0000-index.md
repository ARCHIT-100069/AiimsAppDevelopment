# AIIMS+ Infrastructure Decision Records (IDR) — Index

**Phase:** 8 (Infrastructure & DevOps) · **Owner:** Cloud & Infrastructure Architect · **Date:** 2026-07-04
**Relationship:** IDRs realize the deployment substrate for the frozen phases; contradict none.
**Companion:** `INFRASTRUCTURE-ARCHITECTURE.md`.

| IDR | Title | Implements | Status | Confidence | Reversibility |
|-----|-------|-----------|--------|------------|---------------|
| 0001 | AWS Organizations multi-account + SCP guardrails | SDR 0008, ADR 0007 | Accepted | High | Medium |
| 0002 | Multi-environment (dev/staging/prod) via Terraform | SDR 0012 | Accepted | High | Medium |
| 0003 | VPC, networking & security groups | SDR 0008 | Accepted | High | Medium |
| 0004 | ECS Fargate compute topology | ADR 0001 | Accepted | High | Medium |
| 0005 | Container & Docker standards + ECR | SDR 0012 | Accepted | High | Medium |
| 0006 | Aurora PostgreSQL deployment (Multi-AZ, RDS Proxy, pgvector) | DDR 0002, ADR 0007 | Accepted | High | Low |
| 0007 | ElastiCache Redis deployment | Backend §15 | Accepted | High | Medium |
| 0008 | S3 + CloudFront CDN | SDR 0004, Blueprint §16 | Accepted | High | Medium |
| 0009 | ALB load balancing + Route 53 DNS + ACM + WAF | SDR 0008 | Accepted | High | Medium |
| 0010 | KMS CMK hierarchy + Secrets Manager | SDR 0005/0006 | Accepted | High | Low |
| 0011 | CI/CD (GitHub Actions, OIDC, gates) + web/mobile pipelines | SDR 0012 | Accepted | High | Medium |
| 0012 | Terraform/IaC + infrastructure governance | SDR 0012 | Accepted | High | Medium |
| 0013 | Observability + monitoring/alerting | SDR 0010, Blueprint §22 | Accepted | High | Medium |
| 0014 | DR + backup/restore + **RPO/RTO targets** | ADR 0007 | Accepted (RTO business sign-off) | Med-High | Medium |
| 0015 | Release (blue/green + canary) + autoscaling + cost | Blueprint §26, ADR 0010 | Accepted | High | Medium |

Template: Context · Decision · Alternatives · Trade-offs · Consequences · Dependencies · Confidence ·
Reversibility · Phase Classification · Related Documents · Review Trigger (GOVERNANCE §3).
