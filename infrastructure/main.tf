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
    docker_image          = var.docker_image
    docker_tag            = var.docker_tag
    cognito_user_pool_id  = aws_cognito_user_pool.main.id
    cognito_client_id     = aws_cognito_user_pool_client.web.id
    cognito_domain        = aws_cognito_user_pool_domain.main.domain
    aws_region            = var.aws_region
  })

  user_data_replace_on_change = true

  tags = {
    Name = var.project_name
  }

  depends_on = [
    aws_dynamodb_table.chat_rooms,
    aws_dynamodb_table.chat_messages,
    aws_cognito_user_pool.main,
    aws_cognito_user_pool_client.web,
    aws_cognito_user_pool_domain.main,
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

# Cognito User Pool for authentication
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  auto_verified_attributes = ["email"]

  schema {
    name              = "email"
    attribute_data_type = "String"
    required          = true
    mutable           = true
  }

  tags = {
    Name = "${var.project_name}-user-pool"
  }
}

# Cognito User Pool Client for the web app
resource "aws_cognito_user_pool_client" "web" {
  name                = "${var.project_name}-web-client"
  user_pool_id        = aws_cognito_user_pool.main.id
  generate_secret     = false
  explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH"]

  allowed_oauth_flows          = ["code"]
  allowed_oauth_scopes         = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true

  # Callback URLs: localhost for dev, EC2 public IP for production
  # Note: When deployed to EC2, these URLs are populated dynamically by the app
  # using request.host, so hardcoding the instance IP here isn't necessary
  callback_urls = [
    "http://localhost:8080/",
    "http://localhost:3000/",
    "http://localhost/"
  ]

  logout_urls = [
    "http://localhost:8080/",
    "http://localhost:3000/",
    "http://localhost/"
  ]

  supported_identity_providers = ["COGNITO"]

  depends_on = [aws_cognito_user_pool_domain.main]
}

# Cognito Domain for Hosted UI
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Data source to get current AWS account ID
data "aws_caller_identity" "current" {}


