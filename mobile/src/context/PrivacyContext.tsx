import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Animated, Platform } from 'react-native';

interface PrivacyContextType {
  isPrivate: boolean;
  togglePrivacy: () => void;
  setPrivacy: (value: boolean) => void;
  maskAmount: (formatted: string, currency?: string) => string;
  fadeAnim: Animated.Value;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

const STORAGE_KEY = 'flowsy_privacy_mode';

interface PrivacyProviderProps {
  children: ReactNode;
}

export const PrivacyProvider: React.FC<PrivacyProviderProps> = ({ children }) => {
  // Sensitive financial values are hidden by default
  const [isPrivate, setIsPrivateState] = useState<boolean>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return true; // Default to hidden
  });

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 90,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // Trigger state change halfway
    setTimeout(callback, 80);
  };

  const togglePrivacy = () => {
    animateTransition(() => {
      setIsPrivateState((prev) => {
        const next = !prev;
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(STORAGE_KEY, String(next));
          } catch {
            // Storage quota / private mode safeguard
          }
        }
        return next;
      });
    });
  };

  const setPrivacy = (value: boolean) => {
    animateTransition(() => {
      setIsPrivateState(value);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(STORAGE_KEY, String(value));
        } catch {
          // Storage quota safeguard
        }
      }
    });
  };

  /**
   * Replaces numerical figures with a consistent privacy mask while keeping the currency label intact.
   * Never displays a misleading zero.
   */
  const maskAmount = (formatted: string, currency: string = 'EGP'): string => {
    if (!isPrivate) {
      return formatted;
    }
    const cleanCurr = currency === 'EGP' ? 'ج.م' : currency;
    return `•••••• ${cleanCurr}`.trim();
  };

  return (
    <PrivacyContext.Provider
      value={{
        isPrivate,
        togglePrivacy,
        setPrivacy,
        maskAmount,
        fadeAnim,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = (): PrivacyContextType => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};
