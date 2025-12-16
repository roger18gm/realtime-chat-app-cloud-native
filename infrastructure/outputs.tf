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

