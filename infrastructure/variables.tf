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
