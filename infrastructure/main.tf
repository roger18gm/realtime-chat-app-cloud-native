terraform {
  backend "s3" {
    bucket         = "itm350-realtime-chat-app-tf-state"
    key            = "realtime-chat-app/terraform.tfstate"
    region         = "us-west-2"
    use_lockfile   = true
    encrypt        = true
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }
}

resource "aws_security_group" "web" {
  name        = "${var.project_name}-sg"
  description = "Allow HTTP"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  security_groups = [aws_security_group.web.name]
  iam_instance_profile = var.use_lab_role ? var.lab_instance_profile_name : aws_iam_instance_profile.app[0].name

  user_data = templatefile("${path.module}/userdata.tpl", {
    docker_image = var.docker_image
    docker_tag   = var.docker_tag
  })

  user_data_replace_on_change = true

  tags = {
    Name = var.project_name
  }

  depends_on = [
    aws_dynamodb_table.chat_rooms,
    aws_dynamodb_table.chat_messages,
  ]
}

# IAM role for EC2 instance to access DynamoDB
# Only created if not using AWS Academy Learner Lab LabRole
resource "aws_iam_role" "app" {
  count = var.use_lab_role ? 0 : 1
  name  = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for DynamoDB access
# Only created if not using AWS Academy Learner Lab LabRole
resource "aws_iam_role_policy" "dynamodb_access" {
  count  = var.use_lab_role ? 0 : 1
  name   = "${var.project_name}-dynamodb-policy"
  role   = aws_iam_role.app[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
        ]
        Resource = [
          aws_dynamodb_table.chat_rooms.arn,
          aws_dynamodb_table.chat_messages.arn,
        ]
      }
    ]
  })
}

# IAM instance profile
# Only created if not using AWS Academy Learner Lab LabInstanceProfile
resource "aws_iam_instance_profile" "app" {
  count = var.use_lab_role ? 0 : 1
  name  = "${var.project_name}-instance-profile"
  role  = aws_iam_role.app[0].name
}

# DynamoDB table for chat rooms
resource "aws_dynamodb_table" "chat_rooms" {
  name           = "ChatRooms"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "roomId"

  attribute {
    name = "roomId"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-rooms"
  }
}

# DynamoDB table for chat messages
resource "aws_dynamodb_table" "chat_messages" {
  name           = "ChatMessages"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "roomId"
  range_key      = "timestamp"

  attribute {
    name = "roomId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  # TTL for automatic message cleanup (7 days)
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${var.project_name}-messages"
  }
}

