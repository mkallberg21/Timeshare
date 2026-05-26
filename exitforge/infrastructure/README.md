# infrastructure/

This directory contains all infrastructure-as-code for ExitForge.

## Contents

| Path | Tool | Description |
|---|---|---|
| [`docker-compose.yml`](docker-compose.yml) | Docker Compose | Full local development environment |
| [`kubernetes/`](kubernetes/) | Helm 3 | Kubernetes deployment chart for all services |
| [`terraform/`](terraform/) | Terraform 1.9+ | AWS infrastructure (EKS, RDS, MSK, ElastiCache, S3) |

## Local Development

The `docker-compose.yml` starts all infrastructure dependencies:

```bash
# Start everything
docker compose -f infrastructure/docker-compose.yml up -d

# Stop everything (keep volumes)
docker compose -f infrastructure/docker-compose.yml down

# Stop and delete all data
docker compose -f infrastructure/docker-compose.yml down -v
```

Services exposed locally:
| Service | Port |
|---|---|
| PostgreSQL | 5432 |
| MongoDB | 27017 |
| Redis | 6379 |
| Kafka | 9092 |
| Kafka UI | 8080 |
| Mongo Express | 8081 |

## Kubernetes (Helm)

The `kubernetes/` directory contains a single Helm chart that deploys all 10 services.

```bash
# Dry-run
helm template exitforge ./infrastructure/kubernetes --values ./infrastructure/kubernetes/values.yaml

# Deploy to staging
helm upgrade --install exitforge-staging ./infrastructure/kubernetes \
  --namespace exitforge-staging \
  --values ./infrastructure/kubernetes/values.yaml \
  --set global.imageTag=$(git rev-parse --short HEAD)
```

## Terraform

See [`terraform/README.md`](terraform/) for full documentation. Quick reference:

```bash
cd infrastructure/terraform
terraform init       # first time only
terraform plan       # preview changes
terraform apply      # apply (requires AWS admin role)
```

**State** is stored in S3 bucket `exitforge-tf-state` with DynamoDB locking. Never run `apply` without `plan`.

## Adding a New Service to Infrastructure

1. Add to `docker-compose.yml` under the `services:` key with health check
2. Add to `kubernetes/values.yaml` under `services:` with image, port, HPA config
3. If the service has infrastructure dependencies (new database, queue), add to `terraform/resources.tf`
