# Runbook: Database Connection Exhaustion

**Severity:** P1 — affects all services that use PostgreSQL  
**Symptoms:** Services returning 500 errors; logs show `too many connections` or `connection pool timeout`; `/health` endpoints on multiple NestJS services failing  

---

## Background

ExitForge's PostgreSQL instance (AWS RDS `db.t3.medium`) allows a maximum of **~170 connections** (based on RAM formula: `LEAST(DBInstanceClassMemory/9531392, 5000)`). With 6 NestJS services each maintaining a Prisma connection pool of up to 10 connections, the theoretical maximum is 60 connections from the app tier plus 20 for migrations/tooling — leaving no headroom under load.

---

## Immediate Diagnosis (< 2 min)

### Step 1: Check current connection count
```bash
psql "$DATABASE_URL" -c "
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state
ORDER BY count DESC;
"
```

**Normal:** < 50 connections total  
**Elevated:** 50–120  
**Critical:** > 140 (approaching limit — services will start failing)

### Step 2: Identify the connection hog
```bash
psql "$DATABASE_URL" -c "
SELECT application_name, client_addr, count(*), state
FROM pg_stat_activity
WHERE datname = 'exitforge'
GROUP BY application_name, client_addr, state
ORDER BY count DESC
LIMIT 20;
"
```

### Step 3: Look for long-running or idle-in-transaction connections
```bash
psql "$DATABASE_URL" -c "
SELECT pid, application_name, state, wait_event, query_start,
       NOW() - query_start AS duration, left(query, 80) AS query
FROM pg_stat_activity
WHERE datname = 'exitforge'
  AND state IN ('idle in transaction', 'active')
ORDER BY duration DESC
LIMIT 10;
"
```

**Idle in transaction** is dangerous — the transaction holds locks and isn't releasing the connection.

---

## Immediate Mitigation

### Kill idle-in-transaction connections (> 30 seconds)
```bash
psql "$DATABASE_URL" -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'exitforge'
  AND state = 'idle in transaction'
  AND NOW() - state_change > INTERVAL '30 seconds';
"
```

### Kill all non-application connections (if a runaway migration is to blame)
```bash
# Identify the migration PID first:
psql "$DATABASE_URL" -c "
SELECT pid, application_name, query FROM pg_stat_activity
WHERE query LIKE '%ALTER TABLE%' OR query LIKE '%CREATE INDEX%';
"

# Kill it (use the PID from above):
psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(<PID>);"
```

### Emergency: Restart all services to flush connection pools
```bash
kubectl rollout restart deployment -n exitforge-prod
kubectl rollout status deployment -n exitforge-prod
```

This will briefly drop ~1 minute of traffic but resets all Prisma connection pools.

---

## Root Cause Investigation

### Connection leak (most common)

Check if Prisma transactions are being properly closed:
```bash
grep -r "prisma\.\$transaction" services/*/src/ | grep -v "async"
```

Any Prisma transaction that throws without being caught will leave a connection open. Pattern to look for and fix:
```typescript
// ❌ — connection leaks if service.doSomething() throws
await this.prisma.$transaction(async (tx) => {
  await service.doSomething(tx); // if this throws, connection may leak
});

// ✅
await this.prisma.$transaction(async (tx) => {
  return service.doSomething(tx);
}).catch((err) => {
  this.logger.error({ message: 'transaction_failed', err });
  throw err; // let NestJS exception filter handle it
});
```

### Pool size too large

If connection count is consistently high, reduce the Prisma pool size:
```env
# In each service .env
DATABASE_URL="postgresql://...?connection_limit=5&pool_timeout=20"
```

Reducing from default 10 to 5 per service cuts maximum app-tier connections from 60 to 30.

### Missing PgBouncer (long-term fix)

For sustained high connection load, add PgBouncer as a connection proxy. PgBouncer multiplexes thousands of application connections into a handful of real database connections using transaction-mode pooling.

File a P2 ticket to add PgBouncer to the EKS cluster if connection counts frequently exceed 100.

---

## Post-Incident

1. Verify all services healthy: `kubectl get pods -n exitforge-prod`
2. Check error rate in CloudWatch: Application Load Balancer → 5XX rate should return to < 0.1%
3. Run the connection count query again — should be < 50
4. If root cause was a connection leak, write a test that verifies the fixed code path
5. Update this runbook with any new information discovered
