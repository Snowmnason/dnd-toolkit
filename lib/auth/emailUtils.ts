import { Alert, Linking, Platform } from 'react-native';
import { logger } from '../utils/logger';

// Get email domain from email address
export const getEmailDomain = (email: string) => {
  return email.split('@')[1]?.toLowerCase();
};

// Get email provider info
export const getEmailProvider = (domain: string) => {
  const providers: { [key: string]: { name: string; url: string } } = {
    'gmail.com': { name: 'Gmail', url: 'https://mail.google.com' },
    'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com' },
    'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com' },
    'live.com': { name: 'Outlook', url: 'https://outlook.live.com' },
    'yahoo.com': { name: 'Yahoo Mail', url: 'https://mail.yahoo.com' },
    'icloud.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
    'protonmail.com': { name: 'ProtonMail', url: 'https://mail.protonmail.com' },
    'aol.com': { name: 'AOL Mail', url: 'https://mail.aol.com' },
  };
  
  return providers[domain] || { name: 'Email', url: `https://${domain}` };
};

// Open email app (mobile-native approach)
export const openEmailApp = async (email: string) => {
  try {
    if (Platform.OS === 'web') {
      // Web: Open email provider in new tab
      const domain = getEmailDomain(email);
      const provider = getEmailProvider(domain);
      window.open(provider.url, '_blank');
    } else {
      // Mobile: Only try native mail app, no fallbacks
      const mailtoUrl = 'mailto:';
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      }
      // If no mail app available, do nothing - user will handle it themselves
    }
  } catch (error) {
    logger.error('email-utils', 'Error opening email:', error);
    // Only show error alert if something actually went wrong during the attempt
    if (Platform.OS === 'web') {
      Alert.alert('Error', 'Could not open email app');
    }
  }
};