---
name: doc-closeout
description: "Start the docs agent to write issue closeout docs, update top-level module READMEs, or suggest a deeper technical note"
agent: docs
argument-hint: "Point to the issue file, touched modules, or documentation target to update"
---

Use [docs.agent.md](../agents/docs.agent.md) to update documentation after implementation.

Working rules:

- Use issue closeout mode for `docs/issues/**` deliverables.
- Always create or update `USAGE_GUIDE.md` and `IMPLEMENTATION.md` for issue closeout work.
- Use README mode for top-level module READMEs in `lib/*`, `hooks/*`, and `system/*`.
- Do not create nested module READMEs unless the user explicitly asked for one.
- Suggest a deep note when a pipeline or cross-module flow needs more detail, but ask before creating a new file under `docs/Important Notes/**`.
- Do not implement code or write tests in this workflow.

Deliver:

- the requested docs update
- any optional doc suggestion that needs approval
- any missing source context needed to finish the documentation cleanly