import { UseTheme } from '@/theme';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { panelConfigs } from './PanelData';

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tabKey: string) => void;
}
const { theme } = UseTheme()

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  
  
  return (
    <View style={styles.container}>
      {panelConfigs.map((panel) => (
        <TouchableOpacity
          key={panel.key}
          style={[
            styles.tab,
            activeTab === panel.key && styles.tabActive,
          ]}
          onPress={() => onTabChange(panel.key)}
        >
          <Text style={styles.icon}>
            {panel.icon}
          </Text>
          <Text
            style={[
              styles.label,
              activeTab === panel.key && styles.labelActive,
            ]}
            numberOfLines={1}
          >
            {panel.title.split(' ')[0]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#1f262eff',
    borderTopWidth: 1,
    borderTopColor: '#969696ff',
    paddingBottom: 5,
    // ...Shadows.panelShadow,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
  },
  tabActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.13)',
  },
  icon: {
    fontSize: 24,
    marginBottom: 2,
  },
  label: {
    fontFamily: theme.fontFamily,
    fontSize: 10,
    color: '#a77e44', // Text Secondary
  },
  labelActive: {
    color: '#D4AF37',
    fontWeight: 'bold',
  },
});
