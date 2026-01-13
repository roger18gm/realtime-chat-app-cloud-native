output "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.id
}

output "state_bucket_arn" {
  description = "ARN of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.arn
}

output "state_bucket_region" {
  description = "Region of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.region
}

output "terraform_backend_config" {
  description = "Backend configuration to add to main Terraform configuration"
  value = <<-EOT
terraform {
  backend "s3" {
    bucket         = "${aws_s3_bucket.terraform_state.id}"
    key            = "realtime-chat-app/terraform.tfstate"
    region         = "${aws_s3_bucket.terraform_state.region}"
    use_lockfile   = true
    encrypt        = true
  }
}
EOT
}
