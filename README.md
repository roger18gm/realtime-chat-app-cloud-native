# Real-Time Web Chat Application

The application is a lightweight real-time web application built with Node.js and Socket.IO, containerized using Docker, and deployed to AWS EC2. CI/CD pipelines were implemented using GitHub Actions to automate testing, container builds, infrastructure provisioning, and deployment using Terraform.

## Workflow

The CI pipeline runs on every pull request and merge to main, executing unit and integration tests to ensure code quality. The release pipeline is triggered by semantic version tags and handles Docker image publishing, infrastructure provisioning, and application deployment.

All AWS infrastructure is defined using Terraform and deployed without manual AWS console access. Terraform state is stored remotely in S3 with DynamoDB locking to ensure stability and consistency across pipeline runs.

A post-deployment smoke test validates that the application is accessible after deployment, ensuring failed deployments are detected automatically.

## Features

## Tech Stack

## How to Run Project

npm install

npm run dev

visit localhost:8080/

## Build Process

git checkout main

git pull

git tag v*.*.\*

git push origin v*.*.\*
