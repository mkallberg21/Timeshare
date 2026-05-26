# Runbook: Secret Rotation

**Severity:** Scheduled (quarterly) or On-Demand (after suspected breach)  
**Owner:** Platform Engineering  
**Last Updated:** 2025-05-26

---

## Overview

This runbook covers the rotation of all production secrets for ExitForge. Rotate
secrets **immediately** upon any suspected compromise. Scheduled rotation runs quarterly.

---

## Pre-Rotation Checklist

- [ ] Notify `#engineering` Slack channel with a rotation window
- [ ] Ensure you have AWS console + GitHub Actions access
- [ ] Confirm staging environment is healthy (canary deploy rotation there first)
- [ ] Have rollback plan ready (previous secret values noted securely, not in chat)

---

## 1. Database Credentials (PostgreSQL)

**When:** Every 90 days or immediately on breach.

```bash
# 1. Create new DB user in RDS
aws rds-data execute-statement \
  --resource-arn $DB_ARN \
  --secret-arn $MASTER_SECRET_ARN \
  --sql "CREATE USER exitforge_app_v2 WITH PASSWORD '$NEW_PASSWORD'; GRANT CONNECT ON DATABASE exitforge TO exitforge_app_v2;"

# 2. Update GitHub Actions secret
gh secret set DATABASE_URL --env production \
  --body "postgresql://exitforge_app_v2:$NEW_PASSWORD@$DB_HOST:5432/exitforge"

# 3. Re-deploy services with zero downtime rolling update
kubectl rollout restart deployment/case-service -n exitforge
kubectl rollout restart deployment/legal-service -n exitforge
# ... repeat for all services

# 4. Verify connectivity
kubectl exec -n exitforge deploy/case-service -- \
  node -e "require('@prisma/client'); console.log('DB ok')"

# 5. Drop old DB user
aws rds-data execute-statement \
  --resource-arn $DB_ARN --secret-arn $MASTER_SECRET_ARN \
  --sql "DROP USER exitforge_app_v1;"
```

---

## 2. Anthropic API Key

**When:** Every 90 days or on API key compromise.

```bash
# 1. Generate new key at https://console.anthropic.com/keys
# 2. Update secret
gh secret set ANTHROPIC_API_KEY --env production --body "$NEW_KEY"

# 3. Restart ai-orchestrator only
kubectl rollout restart deployment/ai-orchestrator -n exitforge

# 4. Verify agent graph invocation still works
curl -X POST https://api.exitforge.com/ai/invoke \
  -H "Authorization: Bearer $INTERNAL_TOKEN" \
  -d '{"case_id":"smoke_test_1","client_id":"c1","intake_data":{}}'

# 5. Revoke old key from Anthropic console
```

---

## 3. Clerk API Keys

**When:** Every 180 days or on breach.

```bash
# 1. Generate new CLERK_SECRET_KEY in Clerk dashboard
#    Dashboard → API Keys → Roll Secret Key
# 2. Update secret (keep the old key active during rollout)
gh secret set CLERK_SECRET_KEY --env production --body "$NEW_CLERK_KEY"

# 3. Rolling restart (both old and new key accepted during 10-min grace period)
for svc in case-service communication-service intake-service; do
  kubectl rollout restart deployment/$svc -n exitforge
  kubectl rollout status deployment/$svc -n exitforge
done

# 4. After all pods restart, revoke old key in Clerk dashboard
```

---

## 4. AWS IAM Credentials (S3 / SQS)

**Preferred approach:** Use IRSA (IAM Roles for Service Accounts) — no static credentials.

If static credentials are still in use:

```bash
# 1. Create new IAM access key
NEW_KEY=$(aws iam create-access-key --user-name exitforge-s3-user)

# 2. Update secrets
gh secret set AWS_ACCESS_KEY_ID --env production \
  --body "$(echo $NEW_KEY | jq -r .AccessKey.AccessKeyId)"
gh secret set AWS_SECRET_ACCESS_KEY --env production \
  --body "$(echo $NEW_KEY | jq -r .AccessKey.SecretAccessKey)"

# 3. Restart document-service and case-service
kubectl rollout restart deployment/document-service -n exitforge

# 4. Delete old access key
aws iam delete-access-key --user-name exitforge-s3-user --access-key-id $OLD_KEY_ID
```

---

## 5. Kafka SASL Credentials

```bash
# 1. Create new SASL user in MSK console
# 2. Update KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD secrets
gh secret set KAFKA_SASL_USERNAME --env production --body "$NEW_USER"
gh secret set KAFKA_SASL_PASSWORD --env production --body "$NEW_PASS"

# 3. Restart all services that produce/consume Kafka
for svc in case-service ai-orchestrator communication-service legal-service negotiation-service; do
  kubectl rollout restart deployment/$svc -n exitforge
done

# 4. Monitor consumer lag during rotation
# kubectl exec -n exitforge deploy/case-service -- \
#   kafka-consumer-groups.sh --bootstrap-server $KAFKA_BROKERS --describe --all-groups

# 5. Delete old SASL user from MSK
```

---

## 6. Redis Password

```bash
# 1. Update AUTH token in ElastiCache console (supports dual-token rotation)
# 2. Add new token alongside old (ElastiCache allows 2 tokens simultaneously)
gh secret set REDIS_URL --env production \
  --body "redis://:$NEW_REDIS_PASSWORD@$REDIS_HOST:6379"

# 3. Rolling restart
kubectl rollout restart deployment -n exitforge --selector=app.kubernetes.io/part-of=exitforge

# 4. Remove old token from ElastiCache
```

---

## Post-Rotation Verification

```bash
# Health-check all services
for svc in case-service ai-orchestrator ml-service legal-service; do
  kubectl exec -n exitforge deploy/$svc -- \
    curl -sf http://localhost:4000/api/health || echo "FAILED: $svc"
done

# Check error rate in Datadog
# Look for spike in 5xx or authentication errors in the 5 minutes post-rotation
```

---

## Rollback

If a service fails to start after rotation:

```bash
# Restore previous secret value
gh secret set $SECRET_NAME --env production --body "$PREVIOUS_VALUE"
kubectl rollout restart deployment/$SERVICE_NAME -n exitforge
kubectl rollout status deployment/$SERVICE_NAME -n exitforge
```

---

## Related

- [GitHub Secrets Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Datadog APM](https://app.datadoghq.com/apm/services)
- [Database Connection Exhausted runbook](./database-connection-exhausted.md)
