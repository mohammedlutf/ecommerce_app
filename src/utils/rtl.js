import { I18nManager } from 'react-native';

/**
 * Configure RTL layout for Arabic interface
 */
export function initRTL() {
  try {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
  } catch (err) {
    console.warn('Could not force RTL:', err);
  }
}

export const isRTL = I18nManager.isRTL;
