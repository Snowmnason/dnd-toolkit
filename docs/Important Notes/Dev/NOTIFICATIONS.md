# Notifications And Feedback

Reference note for the user-facing feedback systems already in the app and how future OS notifications should fit into them.

## Current Systems

### Notification

Use for tappable in-app updates that need attention.

- Best for messages, world updates, or important alerts.
- Can open a screen or continue a flow when pressed.
- Should feel like higher-importance in-app communication, not a short status blip.

### SnackBar

Use for short feedback with an action.

- Best for undo, retry, or quick next-step prompts.
- Should be brief and easy to dismiss.
- Prefer this when the user should be able to react immediately.

### AppToast

Use for short non-blocking status updates.

- Best for copied, saved, deleted, or completed states.
- Should not carry navigation or recovery actions.
- Prefer this for simple confirmation.

## Choosing The Right One

- Use `Notification` for important in-app events with follow-up context.
- Use `SnackBar` when the user may need to undo or retry something.
- Use `AppToast` for fast confirmation that does not need interaction.

## Future OS Notification Note

If mobile OS notifications are added later, they should connect back into the same app-level behavior instead of introducing a separate product language.

- iOS and Android notifications should deep-link into the correct in-app destination when possible.
- Important OS notifications should map cleanly to existing in-app notification concepts.
- Avoid creating a fourth overlapping feedback pattern just for platform integration.

## Keep In Mind

- Keep user-facing copy short and clear.
- Pick one feedback system per event based on importance and required action.
- Reuse the shared notification patterns before adding a new UI feedback surface.