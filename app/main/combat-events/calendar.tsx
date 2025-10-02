import { ThemedText } from '../../../components/themed-text';
import { ThemedView } from '../../../components/themed-view';

export default function CalendarPage() {
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <ThemedText type="title" style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3' }}>
        Calendar
      </ThemedText>
      <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 18, color: '#F5E6D3' }}>
        Track in-world time and schedule campaign events.
      </ThemedText>
      
      {/* Placeholder content */}
      <ThemedText style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40, color: '#F5E6D3' }}>
        📅 Coming Soon: Custom calendars, event scheduling, and time tracking.
      </ThemedText>
    </ThemedView>
  );
}
