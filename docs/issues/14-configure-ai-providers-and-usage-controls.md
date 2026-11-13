## What to build

Implement the server-side AI provider boundary for the supported providers and models, with separate chat and background roles, secure key handling, per-user budgets, metering, rate limits, and manual fallback. Provider/model changes must be explicit and must not silently fall back to a different model.

## Acceptance criteria

- [ ] Provider calls run server-side under the authenticated user's identity; user keys are encrypted, masked, and never exposed to the client or logs.
- [ ] Supported provider/model availability, pricing, retention, and account settings are checked before activation.
- [ ] Chat and background workloads have separate role, budget, and usage reporting.
- [ ] Spend is reserved and reconciled with warnings at the configured thresholds; provider billing remains authoritative.
- [ ] AI failure or budget exhaustion leaves manual planning available and does not silently replay chat actions.

## Blocked by

None - can start immediately.
