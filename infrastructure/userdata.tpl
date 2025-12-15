#!/bin/bash
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
  ${docker_image}:${docker_tag}
