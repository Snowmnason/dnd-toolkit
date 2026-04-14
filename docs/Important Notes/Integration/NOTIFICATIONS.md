# 🔔 Notification System Usage Guide

## Overview

The app now has three distinct notification/feedback systems:

1. **Notification** - Persistent in-app notifications for messages, updates, and alerts
2. **SnackBar** - Quick feedback with optional actions (platform-aware positioning)
3. **AppToast** - Ephemeral success/error/info messages

---

## 1. Notification Component (NEW!)

**Use for**: Real-time messages, app updates, alerts that need user attention

### Setup

#### Step 1: Add NotificationProvider to your root layout

```tsx
// app/_layout.tsx
import { NotificationProvider } from "@/hooks/use-notifications";
import { NotificationContainer } from "@/components/ui";

export default function RootLayout() {
  return (
    <NotificationProvider>
      {/* Your existing providers */}
      <ThemeProvider>
        <Stack>{/* Your screens */}</Stack>

        {/* Add this at the end */}
        <NotificationContainer />
      </ThemeProvider>
    </NotificationProvider>
  );
}
```

#### Step 2: Use anywhere in your app

```tsx
import { useNotifications } from "@/hooks/use-notifications";

function SomeComponent() {
  const { showNotification } = useNotifications();

  const handleNewMessage = () => {
    showNotification({
      type: "message",
      title: "New Message",
      message: "Sarah sent you a message",
      timestamp: new Date(),
      onPress: () => {
        // Navigate to message screen
        navigate.push("/messages/123");
      },
    });
  };

  const handleUpdate = () => {
    showNotification({
      type: "update",
      title: "World Updated",
      message: "John added a new location to the campaign",
      onPress: () => navigate.push("/world/locations"),
    });
  };

  const handleAlert = () => {
    showNotification({
      type: "alert",
      title: "Connection Lost",
      message: "Attempting to reconnect...",
    });
  };

  return (
    <View>
      <Button text="Simulate Message" onPress={handleNewMessage} />
      <Button text="Simulate Update" onPress={handleUpdate} />
      <Button text="Simulate Alert" onPress={handleAlert} />
    </View>
  );
}
```

### Features

- ✅ **Platform-aware positioning**: Top-right on desktop, top-center on mobile
- ✅ **Keyboard-safe**: Always at top on mobile (won't be covered by keyboard)
- ✅ **Stacking**: Up to 3 notifications stack vertically
- ✅ **Auto-dismiss**: Disappears after 5 seconds
- ✅ **Interactive**: Can be tapped to trigger actions
- ✅ **Haptic feedback**: Different feedback for alerts vs messages
- ✅ **Icon types**: Automatically shows appropriate icon (message, update, alert, info)

---

## 2. SnackBar (UPDATED!)

**Use for**: Quick actionable feedback (undo, retry, view)

### Now Platform-Aware!

- **Desktop**: Bottom of screen (traditional Material Design)
- **Mobile**: Top of screen (keyboard-safe)

```tsx
import { SnackBar } from "@/components/ui";

function MyComponent() {
  const [visible, setVisible] = useState(false);

  const handleSave = () => {
    // Save logic...
    setVisible(true);
  };

  return (
    <>
      <Button text="Save Changes" onPress={handleSave} />

      <SnackBar
        visible={visible}
        message="Changes saved successfully"
        tone="success"
        actionText="Undo"
        onAction={() => {
          // Undo logic
          console.log("Undo clicked");
        }}
        onHide={() => setVisible(false)}
      />
    </>
  );
}
```

---

## 3. AppToast (Existing)

**Use for**: Quick non-interactive feedback (saved, copied, deleted)

```tsx
import { AppToast } from "@/components/ui";

<AppToast
  message="Item copied!"
  visible={toastVisible}
  type="success"
  duration={2000}
  onHide={() => setToastVisible(false)}
/>;
```

---

## When to Use What?

| Component        | Use Case                  | Position                        | Interactive         | Duration          |
| ---------------- | ------------------------- | ------------------------------- | ------------------- | ----------------- |
| **Notification** | Messages, updates, alerts | Top                             | Yes (tappable)      | 5s auto-dismiss   |
| **SnackBar**     | Actionable feedback       | Bottom (desktop) / Top (mobile) | Yes (action button) | 4s auto-dismiss   |
| **AppToast**     | Quick status updates      | Top-right (desktop)             | No                  | 2.5s auto-dismiss |

### Examples:

- **Notification**: "Sarah joined your campaign" (tap to view)
- **SnackBar**: "Character deleted" + "Undo" button
- **AppToast**: "Copied to clipboard"

---

## API Reference

### Notification Types

```tsx
type NotificationType = "message" | "update" | "alert" | "info";

interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  timestamp?: Date;
  onPress?: () => void;
}
```

### useNotifications Hook

```tsx
const {
  showNotification, // (notification) => void
  dismissNotification, // (id) => void
  clearAll, // () => void
  notifications, // NotificationData[]
} = useNotifications();
```

---

## Integration Examples

### Real-time Messaging

```tsx
// Listen for new messages (e.g., via WebSocket or polling)
useEffect(() => {
  const unsubscribe = subscribeToMessages((message) => {
    showNotification({
      type: "message",
      title: `${message.sender.name}`,
      message: message.text,
      timestamp: message.createdAt,
      onPress: () => navigate.push(`/messages/${message.id}`),
    });
  });
  return unsubscribe;
}, []);
```

### Campaign Updates

```tsx
const handleWorldUpdate = (update: WorldUpdate) => {
  showNotification({
    type: "update",
    title: "World Updated",
    message: `${update.user.name} ${update.action}`,
    onPress: () => navigate.push(`/world/${update.worldId}`),
  });
};
```

### Error Handling

```tsx
try {
  await saveCharacter(data);
  showNotification({
    type: "update",
    title: "Character Saved",
    message: "Your changes have been saved",
  });
} catch (error) {
  showNotification({
    type: "alert",
    title: "Save Failed",
    message: error.message,
  });
}
```

---

## Styling Notes

All notification components:

- ✅ Use theme tokens (update live with theme changes)
- ✅ Respect scaling preferences
- ✅ Support gradients and shadows
- ✅ Accessible (proper contrast, tap targets)
