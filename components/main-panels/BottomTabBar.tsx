import { Button, Text, XStack } from 'tamagui';
// import { ComponentStyles } from '../../constants/theme'; // deprecated
import { panelConfigs } from './PanelData';

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tabKey: string) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const styles = {
    container: { flexDirection: 'row' as const, height: 60, borderTopWidth: 1, paddingBottom: 5 },
    tab: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, paddingVertical: 5 },
    activeTab: {},
    icon: { fontSize: 24, marginBottom: 2 },
    activeIcon: {},
    label: { fontSize: 10 },
    activeLabel: { fontWeight: 'bold' as const },
  };
  
  return (
    <XStack style={styles.container}>
      {panelConfigs.map((panel) => (
        <Button
          unstyled
          key={panel.key}
          style={[
            styles.tab,
            activeTab === panel.key && styles.activeTab,
          ]}
          onPress={() => onTabChange(panel.key)}
        >
          <Text style={[
            styles.icon,
            activeTab === panel.key && styles.activeIcon,
          ]}>
            {panel.icon}
          </Text>
          <Text style={[
            styles.label,
            activeTab === panel.key && styles.activeLabel,
          ]} numberOfLines={1}>
            {panel.title.split(' ')[0]}
          </Text>
        </Button>
      ))}
    </XStack>
  );
}
