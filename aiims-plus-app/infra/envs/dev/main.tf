# AIIMS+ dev environment — ap-south-1 (ADR-0007).
# Staging/prod are instantiations of the SAME modules with different
# variables (IDR-0002 parity). NOT APPLIED yet: the AWS dev account is not
# bootstrapped (deferred by founder decision); CI runs fmt+validate only.

terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Remote state (IDR-0012): uncomment after the account bootstrap creates
  # the state bucket + lock table.
  # backend "s3" {
  #   bucket         = "aiims-terraform-state-dev"
  #   key            = "envs/dev/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "aiims-terraform-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = "ap-south-1"

  default_tags {
    tags = {
      Project     = "aiims-plus"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

variable "db_master_password" {
  type        = string
  sensitive   = true
  description = "Injected at apply time from Secrets Manager / CI OIDC (SDR-0006) — never committed"
}

module "vpc" {
  source = "../../modules/vpc"
  name   = "aiims-dev"
}

module "ecr" {
  source = "../../modules/ecr"
  name   = "aiims-api"
}

module "api" {
  source     = "../../modules/ecs-service"
  name       = "aiims-dev-api"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_app_subnet_ids
  image      = "${module.ecr.repository_url}:bootstrap" # replaced by git-SHA tags (IDR-0015)
}

module "aurora" {
  source                = "../../modules/aurora"
  name                  = "aiims-dev"
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.isolated_data_subnet_ids
  app_security_group_id = module.api.app_security_group_id
  master_password       = var.db_master_password
}

module "redis" {
  source                = "../../modules/redis"
  name                  = "aiims-dev"
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.isolated_data_subnet_ids
  app_security_group_id = module.api.app_security_group_id
}
