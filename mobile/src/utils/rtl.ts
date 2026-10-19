import { I18nManager } from 'react-native';

export function setupRTL(): void {
  try {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
  } catch (e) {
    console.warn('RTL setup error:', e);
  }
}
