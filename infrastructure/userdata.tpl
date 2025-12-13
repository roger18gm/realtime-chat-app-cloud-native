#!/bin/bash
apt-get update -y
apt-get install -y docker.io

systemctl start docker
systemctl enable docker

docker pull ${docker_image}:${docker_tag}
docker run -d -p 80:8080 --restart unless-stopped \
  --name realtime-chat-app \
  ${docker_image}:${docker_tag}
