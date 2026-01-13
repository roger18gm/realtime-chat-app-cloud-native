variable "aws_region" {
  description = "AWS region for the S3 backend state bucket"
  type        = string
  default     = "us-west-2"
}


# Terraform state bucket name should match name used in infrastructure directory
variable "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  type        = string
  default     = "itm350-realtime-chat-app-tf-state-roger-jan"
}

variable "enable_versioning" {
  description = "Enable versioning for the state bucket"
  type        = bool
  default     = true
}

variable "enable_encryption" {
  description = "Enable server-side encryption for the state bucket"
  type        = bool
  default     = true
}

variable "enable_mfa_delete" {
  description = "Enable MFA delete protection (requires MFA to delete objects)"
  type        = bool
  default     = false
}

variable "force_destroy" {
  description = "Allow Terraform to destroy the bucket even if it contains objects"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "realtime-chat-app"
    Environment = "shared"
    Purpose     = "terraform-state"
  }
}
