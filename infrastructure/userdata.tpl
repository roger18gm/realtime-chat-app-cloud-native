#!/bin/bash

# Log deployment version (forces Terraform diff)
echo "Deploying version ${docker_tag}" > /etc/realtime-chat-app-version

apt-get update -y
apt-get install -y docker.io

systemctl start docker
systemctl enable docker

docker pull ${docker_image}:${docker_tag}

docker stop realtime-chat-app || true
docker rm realtime-chat-app || true

docker run -d \
  --name realtime-chat-app \
  --restart unless-stopped \
  -p 80:8080 \
  -e ENFORCE_AUTH=true \
  -e COGNITO_USER_POOL_ID=${cognito_user_pool_id} \
  -e COGNITO_CLIENT_ID=${cognito_client_id} \
  -e COGNITO_DOMAIN=${cognito_domain} \
  -e COGNITO_REGION=${aws_region} \
  ${docker_image}:${docker_tag}
