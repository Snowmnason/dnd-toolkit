import { useThemeColor } from '@/hooks/use-theme-color';
import { StyleSheet, Text, type TextProps } from 'react-native';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'defaultSemiBold'
    | 'caption'
    | 'bodyLarge'
    | 'overline'
    | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  const typeStyle = (() => {
    switch (type) {
      case 'title': return styles.title;
      case 'subtitle': return styles.subtitle;
      case 'defaultSemiBold': return styles.defaultSemiBold;
      case 'caption': return styles.caption;
      case 'bodyLarge': return styles.bodyLarge;
      case 'overline': return styles.overline;
      case 'link': return styles.link;
      default: return styles.default;
    }
  })();

  return <Text style={[{ color }, typeStyle, style]} {...rest} />;
}

/** Utility for dynamic lineHeight */
const lh = (fs: number) => Math.round(fs * 1.3);

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: lh(16),
    fontFamily: 'GrenzeGotisch',
    fontWeight: '400',
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: lh(16),
    fontFamily: 'GrenzeGotisch',
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    lineHeight: lh(32),
    fontFamily: 'GrenzeGotisch',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 20,
    lineHeight: lh(20),
    fontFamily: 'GrenzeGotisch',
    fontWeight: '600',
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: lh(18),
    fontFamily: 'GrenzeGotisch',
    fontWeight: '400',
  },
  caption: {
    fontSize: 12,
    lineHeight: lh(12),
    fontFamily: 'GrenzeGotisch',
    fontWeight: '400',
  },
  overline: {
    fontSize: 10,
    lineHeight: lh(10),
    fontFamily: 'GrenzeGotisch',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '500',
  },
  link: {
    fontSize: 16,
    lineHeight: lh(16),
    fontFamily: 'GrenzeGotisch',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});