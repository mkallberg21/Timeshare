# Runbook: AI Orchestrator Stuck / Unresponsive

**Severity:** P2 — cases cannot be processed until resolved  
**Symptoms:** Cases not progressing; `ai-orchestrator` health endpoint returns 503 or timeouts; `case.status_changed` events stop flowing  

---

## Diagnosis

### Step 1: Check health
```bash
# Direct service health check
curl -f http://localhost:8000/health     # local
kubectl exec -n exitforge-prod deployment/ai-orchestrator -- \
  curl -s localhost:8000/health
```

Expected: `{"status":"healthy","kafka":"connected","graph":"initialized"}`

### Step 2: Check graph state for stuck cases
```bash
kubectl logs -n exitforge-prod deployment/ai-orchestrator --tail=200 | \
  grep -E "ERROR|stuck|timeout|node"
```

LangGraph logs include `node_name` in structured output — look for a node that appears at the start of many log lines without a corresponding completion.

### Step 3: Query stuck graph states directly
If Redis is accessible:
```bash
redis-cli -u $REDIS_URL KEYS "checkpoint:*" | head -20
redis-cli -u $REDIS_URL HGETALL "checkpoint:<case_id>"
```

The checkpoint shows which node the graph is currently in for each case.

---

## Common Failure Modes

### Mode A: Claude API timeout

**Symptom:** Logs show `anthropic.APITimeoutError` repeatedly.

**Resolution:**
1. Check [status.anthropic.com](https://status.anthropic.com) for an outage
2. If Anthropic is down, the graph will retry with backoff. Cases will self-heal when Anthropic recovers
3. If the issue persists > 30 minutes:
   ```bash
   # Restart the orchestrator — it will resume from the last checkpoint
   kubectl rollout restart deployment/ai-orchestrator -n exitforge-prod
   ```
   LangGraph's `MemorySaver` stores state in Redis between restarts — no case data is lost.

### Mode B: Graph checkpoint corrupted (Redis data issue)

**Symptom:** Logs show `KeyError` or `ValidationError` on state deserialization.

**Resolution:**
1. Identify the corrupt case ID from logs
2. Delete the checkpoint (forces a full replay from `case.created` event):
   ```bash
   redis-cli -u $REDIS_URL DEL "checkpoint:<case_id>"
   ```
3. Re-emit the `case.created` event for this case:
   ```bash
   curl -X POST http://localhost:3001/api/admin/cases/<case_id>/replay \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

### Mode C: `human_review` node permanently interrupted

**Symptom:** Case shows `HUMAN_REVIEW_REQUIRED` status for >24 hours with no action taken.

**Resolution:**
1. Check the admin dashboard: `https://admin.exitforge.com/cases/<case_id>`
2. A human reviewer must either approve or reject in the UI
3. If the admin UI is broken, approve programmatically:
   ```bash
   curl -X POST http://localhost:8000/graph/resume \
     -H "Content-Type: application/json" \
     -d '{"thread_id": "<case_id>", "decision": "approve"}'
   ```

### Mode D: Out of memory (OOM kill)

**Symptom:** Pod restarts with `OOMKilled` in `kubectl describe pod`.

**Resolution:**
1. Temporarily increase memory limits:
   ```bash
   kubectl set resources deployment/ai-orchestrator \
     -n exitforge-prod \
     --limits=memory=2Gi
   ```
2. File a ticket to increase `values.yaml` memory limits permanently

---

## Graph Inspection (Advanced)

To inspect the state of a specific case's graph execution:

```python
# Connect to the Python service pod
kubectl exec -it -n exitforge-prod deployment/ai-orchestrator -- python3

from app.graph.agent_graph import build_graph
from langgraph.checkpoint.memory import MemorySaver
from redis import Redis

# Load checkpoint from Redis
# ... (see graph/agent_graph.py for checkpoint loading pattern)
graph = build_graph()
state = graph.get_state({"configurable": {"thread_id": "<case_id>"}})
print(state.values)
print(state.next)  # shows which node is next
```

---

## Post-Incident

1. Confirm all cases have left `ANALYZING` status
2. Check that Claude API cost didn't spike abnormally (check Anthropic billing console)
3. If the root cause was a code defect, write a regression test for the affected node before deploying the fix
