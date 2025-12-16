variable "aws_region" {
  type    = string
  default = "us-west-2"
}

variable "project_name" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "t2.micro"
}

variable "docker_image" {
  type = string
}

variable "docker_tag" {
  type = string
}

variable "use_lab_role" {
  description = "Use pre-existing AWS Academy Learner Lab LabRole instead of creating a new role"
  type        = bool
  default     = true
}

variable "lab_instance_profile_name" {
  description = "Name of the pre-existing LabInstanceProfile (for AWS Academy Learner Lab)"
  type        = string
  default     = "LabInstanceProfile"
}

variable "domain_name" {
  description = "Domain name for SSL certificate (e.g., example.com). Will use wildcard *.domain_name"
  type        = string
  default     = "realtime-chat-app.local"
}
