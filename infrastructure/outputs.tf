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
