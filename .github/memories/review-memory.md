# Review Memory

## Use For
- Durable review preferences about findings order, correction scope, and validation expectations.
- Recurring defect patterns, cleanup misses, and review habits worth checking in future passes.
- Stable rules for when review should fix locally versus hand work back.

## Do Not Include
- Full review reports, PR summaries, or one-off findings tied to a single diff.
- Current branch state, temporary assumptions, or unresolved speculation.
- Large implementation plans that belong in issue planning or implementation artifacts.
- Secrets, credentials, or local environment details.

## Notes
- Keep findings first, prefer local corrections only when they stay small, and hand larger follow-up work back to implementation.
