import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  ColorTokens,
  lightTokens,
  darkTokens,
  spacing,
  radii,
  typography,
  shadows,
  motion,
} from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  themePreference: ThemeMode;
  isDark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
  motion: typeof motion;
  setMode: (mode: ThemeMode) => void;
  setThemePreference: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  themePreference: 'system',
  isDark: false,
  colors: lightTokens,
  spacing,
  radii,
  typography,
  shadows,
  motion,
  setMode: () => {},
  setThemePreference: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkTokens : lightTokens;

  return (
    <ThemeContext.Provider
      value={{
        mode,
        themePreference: mode,
        isDark,
        colors,
        spacing,
        radii,
        typography,
        shadows,
        motion,
        setMode,
        setThemePreference: setMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
