output "public_ip" {
  value = aws_instance.app.public_ip
}

output "public_dns" {
  value = aws_instance.app.public_dns
}

output "chat_rooms_table" {
  value = aws_dynamodb_table.chat_rooms.name
}

output "chat_messages_table" {
  value = aws_dynamodb_table.chat_messages.name
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "cognito_hosted_ui_domain" {
  value = aws_cognito_user_pool_domain.main.domain
}

output "cognito_hosted_ui_url" {
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com/login?client_id=${aws_cognito_user_pool_client.web.id}&response_type=code&redirect_uri=http://localhost:8080/"
}

output "cognito_callback_urls_for_production" {
  description = "Cognito callback URLs registered (localhost + ALB HTTPS)"
  value = [
    "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost",
    "https://${aws_lb.app.dns_name}"
  ]
}

output "app_access_local" {
  description = "Access the app locally with Cognito auth"
  value = "http://localhost:8080 (run: npm start)"
}

output "app_access_production" {
  description = "Access the app via ALB with HTTPS Cognito auth"
  value = "https://${aws_lb.app.dns_name}/"
}

output "alb_dns_name" {
  description = "ALB DNS name (use for Cognito redirects)"
  value       = aws_lb.app.dns_name
}

output "ec2_public_ip" {
  description = "EC2 instance public IP (for reference, app accessed via ALB in production)"
  value       = aws_instance.app.public_ip
}

output "ec2_public_dns" {
  description = "EC2 instance public DNS (for reference, app accessed via ALB in production)"
  value       = aws_instance.app.public_dns
}


output "app_url" {
  description = "Access your app at this URL"
  value = "http://${aws_instance.app.public_dns}/"
}

