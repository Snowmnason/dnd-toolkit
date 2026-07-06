# Kernel And Degrade Follow-Ups

Future work that remains around advanced kernel phase control and the degrade-response system.

## Current Status

Some of the old issue-era "missing" claims are no longer current.

For example, crash callback registration is already wired in `lib/jobs/registry.ts`, so that is no longer a live gap.

This note keeps only the follow-ups that still appear relevant.

## Remaining Degrade-System Follow-Ups

### System Response Bodies Still Need Real Infrastructure Actions

The degrade system wiring exists, but some response bodies are still intentionally deferred because the dependent infrastructure is not fully there yet.

Typical remaining areas include:

- better offline-first API behavior during connectivity degrade
- queue pause or resume behavior for background jobs
- more complete storage fallback behavior
- analytics or error-tracking buffering on degraded paths

These are not registration gaps. They are "the handler is called, but the useful action is still shallow" gaps.

### Registration-Failure Safe Mode Display

The older issue notes also called out a follow-up around surfacing registration failures more clearly in safe mode.

That still reads as a reasonable future improvement:

- summarize failed registration items
- show them in safe mode or another recovery-oriented UI
- make retry or continue decisions more explicit

### Placeholder Recovery Subscriptions

The issue-era notes also referenced placeholder recovery subscriptions for things like:

- sync recovery
- job recovery
- service-health recovery

Those still make sense as future follow-up points if the recovery APIs become richer.

## Remaining Kernel Phase Follow-Ups

### Advanced Retry Strategy

Basic retry logic exists, but the more ambitious phase-aware retry ideas remain future work.

Examples:

- different retry behavior by phase type
- different retry behavior by failure category
- stronger circuit-breaker style limits around repeated phase failures
- optional user-initiated recovery UI for selected failures

### Phase Visibility And Debug Tooling

The older issue notes also pointed at developer tooling that still does not appear to be the mainline experience:

- phase dependency visualization
- richer phase timing visibility
- easier inspection of degraded or partially completed phase paths

### Dynamic Phase Configuration

The kernel still appears to rely on a static phase sequence.

That is fine for current needs, but the more dynamic version remains deferred:

- conditionally skipping phases
- pluggable phase registration
- environment-based or flag-driven phase configuration

## Example Future Direction

```text
phase fails
    ↓
classify failure type
    ↓
pick phase-specific retry or degrade behavior
    ↓
surface recovery context to safe mode or developer diagnostics
```

## Priority

Medium.

The most useful near-term work is the degrade-response depth and registration-failure visibility. The more advanced retry and visualization ideas are valuable, but they are later-stage improvements.