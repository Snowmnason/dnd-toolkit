# App Overview - Testing Guide

Use this guide for broad manual QA of the main user flows across app and web.

## Prerequisites

- One test account that can sign in.
- A second test account for sharing and conflict checks.
- Access to at least two worlds.
- A test build where Safe Mode Testing is available in Settings.
- A way to disconnect and reconnect the network.

## Core App Flow

### Sign in and reach the app

Steps:
1. Open the app or website.
2. Sign in with a valid test account.
3. Wait for the first screen to finish loading.

Expected results:
- You leave the sign-in screen.
- You land on the main screen or world selection screen.
- Your account is shown correctly in the app.

### Restore a session and sign out cleanly

Steps:
1. Sign in and fully load the app.
2. Close and reopen the app or refresh the website.
3. Confirm whether the session is restored as expected.
4. Use the sign-out action.

Expected results:
- The app restores the session when it should.
- The reopened app does not show a broken or half-signed-in state.
- Signing out returns you to a logged-out screen.
- Signed-out screens do not still show private account data.

### Select and switch worlds

Steps:
1. Open the world selection screen.
2. Confirm all available worlds are listed.
3. Open one world, then switch to a different world.

Expected results:
- The world list is not empty.
- Shared and owned worlds appear correctly.
- After switching, the app shows the newly selected world's data.

### Share a world and accept an invite

Steps:
1. Sign in as the world owner.
2. Open a world's sharing or invite screen.
3. Send an invite to the second test account.
4. Sign in as the invited account and accept the invite.

Expected results:
- The invite can be sent without an error.
- The invited account can accept it.
- The shared world appears for the invited account.

### Edit profile and world details

Steps:
1. Change the signed-in user's display name.
2. Save the change and refresh or reopen the app.
3. Edit a world's visible details such as name or description.

Expected results:
- The new display name is saved and still visible after reopening.
- The edited world details appear correctly after saving.

### Check common loading, empty, and error states

Steps:
1. Open a few major screens such as worlds, story, items, or settings.
2. Watch how each screen appears while loading.
3. If a list or section has no content, check the empty state.
4. If a request fails, check the visible error state.

Expected results:
- Loading states appear intentional and do not hang forever.
- Empty states are readable and not broken.
- Error states explain what happened in simple language.
- The layout stays usable while these states are shown.

### Delete a world and delete an account

Steps:
1. Use a disposable test world and a disposable test account.
2. As the world owner, open the delete world action and confirm it.
3. Open account settings and start the delete account flow.
4. Complete every confirmation step.

Expected results:
- Dangerous actions are clearly marked before confirmation.
- Deleted worlds are no longer accessible.
- A deleted account can no longer sign in.

## Reliability And Recovery

### Use cached data while offline

Steps:
1. Sign in while online and open several screens.
2. Disconnect the network.
3. Reopen the screens you already visited.

Expected results:
- Previously loaded content still appears.
- The app stays usable for basic viewing.
- The app does not crash when offline.

### Recover from a lost connection

Steps:
1. Stay in an active session.
2. Disconnect the network while using the app.
3. Confirm the app shows a clear failure state.
4. Restore the network.

Expected results:
- The app shows a readable error or offline state.
- The app remains stable during the outage.
- After reconnection, data can load again without a full reinstall.

### Sync offline changes after reconnecting

Steps:
1. Go offline.
2. Make a small editable change in a world.
3. Confirm the change appears locally.
4. Reconnect the network.

Expected results:
- The app keeps the local change while offline.
- A pending or syncing state is visible if the product shows one.
- After reconnecting, the change is preserved and finishes syncing.

### Handle conflicting changes safely

Steps:
1. Open the same shared item with two test accounts.
2. Take one account offline and edit the item.
3. Edit the same item online from the second account.
4. Reconnect the offline account.

Expected results:
- The app does not crash or silently lose track of the item.
- The final state follows the product's conflict rules.
- Any conflict message is understandable to a tester.

### Check offline and sync status messages

Steps:
1. Disconnect the network during normal use.
2. Make a change or move through a few screens.
3. Reconnect and watch for any pending, syncing, or resolved messages.

Expected results:
- Offline or syncing messages are noticeable but not disruptive.
- The app makes it clear when work is still pending.
- Messages clear or update once recovery is complete.

### Enter and exit safe mode

Platform notes:
- This check depends on the Safe Mode Testing screen in Settings.
- If a platform build does not expose that screen, record it as unavailable instead of failing the feature.

Steps:
1. Open Settings and go to Safe Mode Testing.
2. Trigger Degraded Mode.
3. Confirm the safe mode screen appears with readable messaging and a recovery path.
4. Repeat with Safe Mode.
5. Repeat with Recovery Mode.

Expected results:
- Each mode opens a visible recovery screen.
- The message changes to match the severity of the mode.
- Recovery actions or navigation actions are visible and usable.
- The app does not freeze when entering these states.

## Access And Platform Checks

### Verify premium and locked features

Steps:
1. Sign in with a free account.
2. Open a premium feature.
3. Sign in with a premium account and open the same feature.

Expected results:
- Free users see a locked or upgrade state.
- Premium users can access the feature.
- The app does not show the wrong entitlement state after switching accounts.

### Verify settings and display preferences

Steps:
1. Open Settings on the current platform.
2. Change one visible preference such as layout, style, or another display option if available.
3. Leave the screen and come back.
4. Restart the app or refresh the site.

Expected results:
- The setting is easy to find and change.
- The visible UI updates correctly after the change.
- The preference stays applied after reopening.

### Verify dialogs and confirmation flows

Steps:
1. Trigger a few common dialogs such as invite, delete, locked-feature, or settings dialogs.
2. Read the text and buttons before confirming.
3. Cancel one dialog and confirm another.

Expected results:
- Dialog text is readable and matches the action.
- Cancel leaves the current data unchanged.
- Confirm completes the action without leaving the UI in a broken state.

### Verify web navigation behavior

Platform notes:
- This check is only for the web build.

Steps:
1. Open the website in a desktop browser.
2. Move between the main screens.
3. Use the browser back and forward buttons.
4. Refresh on a deeper screen if that flow is supported.

Expected results:
- Screens load without getting stuck.
- The URL changes with navigation.
- Browser history behaves normally.

## Pass / Fail

- Pass: the main flows work without crashes, blocked navigation, or clearly wrong data.
- Fail: capture the platform, account used, the exact step that failed, and a screenshot of the visible result.