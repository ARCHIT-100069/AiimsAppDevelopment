# Aurora PostgreSQL — IDR-0006: encrypted, private, Multi-AZ-ready.
# Dev sizing keeps cost low; prod adds readers + RDS Proxy + PITR tuning.

variable "name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "app_security_group_id" { type = string }
variable "master_password" {
  type      = string
  sensitive = true # injected from Secrets Manager at apply time (SDR-0006)
}

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "db" {
  name   = "${var.name}-db"
  vpc_id = var.vpc_id
  # Default-deny; only the app tier may reach Postgres (IDR-0003).
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }
}

resource "aws_rds_cluster" "this" {
  cluster_identifier      = var.name
  engine                  = "aurora-postgresql"
  engine_version          = "16.6"
  database_name           = "aiims"
  master_username         = "postgres"
  master_password         = var.master_password
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  storage_encrypted       = true # KMS at rest (SDR-0004); CMK hierarchy at IDR-0010 build-out
  backup_retention_period = 7
  skip_final_snapshot     = true # dev only

  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 4
  }
}

resource "aws_rds_cluster_instance" "writer" {
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version
}

output "cluster_endpoint" { value = aws_rds_cluster.this.endpoint }
output "db_security_group_id" { value = aws_security_group.db.id }
