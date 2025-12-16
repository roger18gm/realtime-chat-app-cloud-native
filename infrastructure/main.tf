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
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
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
  description = "Allow HTTP and HTTPS"

  # HTTP from ALB
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Egress
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-app-sg"
  }
}

# Security group for ALB
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Allow HTTP and HTTPS to ALB"

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Egress
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

# Self-signed TLS certificate for ALB HTTPS (for lab/dev environment)
# For production, replace with ACM certificate with real domain
resource "tls_private_key" "app" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "app" {
  private_key_pem = tls_private_key.app.private_key_pem

  subject {
    common_name  = var.domain_name
    organization = "Lab Environment"
  }

  validity_period_hours = 8760 # 1 year

  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "server_auth",
  ]
}

resource "aws_acm_certificate" "app" {
  private_key      = tls_private_key.app.private_key_pem
  certificate_body = tls_self_signed_cert.app.cert_pem

  tags = {
    Name = "${var.project_name}-cert"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ALB
resource "aws_lb" "app" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids

  enable_deletion_protection = false

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# Target group for ALB
resource "aws_lb_target_group" "app" {
  name        = "${var.project_name}-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "instance"

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 3
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-tg"
  }
}

# ALB Listener for HTTP (redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ALB Listener for HTTPS
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.app.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# Register EC2 instance with target group
resource "aws_lb_target_group_attachment" "app" {
  target_group_arn = aws_lb_target_group.app.arn
  target_id        = aws_instance.app.id
  port             = 8080
}

# Data sources for VPC/subnets
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
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

  # Callback URLs: localhost for development, ALB HTTPS for production
  # The /callback endpoint receives the authorization code and redirects to home with token
  callback_urls = [
    "http://localhost:8080/callback",
    "http://localhost:3000/callback",
    "http://localhost/callback",
    "https://${aws_lb.app.dns_name}/callback"
  ]

  logout_urls = [
    "http://localhost:8080/",
    "http://localhost:3000/",
    "http://localhost/",
    "https://${aws_lb.app.dns_name}/"
  ]

  supported_identity_providers = ["COGNITO"]

  depends_on = [
    aws_cognito_user_pool_domain.main,
    aws_lb.app
  ]
}

# Cognito Domain for Hosted UI
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Data source to get current AWS account ID
data "aws_caller_identity" "current" {}


