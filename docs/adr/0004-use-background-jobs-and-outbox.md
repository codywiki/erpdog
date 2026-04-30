# ADR-0004: Use Background Jobs and Outbox for Side Effects

## Status

Proposed

## Context

erpdog needs scheduled and asynchronous work:

- Monthly bill generation on the 1st day of each month.
- Excel import.
- Overdue checks.
- Report summary recalculation.
- Feishu notifications, cards, todos, and approval sync.

Some of these tasks call external systems. External calls can fail even after local database transactions succeed.

## Decision

Use Redis + BullMQ for background jobs.

Use an Outbox table for durable side effects:

1. Business transaction writes core data and an outbox event in the same PostgreSQL transaction.
2. Worker reads pending outbox events.
3. Worker performs the side effect, such as Feishu notification.
4. Worker marks the outbox event as sent or failed with retry metadata.

## Consequences

### Positive

- Monthly billing and imports do not block user requests.
- Failed external notifications can be retried.
- Business data remains correct even when Feishu is temporarily unavailable.
- Jobs can be monitored and manually retried.

### Negative

- Adds Redis and worker operational complexity.
- Requires idempotent job and notification handlers.
- Developers must remember to publish outbox events for side effects.

### Neutral

- If job volume stays low, Redis and Worker can run on the same server at first.
- If volume grows, Worker can scale independently from API.

## Alternatives Considered

**Synchronous external calls inside API requests**

Rejected. It makes user requests slow and creates risk that external API failures interrupt core financial transactions.

**Database cron only**

Rejected as the primary mechanism. It is acceptable for simple maintenance tasks, but application-level workers are easier to test and integrate with Feishu.

**Kafka or RabbitMQ**

Rejected for Phase 1. They are powerful, but Redis + BullMQ is simpler for the expected workload.

## References

- https://docs.bullmq.io/
