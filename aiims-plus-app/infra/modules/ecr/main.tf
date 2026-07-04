# ECR — IDR-0005: immutable tags, scan-on-push.

variable "name" { type = string }

resource "aws_ecr_repository" "this" {
  name                 = var.name
  image_tag_mutability = "IMMUTABLE" # images tagged by git SHA, promoted across envs

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256" # KMS CMK at IDR-0010 build-out
  }
}

output "repository_url" { value = aws_ecr_repository.this.repository_url }
