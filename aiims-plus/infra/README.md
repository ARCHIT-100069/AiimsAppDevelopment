# infra/ — Terraform (IDR-0012)

Skeleton for Stage 0 dev in **ap-south-1** (ADR 0007). Modules mirror the frozen infra:
`vpc` (3-tier subnets, private data tier — IDR-0003), `ecs-service` (Fargate — IDR-0004),
`aurora` (Multi-AZ Postgres + RDS Proxy, pgvector-ready — IDR-0006). KMS/Secrets Manager and
CloudFront/ALB/WAF added as their stages need them. Remote state = S3 + DynamoDB lock (IDR-0012).

**Not applied in this environment** (no AWS). `terraform init/plan/apply` runs in a provisioned account.
