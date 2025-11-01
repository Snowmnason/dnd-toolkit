import { UseTheme } from '@/theme';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { panelConfigs } from './PanelData';

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tabKey: string) => void;
}

// 🎨 Fixed palette (matches BottomTabBar)
const BOTBAR_BG = '#1f262e'
const BOTBAR_BORDER = '#969696'
const BOTBAR_TEXT = '#F5E6D3'
const BOTBAR_ACTIVE = '#D4AF37'

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const { theme } = UseTheme()
  
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
              { fontFamily: theme.fontFamily },
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
    backgroundColor: BOTBAR_BG,
    borderTopWidth: 1,
    borderTopColor: BOTBAR_BORDER,
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
    fontSize: 10,
    color: BOTBAR_TEXT,
  },
  labelActive: {
    color: BOTBAR_ACTIVE,
    fontWeight: 'bold',
  },
});
