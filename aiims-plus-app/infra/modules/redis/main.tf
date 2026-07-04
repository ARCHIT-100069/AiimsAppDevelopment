# ElastiCache Redis — IDR-0007: encrypted in transit + at rest, private.

variable "name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "app_security_group_id" { type = string }

resource "aws_elasticache_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "redis" {
  name   = "${var.name}-redis"
  vpc_id = var.vpc_id
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = var.name
  description                = "AIIMS+ cache/queues (Blueprint §15)"
  engine                     = "redis"
  node_type                  = "cache.t4g.micro" # dev sizing
  num_cache_clusters         = 1                 # Multi-AZ in prod (IDR-0007)
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.redis.id]
}

output "redis_endpoint" { value = aws_elasticache_replication_group.this.primary_endpoint_address }
