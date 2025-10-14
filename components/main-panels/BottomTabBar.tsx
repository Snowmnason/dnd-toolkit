import { TouchableOpacity, View } from 'react-native';
import { ComponentStyles } from '../../constants/theme';
import { ThemedText } from '../themed-text';
import { panelConfigs } from './PanelData';

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tabKey: string) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const styles = ComponentStyles.bottomTabBar;
  
  return (
    <View style={styles.container}>
      {panelConfigs.map((panel) => (
        <TouchableOpacity
          key={panel.key}
          style={[
            styles.tab,
            activeTab === panel.key && styles.activeTab,
          ]}
          onPress={() => onTabChange(panel.key)}
        >
          <ThemedText style={[
            styles.icon,
            activeTab === panel.key && styles.activeIcon,
          ]}>
            {panel.icon}
          </ThemedText>
          <ThemedText style={[
            styles.label,
            activeTab === panel.key && styles.activeLabel,
          ]} numberOfLines={1}>
            {panel.title.split(' ')[0]}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );
}
