# infra/ — Terraform (IDR-0012)

Stage 0 skeleton for the **dev** environment in **ap-south-1** (ADR-0007). Environments are module
instantiations with different variables (IDR-0002 parity); staging/prod are added as copies of
`envs/dev` with their own variables when their accounts exist.

| Module        | Realizes                                                         |
| ------------- | ---------------------------------------------------------------- |
| `vpc`         | IDR-0003 — 3-tier subnets: public (ALB/NAT), private app, isolated data (no internet route) |
| `aurora`      | IDR-0006 — Aurora PostgreSQL, encrypted, private; RDS Proxy added at first deploy |
| `redis`       | IDR-0007 — ElastiCache Redis, encrypted in transit/at rest        |
| `ecr`         | IDR-0005 — image registry, scan-on-push, immutable tags           |
| `ecs-service` | IDR-0004 — Fargate service skeleton (api); ALB/WAF wired at first deploy |

**Status: NOT APPLIED — the AWS dev account is not bootstrapped yet** (Master Plan §32 prerequisite,
explicitly deferred). `terraform fmt`/`validate` run in CI. To activate:

1. Bootstrap the AWS org + dev account (IDR-0001) and an S3 + DynamoDB remote-state backend;
   uncomment the `backend "s3"` block in `envs/dev/main.tf`.
2. Create the GitHub OIDC deploy role and set the `AWS_DEPLOY_ROLE_ARN` repo variable —
   the gated `deploy-dev` CI job activates automatically (no long-lived keys, SDR-0006).
3. `terraform -chdir=envs/dev init && terraform -chdir=envs/dev apply`.

KMS CMK hierarchy (IDR-0010), ALB/WAF (IDR-0009), S3/CloudFront (IDR-0008), and Keycloak's Fargate
service are added by the stages that first need them — same modules pattern.
