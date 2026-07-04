terraform {
  required_version = ">= 1.6"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } }
  # backend "s3" { ... }  # remote state + DynamoDB lock (IDR-0012)
}
provider "aws" { region = "ap-south-1" }  # India residency (ADR 0007)

# module "vpc"         { source = "../../modules/vpc" }         # IDR-0003
# module "aurora"      { source = "../../modules/aurora" }      # IDR-0006 (Multi-AZ, RDS Proxy)
# module "api_service" { source = "../../modules/ecs-service" } # IDR-0004 (Fargate)
