# Runbook: Kafka Consumer Lag

**Severity:** P2 (elevated) → P1 if lag exceeds 10,000 messages  
**Symptoms:** Cases stuck in `INTAKE_PROCESSING` or `ANALYZING` for >5 minutes; Kafka UI shows consumer group lag growing  

---

## Diagnosis

### Step 1: Check consumer group lag
```bash
# In AWS MSK console, or locally:
kafka-consumer-groups.sh \
  --bootstrap-server $KAFKA_BROKERS \
  --describe \
  --group case-service-group

kafka-consumer-groups.sh \
  --bootstrap-server $KAFKA_BROKERS \
  --describe \
  --group ai-orchestrator-group
```

Look for: `LAG` column — values >1000 indicate a consumer is falling behind.

### Step 2: Check pod health
```bash
kubectl get pods -n exitforge-prod | grep -E "case-service|ai-orchestrator"
kubectl logs -n exitforge-prod deployment/case-service --tail=100
kubectl logs -n exitforge-prod deployment/ai-orchestrator --tail=100
```

Common causes:
- Pod in `CrashLoopBackOff` — consumer died and Kafka lag is accumulating
- Pod in `OOMKilled` — increase memory limits in `values.yaml`
- Long external API calls (Claude API timeout) blocking the consumer loop

### Step 3: Check CPU/Memory
```bash
kubectl top pods -n exitforge-prod
```

---

## Resolution

### If consumer pod is crashed: restart it
```bash
kubectl rollout restart deployment/ai-orchestrator -n exitforge-prod
kubectl rollout status deployment/ai-orchestrator -n exitforge-prod
```

### If lag is due to slow Claude API calls: scale out
```bash
kubectl scale deployment/ai-orchestrator --replicas=3 -n exitforge-prod
```

Ensure the Kafka consumer group ID is the same across replicas — Kafka will rebalance partitions automatically.

### If a poison pill message is blocking the consumer

First identify the problematic offset:
```bash
kafka-console-consumer.sh \
  --bootstrap-server $KAFKA_BROKERS \
  --topic case.events \
  --partition 0 \
  --offset <stuck_offset> \
  --max-messages 1
```

If the message is malformed, skip it by resetting the consumer group offset:
```bash
# Skip one message (set offset to stuck+1)
kafka-consumer-groups.sh \
  --bootstrap-server $KAFKA_BROKERS \
  --group ai-orchestrator-group \
  --topic case.events:0 \
  --reset-offsets \
  --to-offset <stuck_offset+1> \
  --execute
```

**Log the skipped message to the dead-letter topic manually:**
```bash
kafka-console-producer.sh \
  --bootstrap-server $KAFKA_BROKERS \
  --topic case.events.dlq \
  --property "key.serializer=..." 
# Paste the original message with a note
```

### If lag cannot be reduced: scale Kafka partitions

Partitions can only be increased, not decreased:
```bash
kafka-topics.sh \
  --bootstrap-server $KAFKA_BROKERS \
  --alter \
  --topic case.events \
  --partitions 6
```

After increasing partitions, scale the consumer deployment to match:
```bash
kubectl scale deployment/ai-orchestrator --replicas=6 -n exitforge-prod
```

---

## Post-Incident

1. Document the root cause in `#incidents` Slack channel
2. Verify consumer lag returns to 0 in Kafka UI
3. Check that no cases are left stuck — run:
```bash
# In case-service database
psql $DATABASE_URL -c "
  SELECT id, status, updated_at
  FROM cases
  WHERE status IN ('INTAKE_PROCESSING', 'ANALYZING')
    AND updated_at < NOW() - INTERVAL '10 minutes';
"
```
4. Manually retry any stuck cases by emitting a new Kafka event from the case-service admin endpoint
5. If this is the second occurrence in 30 days, file a ticket to add consumer lag alerting to the monitoring stack
