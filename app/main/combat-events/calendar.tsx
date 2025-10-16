import { Heading, Text, View } from 'tamagui';

export default function CalendarPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Calendar</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track in-world time and schedule campaign events.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📅 Coming Soon: Custom calendars, event scheduling, and time tracking.
      </Text>
    </View>
  );
}
