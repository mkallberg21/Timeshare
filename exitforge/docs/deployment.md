# Deployment Guide

This document describes how to deploy ExitForge to staging and production environments.

---

## Environments

| Environment | Branch/Trigger | URL | Cluster |
|---|---|---|---|
| **Local** | Any | localhost:3000 | docker-compose |
| **Staging** | Push to `main` | staging.exitforge.com | EKS `exitforge-staging` |
| **Production** | Git tag `v*` + manual approval | app.exitforge.com | EKS `exitforge-prod` |

---

## Automated Deployments (GitHub Actions)

### Staging (`.github/workflows/deploy-staging.yml`)
Triggers automatically on every push to `main`.

1. Runs the full CI pipeline (lint, type-check, test)
2. Builds Docker images for all 10 services and pushes to ECR
3. Runs Helm upgrade against the staging cluster
4. Runs smoke tests against staging API
5. Notifies `#deployments` Slack channel

### Production (`.github/workflows/deploy-prod.yml`)
Triggers on tags matching `v*.*.*` (e.g., `v1.2.3`).

1. Requires **manual approval** from `@mkallberg21` in the GitHub Actions UI
2. Same build/push/upgrade flow as staging
3. Runs a 10-minute canary (5% traffic) before full rollout
4. Can be rolled back with `helm rollback exitforge-prod 0`

---

## Manual Deploy (Emergency Use Only)

For when you need to deploy outside the automated flow:

### Prerequisites
```bash
aws configure sso   # configure AWS SSO profile
aws eks update-kubeconfig --name exitforge-prod --region us-east-1
helm repo update
```

### Deploy a specific service
```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
docker build -t $ECR_REGISTRY/exitforge/case-service:latest ./services/case-service
docker push $ECR_REGISTRY/exitforge/case-service:latest

# Helm upgrade (single service image override)
helm upgrade exitforge-prod ./infrastructure/kubernetes \
  --reuse-values \
  --set services.case-service.image.tag=latest
```

### Full cluster deploy
```bash
helm upgrade exitforge-prod ./infrastructure/kubernetes \
  --values ./infrastructure/kubernetes/values.yaml \
  --values ./infrastructure/kubernetes/values.prod.yaml \
  --set global.imageTag=$(git rev-parse --short HEAD)
```

---

## Rollback

### Helm rollback (fast — ~2 min)
```bash
helm history exitforge-prod --max 5
helm rollback exitforge-prod <revision>
```

### Database rollback
Database migrations are **not automatically rolled back** by Helm rollback. For schema rollbacks:
```bash
cd services/case-service
pnpm prisma migrate resolve --rolled-back <migration_name>
```

See `docs/runbooks/database-connection-exhausted.md` for database emergencies.

---

## Infrastructure (Terraform)

Infrastructure is provisioned separately from application deployments.

```bash
cd infrastructure/terraform

# Preview changes
terraform plan -var-file="terraform.tfvars"

# Apply (requires AWS admin role)
terraform apply -var-file="terraform.tfvars"
```

Terraform state is stored in S3 (`exitforge-tf-state` bucket) with DynamoDB locking. **Never run `terraform apply` without `plan` first.**

---

## Environment Variables

All services read secrets from AWS Parameter Store at startup (in production). Parameter names follow the pattern:
```
/exitforge/{environment}/{service}/{variable}
```

Example: `/exitforge/prod/case-service/DATABASE_URL`

To update a production secret:
```bash
aws ssm put-parameter \
  --name "/exitforge/prod/case-service/DATABASE_URL" \
  --value "postgresql://..." \
  --type "SecureString" \
  --overwrite
```

Then trigger a rolling restart (the service re-reads env vars on start):
```bash
kubectl rollout restart deployment/case-service -n exitforge-prod
```

---

## Health Checks

Every service exposes `GET /health`. The Kubernetes liveness probe calls this every 10s.

Check all service health in staging:
```bash
kubectl get pods -n exitforge-staging
kubectl logs -n exitforge-staging deployment/case-service --tail=50
```

---

## Secrets Rotation

| Secret | Rotation Period | Owner |
|---|---|---|
| `DATABASE_URL` passwords | 90 days | Engineering |
| `CLERK_SECRET_KEY` | Never (rotate only if compromised) | Engineering |
| `STRIPE_WEBHOOK_SECRET` | On rotation | Engineering |
| AWS credentials | Managed by OIDC (no rotation needed) | DevOps |
